const fs = require('fs');
const path = require('path');
const { generateId } = require('../lib/ids');
const { writeJSON, readJSONArray, readJSONObject, updateJSON } = require('../lib/store');
const { broadcast } = require('../lib/ws');
const { nowLocalISO, ensureLocalISO } = require('../lib/time');

const DELIVERY_MODES = ['task_delivery', 'alignment'];
const DELIVERY_STATUSES = ['normal', 'pending_feedback'];
const ALIGNMENT_STATES = ['active', 'resolved', 'canceled'];
const SUPPORTED_LANGUAGES = ['zh', 'en'];

const DEFAULT_SETTINGS = {
  language: null,
  language_explicit: false,
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

function cleanText(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text === 'Untitled Project' || text === 'Untitled Task') {
    return '';
  }
  return text;
}

function normalizeMetadata(metadata = {}, fallback = {}) {
  const projectName = cleanText(metadata.project_name) || cleanText(fallback.project_name);
  const taskName = cleanText(metadata.task_name) || cleanText(fallback.task_name);
  const audience = cleanText(metadata.audience) || 'stakeholder';

  return {
    project_name: projectName || null,
    task_name: taskName || null,
    generated_at: ensureLocalISO(metadata.generated_at, nowLocalISO()),
    audience,
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
  const projectDirName = cleanText(path.basename(path.resolve(dataDir, '..'))) || 'Project';

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

  function readDeliveryExecutionEvents(deliveryId) {
    return readJSONArray(deliveryFile(deliveryId, 'execution-events.json'));
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
    delivery.updated_at = nowLocalISO();

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

  function truncateText(text, max = 120) {
    if (typeof text !== 'string') return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function summarizeFeedbackPayload(item) {
    if (!item || !item.payload) return '';
    const payload = item.payload;

    if (typeof payload.text === 'string' && payload.text.trim()) {
      return truncateText(payload.text.trim());
    }

    if (typeof payload.selected_text === 'string' && payload.selected_text.trim()) {
      return truncateText(`Selection: ${payload.selected_text.trim()}`);
    }

    if (payload.action === 'review_decision') {
      const itemId = payload.item_id || 'unknown';
      const decision = payload.decision || 'unknown';
      const notes = typeof payload.notes === 'string' && payload.notes.trim()
        ? ` (${truncateText(payload.notes.trim(), 60)})`
        : '';
      return `Review decision ${itemId}: ${decision}${notes}`;
    }

    return truncateText(JSON.stringify(payload));
  }

  function normalizeExecutionEvent(event, now) {
    const allowedStages = ['queued', 'in_progress', 'completed', 'failed', 'info'];
    const stage = allowedStages.includes(event.stage) ? event.stage : 'info';

    return {
      id: event.id || generateId('e'),
      feedback_id: event.feedback_id || null,
      stage,
      message: cleanText(event.message) || 'Execution event',
      actor: cleanText(event.actor) || 'system',
      meta: event.meta && typeof event.meta === 'object' ? event.meta : {},
      created_at: event.created_at || now,
    };
  }

  async function appendExecutionEvents(deliveryId, rawEvents) {
    const delivery = readDelivery(deliveryId);
    if (!delivery) return [];

    const now = nowLocalISO();
    const events = (Array.isArray(rawEvents) ? rawEvents : [rawEvents])
      .filter((item) => item && typeof item === 'object')
      .map((event) => normalizeExecutionEvent(event, now));

    if (events.length === 0) return [];

    await updateJSON(
      deliveryFile(deliveryId, 'execution-events.json'),
      (existing) => [...existing, ...events],
      []
    );

    delivery.updated_at = now;
    await writeDelivery(delivery);
    const indexEntry = await updateIndex(delivery);

    broadcast('update_delivery', indexEntry);
    broadcast('execution_events_updated', {
      delivery_id: deliveryId,
      count: events.length,
      latest_event_id: events[events.length - 1].id,
    });

    return events;
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

    const now = nowLocalISO();
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
    const now = nowLocalISO();

    fs.mkdirSync(deliveryDir(id), { recursive: true });

    const delivery = {
      id,
      mode,
      status: 'normal',
      title,
      content,
      metadata: normalizeMetadata(metadata, {
        project_name: projectDirName,
        task_name: title,
      }),
      agent_session_id: agentSessionId || null,
      thread_id: threadId || null,
      alignment_state: alignmentState || null,
      created_at: now,
      updated_at: now,
    };

    await writeDelivery(delivery);
    await writeJSON(deliveryFile(id, 'feedback.json'), []);
    await writeJSON(deliveryFile(id, 'drafts.json'), []);
    await writeJSON(deliveryFile(id, 'execution-events.json'), []);
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

    const now = nowLocalISO();
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

    delivery.metadata = normalizeMetadata(delivery.metadata, {
      project_name: projectDirName,
      task_name: delivery.title,
      audience: delivery.metadata?.audience,
    });

    const feedback = readDeliveryFeedback(deliveryId);
    const drafts = readDeliveryDrafts(deliveryId);
    const executionEvents = readDeliveryExecutionEvents(deliveryId);

    return {
      ...delivery,
      feedback,
      drafts,
      execution_events: executionEvents,
      pending_feedback_count: feedback.filter((item) => item.handled === false).length,
    };
  }

  function readSettings() {
    const stored = readJSONObject(settingsPath);
    if (!stored) return DEFAULT_SETTINGS;

    const languageExplicit = stored.language_explicit === true;
    const language = languageExplicit && SUPPORTED_LANGUAGES.includes(stored.language)
      ? stored.language
      : DEFAULT_SETTINGS.language;

    return {
      language,
      language_explicit: languageExplicit,
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

  // List execution events for a delivery
  app.get('/api/deliveries/:id/execution-events', (req, res) => {
    try {
      const delivery = readDelivery(req.params.id);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` },
        });
      }

      const events = readDeliveryExecutionEvents(req.params.id);
      res.json({
        delivery_id: req.params.id,
        events,
      });
    } catch (err) {
      console.error('Error getting execution events:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });

  // Append execution events for a delivery
  app.post('/api/deliveries/:id/execution-events', async (req, res) => {
    try {
      const deliveryId = req.params.id;
      const delivery = readDelivery(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${deliveryId} not found` },
        });
      }

      const body = req.body || {};
      const inputEvents = Array.isArray(body.events)
        ? body.events
        : body.event
          ? [body.event]
          : [body];

      const appended = await appendExecutionEvents(deliveryId, inputEvents);
      if (appended.length === 0) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'No valid execution events provided' },
        });
      }

      res.status(201).json({
        delivery_id: deliveryId,
        event_ids: appended.map((item) => item.id),
        count: appended.length,
      });
    } catch (err) {
      console.error('Error appending execution events:', err);
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

      const now = nowLocalISO();
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

      const now = nowLocalISO();
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

      await appendExecutionEvents(
        deliveryId,
        newFeedbackItems.map((item) => ({
          feedback_id: item.id,
          stage: 'queued',
          actor: 'user',
          message: `Feedback submitted (${item.kind}): ${summarizeFeedbackPayload(item) || 'No details'}`,
          meta: {
            kind: item.kind,
            target: item.target || null,
          },
        }))
      );

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

      const now = nowLocalISO();
      let resolvedCount = 0;
      const resolvedItems = [];

      const feedbackPath = deliveryFile(deliveryId, 'feedback.json');
      await updateJSON(
        feedbackPath,
        (items) => items.map((item) => {
          if (!feedbackIds.includes(item.id) || item.handled === true) {
            return item;
          }

          resolvedCount += 1;
          resolvedItems.push(item);
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

      if (resolvedItems.length > 0) {
        await appendExecutionEvents(
          deliveryId,
          resolvedItems.map((item) => ({
            feedback_id: item.id,
            stage: 'completed',
            actor: handledBy || 'agent',
            message: `Feedback resolved (${item.kind}): ${summarizeFeedbackPayload(item) || 'No details'}`,
            meta: {
              handled_by: handledBy || 'agent',
            },
          }))
        );
      }

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

      const now = nowLocalISO();
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

      const now = nowLocalISO();
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
      const requestedLanguage = input.language;
      const hasLanguageInput = Object.prototype.hasOwnProperty.call(input, 'language');
      const language = hasLanguageInput && SUPPORTED_LANGUAGES.includes(requestedLanguage)
        ? requestedLanguage
        : current.language;
      const languageExplicit = hasLanguageInput
        ? SUPPORTED_LANGUAGES.includes(requestedLanguage)
        : current.language_explicit === true;

      const next = {
        language,
        language_explicit: languageExplicit,
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
