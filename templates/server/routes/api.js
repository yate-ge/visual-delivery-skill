const fs = require('fs');
const path = require('path');
const { generateId } = require('../lib/ids');
const { writeJSON, readJSONArray, readJSONObject, updateJSON } = require('../lib/store');
const { broadcast } = require('../lib/ws');

function setupRoutes(app, dataDir) {
  const indexPath = path.join(dataDir, 'data', 'index.json');
  const deliveriesDir = path.join(dataDir, 'data', 'deliveries');

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: '1.0.0'
    });
  });

  // Create delivery
  app.post('/api/deliveries', async (req, res) => {
    try {
      const { mode, title, content, feedback_schema } = req.body;

      // Validate required fields
      if (!mode || !title || !content) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing required fields: mode, title, content' }
        });
      }
      if (!['passive', 'interactive', 'blocking'].includes(mode)) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'mode must be "passive", "interactive", or "blocking"' }
        });
      }
      if ((mode === 'interactive' || mode === 'blocking') && !feedback_schema) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: `feedback_schema is required for ${mode} mode` }
        });
      }

      const id = generateId('d');
      const now = new Date().toISOString();
      const status = mode === 'passive' ? 'delivered' : 'awaiting_feedback';

      // Create per-delivery directory
      const deliveryDir = path.join(deliveriesDir, id);
      fs.mkdirSync(deliveryDir, { recursive: true });

      // Write delivery.json
      const delivery = {
        id, mode, status, title, content,
        feedback_schema: feedback_schema || null,
        created_at: now,
        completed_at: null
      };
      fs.writeFileSync(path.join(deliveryDir, 'delivery.json'), JSON.stringify(delivery, null, 2));

      // Initialize annotations.json and feedback.json
      fs.writeFileSync(path.join(deliveryDir, 'annotations.json'), '[]');
      fs.writeFileSync(path.join(deliveryDir, 'feedback.json'), '[]');

      // Create session for blocking mode
      let sessionId = null;
      if (mode === 'blocking') {
        sessionId = generateId('s');
        const session = {
          id: sessionId,
          status: 'waiting',
          response: null,
          created_at: now,
          timeout_at: new Date(Date.now() + 300000).toISOString(),  // 5 minutes
          responded_at: null
        };
        fs.writeFileSync(path.join(deliveryDir, 'session.json'), JSON.stringify(session, null, 2));
      }

      // Append to index.json
      const indexEntry = { id, mode, status, title, created_at: now, completed_at: null };
      await updateJSON(indexPath, (entries) => {
        entries.push(indexEntry);
        return entries;
      });

      // Broadcast new delivery
      broadcast('new_delivery', indexEntry);

      const port = app.get('port') || 3847;
      const result = { id, url: `http://localhost:${port}/d/${id}` };
      if (sessionId) result.session_id = sessionId;

      res.status(201).json(result);
    } catch (err) {
      console.error('Error creating delivery:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // List deliveries
  app.get('/api/deliveries', (req, res) => {
    try {
      let entries = readJSONArray(indexPath);
      const { mode, status, limit, offset } = req.query;

      if (mode) entries = entries.filter(d => d.mode === mode);
      if (status) entries = entries.filter(d => d.status === status);

      const total = entries.length;
      const off = parseInt(offset) || 0;
      const lim = parseInt(limit) || 50;
      entries = entries.slice(off, off + lim);

      res.json({ deliveries: entries, total });
    } catch (err) {
      console.error('Error listing deliveries:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // Get single delivery (full data with annotations and feedback)
  app.get('/api/deliveries/:id', (req, res) => {
    try {
      const deliveryDir = path.join(deliveriesDir, req.params.id);
      const delivery = readJSONObject(path.join(deliveryDir, 'delivery.json'));

      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` }
        });
      }

      // Assemble full response with annotations and feedback
      delivery.annotations = readJSONArray(path.join(deliveryDir, 'annotations.json'));
      delivery.feedback = readJSONArray(path.join(deliveryDir, 'feedback.json'));

      res.json(delivery);
    } catch (err) {
      console.error('Error getting delivery:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // Add annotation
  app.post('/api/deliveries/:id/annotate', async (req, res) => {
    try {
      const deliveryDir = path.join(deliveriesDir, req.params.id);
      const delivery = readJSONObject(path.join(deliveryDir, 'delivery.json'));

      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` }
        });
      }

      const { type, content, target } = req.body;
      if (!type || !content) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing required fields: type, content' }
        });
      }

      const annotationId = generateId('a');
      const annotation = {
        id: annotationId,
        type,
        content,
        target: target || null,
        created_at: new Date().toISOString()
      };

      const annotationsPath = path.join(deliveryDir, 'annotations.json');
      await updateJSON(annotationsPath, (items) => {
        items.push(annotation);
        return items;
      });

      res.status(201).json({ id: annotationId, delivery_id: req.params.id });
    } catch (err) {
      console.error('Error adding annotation:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // Submit feedback
  app.post('/api/deliveries/:id/feedback', async (req, res) => {
    try {
      const deliveryDir = path.join(deliveriesDir, req.params.id);
      const delivery = readJSONObject(path.join(deliveryDir, 'delivery.json'));

      if (!delivery) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Delivery ${req.params.id} not found` }
        });
      }

      const { values } = req.body;
      if (!values) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing required field: values' }
        });
      }

      const feedbackId = generateId('f');
      const now = new Date().toISOString();
      const feedback = { id: feedbackId, values, created_at: now };

      // Append feedback
      const feedbackPath = path.join(deliveryDir, 'feedback.json');
      await updateJSON(feedbackPath, (items) => {
        items.push(feedback);
        return items;
      });

      // Update delivery status
      delivery.status = 'completed';
      delivery.completed_at = now;
      await writeJSON(path.join(deliveryDir, 'delivery.json'), delivery);

      // Update session if blocking
      const sessionPath = path.join(deliveryDir, 'session.json');
      const session = readJSONObject(sessionPath);
      if (session) {
        session.status = 'responded';
        session.response = values;
        session.responded_at = now;
        await writeJSON(sessionPath, session);
      }

      // Update index.json
      await updateJSON(indexPath, (entries) => {
        const entry = entries.find(e => e.id === req.params.id);
        if (entry) {
          entry.status = 'completed';
          entry.completed_at = now;
        }
        return entries;
      });

      // Broadcast
      broadcast('feedback_received', {
        delivery_id: req.params.id,
        feedback_id: feedbackId
      });
      broadcast('update_delivery', {
        id: req.params.id,
        status: 'completed'
      });

      res.status(201).json({ id: feedbackId, delivery_id: req.params.id });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // Get session status (blocking mode)
  app.get('/api/sessions/:id', (req, res) => {
    try {
      // Search all deliveries for the session
      const entries = readJSONArray(indexPath);
      for (const entry of entries) {
        const sessionPath = path.join(deliveriesDir, entry.id, 'session.json');
        const session = readJSONObject(sessionPath);
        if (session && session.id === req.params.id) {
          return res.json(session);
        }
      }
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Session ${req.params.id} not found` }
      });
    } catch (err) {
      console.error('Error getting session:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message }
      });
    }
  });

  // Get design tokens
  app.get('/api/design-tokens', (req, res) => {
    const tokensPath = path.join(dataDir, 'design', 'tokens.json');
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      res.json(tokens);
    } catch (err) {
      console.error('Error reading tokens.json:', err.message);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Invalid design tokens' } });
    }
  });
}

module.exports = { setupRoutes };
