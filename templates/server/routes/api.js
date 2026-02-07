const fs = require('fs');
const path = require('path');
const { generateId } = require('../lib/ids');
const { writeJSON, readJSONArray, readJSONObject, updateJSON } = require('../lib/store');
const { broadcast } = require('../lib/ws');

const DELIVERY_MODES = ['task_delivery', 'alignment'];
const DELIVERY_STATUSES = ['normal', 'pending_feedback'];
const ALIGNMENT_STATES = ['active', 'resolved', 'canceled'];

const DEFAULT_SETTINGS = {
  platform: {
    name: 'Visual Delivery',
    logo_url: '',
    slogan: 'Turn work into clear decisions.',
    visual_style: 'executive-brief',
  },
};

function ensureUiSpecContent(content) {
  if (!content || typeof content !== 'object') return false;
  if (content.type !== 'ui_spec') return false;
  return !!content.ui_spec && typeof content.ui_spec === 'object';
}

function normalizeMetadata(metadata = {}) {
  return {
    project_name: metadata.project_name || 'Untitled Project',
    task_name: metadata.task_name || 'Untitled Task',
    generated_at: metadata.generated_at || new Date().toISOString(),
    audience: metadata.audience || 'stakeholder',
  };
}

function mapIndexEntry(delivery) {
  return {
    id: delivery.id,
    mode: delivery.mode,
    status: delivery.status,
    title: delivery.title,
    created_at: delivery.created_at,
    updated_at: delivery.updated_at,
    metadata: delivery.metadata,
    agent_session_id: delivery.agent_session_id,
    alignment_state: delivery.alignment_state,
  };
}

function setupRoutes(app, dataDir) {
  const dataRoot = path.join(dataDir, 'data');
  const deliveriesDir = path.join(dataRoot, 'deliveries');
  const sessionsDir = path.join(dataRoot, 'sessions');
  const indexPath = path.join(dataRoot, 'index.json');
  const settingsPath = path.join(dataRoot, 'settings.json');

  fs.mkdirSync(deliveriesDir, { recursive: true });
  fs.mkdirSync(sessionsDir, { recursive: true });

  function deliveryDir(deliveryId) {
    return path.join(deliveriesDir, deliveryId);
  }

  function deliveryFile(deliveryId, fileName) {
    return path.join(deliveryDir(deliveryId), fileName);
  }

  function sessionAlignmentDir(agentSessionId) {
    return path.join(sessionsDir, agentSessionId, 'alignment');
  }

  function activeAlignmentPath(agentSessionId) {
    return path.join(sessionAlignmentDir(agentSessionId), 'active.json');
  }

  function alignmentHistoryDir(agentSessionId) {
    return path.join(sessionAlignmentDir(agentSessionId), 'history');
  }

  async function appendIndex(delivery) {
    const entry = mapIndexEntry(delivery);
    await updateJSON(indexPath, (entries) => {
      entries.push(entry);
      return entries;
    });
    return entry;
  }

  async function updateIndex(delivery) {
    const entry = mapIndexEntry(delivery);
    await updateJSON(indexPath, (entries) => {
      const idx = entries.findIndex((item) => item.id === delivery.id);
      if (idx >= 0) {
        entries[idx] = entry;
      }
      return entries;
    });
    return entry;
  }

  function readDelivery(deliveryId) {
    return readJSONObject(deliveryFile(deliveryId, 'delivery.json'));
  }

  function readDeliveryFeedback(deliveryId) {
    return readJSONArray(deliveryFile(deliveryId, 'feedback.json'));
  }

  function readDeliveryDrafts(deliveryId) {
    return readJSONArray(deliveryFile(deliveryId, 'drafts.json'));
  }

  async function writeDelivery(delivery) {
    await writeJSON(deliveryFile(delivery.id, 'delivery.json'), delivery);
  }

  async function recalcDeliveryStatus(deliveryId) {
    const delivery = readDelivery(deliveryId);
    if (!delivery) return null;

    const feedbackItems = readDeliveryFeedback(deliveryId);
    const hasUnhandled = feedbackItems.some((item) => item.handled === false);
    delivery.status = hasUnhandled ? 'pending_feedback' : 'normal';
    delivery.updated_at = new Date().toISOString();

    await writeDelivery(delivery);
    await updateIndex(delivery);
    return delivery;
  }

  function normalizeFeedbackDraftItem(item, now) {
    return {
      id: item.id || generateId('fd'),
      kind: item.kind === 'annotation' ? 'annotation' : 'interactive',
      payload: item.payload || {},
      target: item.target || null,
      created_at: item.created_at || now,
    };
  }

  function normalizeFeedbackItem(item, now) {
    return {
      id: generateId('f'),
      kind: item.kind === 'annotation' ? 'annotation' : 'interactive',
      payload: item.payload || {},
      target: item.target || null,
      handled: false,
      handled_at: null,
      handled_by: null,
      created_at: now,
    };
  }

  async function archiveActiveAlignment(agentSessionId, activeRecord, terminalState, reason, endedAt) {
    if (!activeRecord) return;
    const historyPath = path.join(
      alignmentHistoryDir(agentSessionId),
      `${Date.now()}_${activeRecord.delivery_id}.json`
    );
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });

    await writeJSON(historyPath, {
      ...activeRecord,
      terminal_state: terminalState,
      reason,
      ended_at: endedAt,
    });
  }

  async function endActiveAlignment(agentSessionId, threadId, terminalState, reason) {
    const activePath = activeAlignmentPath(agentSessionId);
    const activeRecord = readJSONObject(activePath);

    if (!activeRecord) {
      return { status: 'no_active' };
    }

    if (threadId && activeRecord.thread_id !== threadId) {
      return {
        status: 'error',
        code: 'THREAD_MISMATCH',
        message: 'thread_id does not match active alignment',
      };
    }

    const now = new Date().toISOString();
    const delivery = readDelivery(activeRecord.delivery_id);
    if (delivery) {
      delivery.alignment_state = terminalState;
      delivery.updated_at = now;
      await writeDelivery(delivery);
      await updateIndex(delivery);
      broadcast('update_delivery', mapIndexEntry(delivery));
    }

    await archiveActiveAlignment(agentSessionId, activeRecord, terminalState, reason, now);
    try {
      fs.unlinkSync(activePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    broadcast('alignment_update', {
      agent_session_id: agentSessionId,
      delivery_id: activeRecord.delivery_id,
      alignment_state: terminalState,
      reason,
    });

    return {
      status: terminalState,
      delivery_id: activeRecord.delivery_id,
    };
  }

  async function createDeliveryRecord({ mode, title, content, metadata, agentSessionId, threadId, alignmentState }) {
    const id = generateId('d');
    const now = new Date().toISOString();

    fs.mkdirSync(deliveryDir(id), { recursive: true });

    const delivery = {
      id,
      mode,
      status: 'normal',
      title,
      content,
      metadata: normalizeMetadata(metadata),
      agent_session_id: agentSessionId || null,
      thread_id: threadId || null,
      alignment_state: alignmentState || null,
      created_at: now,
      updated_at: now,
    };

    await writeDelivery(delivery);
    await writeJSON(deliveryFile(id, 'feedback.json'), []);
    await writeJSON(deliveryFile(id, 'drafts.json'), []);
    await appendIndex(delivery);

    broadcast('new_delivery', mapIndexEntry(delivery));

    return delivery;
  }

  async function upsertAlignment({ title, content, metadata, agent_session_id: agentSessionId, thread_id: threadId }) {
    if (!agentSessionId || !threadId) {
      return {
        error: {
          code: 'INVALID_REQUEST',
          message: 'agent_session_id and thread_id are required for alignment',
        },
      };
    }

    const replaced = await endActiveAlignment(agentSessionId, null, 'canceled', 'replaced_by_new_alignment');

    const delivery = await createDeliveryRecord({
      mode: 'alignment',
      title,
      content,
      metadata,
      agentSessionId,
      threadId,
      alignmentState: 'active',
    });

    const now = new Date().toISOString();
    await writeJSON(activeAlignmentPath(agentSessionId), {
      agent_session_id: agentSessionId,
      thread_id: threadId,
      delivery_id: delivery.id,
      status: 'active',
      created_at: now,
      last_heartbeat_at: now,
    });

    return {
      delivery,
      replaced_delivery_id: replaced.delivery_id || null,
    };
  }

  function hydrateDelivery(deliveryId) {
    const delivery = readDelivery(deliveryId);
    if (!delivery) return null;

    const feedback = readDeliveryFeedback(deliveryId);
    const drafts = readDeliveryDrafts(deliveryId);

    return {
      ...delivery,
      feedback,
      drafts,
      pending_feedback_count: feedback.filter((item) => item.handled === false).length,
    };
  }

  function readSettings() {
    const stored = readJSONObject(settingsPath);
    if (!stored) return DEFAULT_SETTINGS;

    return {
      platform: {
        ...DEFAULT_SETTINGS.platform,
        ...(stored.platform || {}),
      },
    };
  }

  // Health
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: '2.0.0',
    });
  });

  // Create delivery
  app.post('/api/deliveries', async (req, res) => {
    try {
      const {
        mode,
        title,
        content,
        metadata,
        agent_session_id: agentSessionId,
        thread_id: threadId,
      } = req.body;

      if (!mode || !title || !content) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing required fields: mode, title, content' },
        });
      }

      if (!DELIVERY_MODES.includes(mode)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `mode must be one of: ${DELIVERY_MODES.join(', ')}`,
          },
        });
      }

      if (!ensureUiSpecContent(content)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'content must be { type: "ui_spec", ui_spec: {...} }',
          },
        });
      }

      if (mode === 'alignment') {
        const result = await upsertAlignment({
          title,
          content,
          metadata,
          agent_session_id: agentSessionId,
          thread_id: threadId,
        });

        if (result.error) {
          return res.status(400).json({ error: result.error });
        }

        const port = app.get('port') || 3847;
        return res.status(201).json({
          id: result.delivery.id,
          url: `http://localhost:${port}/d/${result.delivery.id}`,
          replaced_delivery_id: result.replaced_delivery_id,
        });
      }

      const delivery = await createDeliveryRecord({
        mode,
        title,
        content,
        metadata,
      });

      const port = app.get('port') || 3847;
      res.status(201).json({
        id: delivery.id,
        url: `http://localhost:${port}/d/${delivery.id}`,
      });
    } catch (err) {
      console.error('Error creating delivery:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // List deliveries
  app.get('/api/deliveries', (req, res) => {
    try {
      let entries = readJSONArray(indexPath);
      const { mode, status, limit, offset, agent_session_id: agentSessionId } = req.query;

      if (mode) entries = entries.filter((item) => item.mode === mode);
      if (status) entries = entries.filter((item) => item.status === status);
      if (agentSessionId) entries = entries.filter((item) => item.agent_session_id === agentSessionId);

      const total = entries.length;
      const off = parseInt(offset, 10) || 0;
      const lim = parseInt(limit, 10) || 50;

      const deliveries = entries
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(off, off + lim);

      res.json({ deliveries, total });
    } catch (err) {
      console.error('Error listing deliveries:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Get delivery
  app.get('/api/deliveries/:id', (req, res) => {
    try {
      const delivery = hydrateDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` },
        });
      }

      res.json(delivery);
    } catch (err) {
      console.error('Error getting delivery:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Save draft feedback (sidebar staging)
  app.post('/api/deliveries/:id/feedback/draft', async (req, res) => {
    try {
      const delivery = readDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` },
        });
      }

      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'items must be an array' },
        });
      }

      const now = new Date().toISOString();
      const drafts = items.map((item) => normalizeFeedbackDraftItem(item, now));
      await writeJSON(deliveryFile(req.params.id, 'drafts.json'), drafts);

      res.status(200).json({
        delivery_id: req.params.id,
        count: drafts.length,
      });
    } catch (err) {
      console.error('Error saving feedback draft:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Commit feedback from sidebar
  app.post('/api/deliveries/:id/feedback/commit', async (req, res) => {
    try {
      const deliveryId = req.params.id;
      const delivery = readDelivery(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${deliveryId} not found` },
        });
      }

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'items must be a non-empty array',
          },
        });
      }

      const now = new Date().toISOString();
      const newFeedbackItems = items.map((item) => normalizeFeedbackItem(item, now));
      const feedbackPath = deliveryFile(deliveryId, 'feedback.json');

      await updateJSON(
        feedbackPath,
        (existing) => [...existing, ...newFeedbackItems],
        []
      );

      await writeJSON(deliveryFile(deliveryId, 'drafts.json'), []);

      const updatedDelivery = await recalcDeliveryStatus(deliveryId);
      const indexEntry = mapIndexEntry(updatedDelivery);

      broadcast('feedback_received', {
        delivery_id: deliveryId,
        count: newFeedbackItems.length,
      });
      broadcast('update_delivery', indexEntry);

      res.status(201).json({
        delivery_id: deliveryId,
        feedback_ids: newFeedbackItems.map((item) => item.id),
        status: updatedDelivery.status,
      });
    } catch (err) {
      console.error('Error committing feedback:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Resolve committed feedback entries
  app.post('/api/deliveries/:id/feedback/resolve', async (req, res) => {
    try {
      const deliveryId = req.params.id;
      const delivery = readDelivery(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${deliveryId} not found` },
        });
      }

      const { feedback_ids: feedbackIds, handled_by: handledBy } = req.body;
      if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'feedback_ids must be a non-empty array',
          },
        });
      }

      const now = new Date().toISOString();
      let resolvedCount = 0;

      const feedbackPath = deliveryFile(deliveryId, 'feedback.json');
      await updateJSON(
        feedbackPath,
        (items) => items.map((item) => {
          if (!feedbackIds.includes(item.id) || item.handled === true) {
            return item;
          }

          resolvedCount += 1;
          return {
            ...item,
            handled: true,
            handled_at: now,
            handled_by: handledBy || 'agent',
          };
        }),
        []
      );

      const updatedDelivery = await recalcDeliveryStatus(deliveryId);
      const indexEntry = mapIndexEntry(updatedDelivery);

      broadcast('update_delivery', indexEntry);

      res.status(200).json({
        delivery_id: deliveryId,
        resolved_count: resolvedCount,
        status: updatedDelivery.status,
      });
    } catch (err) {
      console.error('Error resolving feedback:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Backward-agnostic annotation endpoint (stored as draft annotation item)
  app.post('/api/deliveries/:id/annotate', async (req, res) => {
    try {
      const deliveryId = req.params.id;
      const delivery = readDelivery(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${deliveryId} not found` },
        });
      }

      const { content, target } = req.body;
      if (!content) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'content is required' },
        });
      }

      const now = new Date().toISOString();
      const draftItem = normalizeFeedbackDraftItem(
        {
          kind: 'annotation',
          payload: { text: content },
          target: target || null,
        },
        now
      );

      await updateJSON(
        deliveryFile(deliveryId, 'drafts.json'),
        (items) => [...items, draftItem],
        []
      );

      res.status(201).json({
        id: draftItem.id,
        delivery_id: deliveryId,
      });
    } catch (err) {
      console.error('Error adding annotation draft:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Upsert active alignment (unique per session)
  app.post('/api/alignment/upsert', async (req, res) => {
    try {
      const { title, content, metadata, agent_session_id: agentSessionId, thread_id: threadId } = req.body;

      if (!title || !content || !ensureUiSpecContent(content)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'title and content(ui_spec) are required',
          },
        });
      }

      const result = await upsertAlignment({
        title,
        content,
        metadata,
        agent_session_id: agentSessionId,
        thread_id: threadId,
      });

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const port = app.get('port') || 3847;
      res.status(201).json({
        id: result.delivery.id,
        url: `http://localhost:${port}/d/${result.delivery.id}`,
        replaced_delivery_id: result.replaced_delivery_id,
        thread_id: threadId,
      });
    } catch (err) {
      console.error('Error upserting alignment:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Get current active alignment for a session
  app.get('/api/alignment/active', (req, res) => {
    try {
      const agentSessionId = req.query.agent_session_id;
      if (!agentSessionId) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'agent_session_id is required' },
        });
      }

      const activeRecord = readJSONObject(activeAlignmentPath(agentSessionId));
      if (!activeRecord) {
        return res.status(200).json({ active: null });
      }

      const delivery = hydrateDelivery(activeRecord.delivery_id);
      if (!delivery) {
        return res.status(200).json({ active: null });
      }

      const pendingFeedback = delivery.feedback.filter((item) => item.handled === false);

      res.status(200).json({
        active: {
          ...delivery,
          thread_id: activeRecord.thread_id,
          last_heartbeat_at: activeRecord.last_heartbeat_at,
        },
        pending_feedback_count: pendingFeedback.length,
        pending_feedback: pendingFeedback,
      });
    } catch (err) {
      console.error('Error getting active alignment:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Alignment thread heartbeat
  app.post('/api/alignment/heartbeat', async (req, res) => {
    try {
      const { agent_session_id: agentSessionId, thread_id: threadId } = req.body;

      if (!agentSessionId || !threadId) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'agent_session_id and thread_id are required',
          },
        });
      }

      const activePath = activeAlignmentPath(agentSessionId);
      const activeRecord = readJSONObject(activePath);
      if (!activeRecord) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'No active alignment found for session' },
        });
      }

      if (activeRecord.thread_id !== threadId) {
        return res.status(409).json({
          error: { code: 'THREAD_MISMATCH', message: 'thread_id does not match active alignment' },
        });
      }

      const now = new Date().toISOString();
      activeRecord.last_heartbeat_at = now;
      await writeJSON(activePath, activeRecord);

      res.status(200).json({ status: 'ok', last_heartbeat_at: now });
    } catch (err) {
      console.error('Error in alignment heartbeat:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Cancel active alignment (thread close / timeout / interrupt)
  app.post('/api/alignment/cancel', async (req, res) => {
    try {
      const { agent_session_id: agentSessionId, thread_id: threadId, reason } = req.body;

      if (!agentSessionId) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'agent_session_id is required' },
        });
      }

      const result = await endActiveAlignment(
        agentSessionId,
        threadId || null,
        'canceled',
        reason || 'thread_closed'
      );

      if (result.status === 'error') {
        return res.status(409).json({
          error: { code: result.code, message: result.message },
        });
      }

      res.status(200).json(result);
    } catch (err) {
      console.error('Error canceling alignment:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Resolve active alignment (agent received user confirmation)
  app.post('/api/alignment/resolve', async (req, res) => {
    try {
      const {
        agent_session_id: agentSessionId,
        thread_id: threadId,
        delivery_id: deliveryId,
      } = req.body;

      if (!agentSessionId) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'agent_session_id is required' },
        });
      }

      const activeRecord = readJSONObject(activeAlignmentPath(agentSessionId));
      if (!activeRecord) {
        return res.status(200).json({ status: 'no_active' });
      }

      if (deliveryId && activeRecord.delivery_id !== deliveryId) {
        return res.status(409).json({
          error: {
            code: 'DELIVERY_MISMATCH',
            message: 'delivery_id does not match active alignment',
          },
        });
      }

      const result = await endActiveAlignment(
        agentSessionId,
        threadId || null,
        'resolved',
        'agent_received_feedback'
      );

      if (result.status === 'error') {
        return res.status(409).json({
          error: { code: result.code, message: result.message },
        });
      }

      res.status(200).json(result);
    } catch (err) {
      console.error('Error resolving alignment:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = readSettings();
      await writeJSON(settingsPath, settings);
      res.status(200).json(settings);
    } catch (err) {
      console.error('Error reading settings:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const current = readSettings();
      const input = req.body || {};

      const next = {
        platform: {
          ...current.platform,
          ...(input.platform || {}),
        },
      };

      await writeJSON(settingsPath, next);
      broadcast('settings_updated', next);

      res.status(200).json(next);
    } catch (err) {
      console.error('Error updating settings:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Design tokens
  app.get('/api/design-tokens', (req, res) => {
    const tokensPath = path.join(dataDir, 'design', 'tokens.json');
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      res.status(200).json(tokens);
    } catch (err) {
      console.error('Error reading tokens.json:', err.message);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Invalid design tokens' },
      });
    }
  });

  // Validate constants at startup (defensive)
  if (!DELIVERY_STATUSES.includes('normal') || !ALIGNMENT_STATES.includes('active')) {
    throw new Error('Invalid status configuration');
  }
}

module.exports = { setupRoutes };
