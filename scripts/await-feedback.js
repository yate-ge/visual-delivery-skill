#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PORT = 3847;
const POLL_INTERVAL_SEC = 2;
const HEARTBEAT_INTERVAL_MS = 2000;
const TIMEOUT_SEC = 300;

function log(msg) {
  process.stderr.write(`[visual-delivery] ${msg}\n`);
}

function outputJSON(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i];
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}

function randomThreadId() {
  return `t_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonInput(raw, name) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in --${name}`);
  }
}

function loadUiSpec(args) {
  if (args['ui-spec']) {
    return parseJsonInput(args['ui-spec'], 'ui-spec');
  }

  if (args['ui-spec-file']) {
    const filePath = path.resolve(args['ui-spec-file']);
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseJsonInput(raw, 'ui-spec-file');
  }

  return {
    version: '2.0',
    layout: {
      type: 'single-column',
      sections: ['context', 'decision'],
    },
    components: [
      {
        id: 'context-summary',
        type: 'markdown',
        title: 'Alignment Context',
        content: 'Please review and provide your confirmation in the feedback sidebar.',
      },
      {
        id: 'decision-options',
        type: 'decision_form',
        title: 'Need Your Confirmation',
        fields: [
          {
            id: 'decision',
            type: 'select',
            label: 'Decision',
            options: ['Approve', 'Request Changes'],
            default: 'Approve',
          },
          {
            id: 'notes',
            type: 'textarea',
            label: 'Notes',
            placeholder: 'Add comments for the agent...',
          },
        ],
      },
    ],
    sidebar_contract: {
      confirm_submit_label: 'Confirm Submit',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const port = parseInt(args.port, 10) || PORT;
  const timeoutSec = parseInt(args.timeout, 10) || TIMEOUT_SEC;

  const title = args.title;
  const agentSessionId = args['agent-session-id'];
  const threadId = args['thread-id'] || randomThreadId();

  if (!title) {
    outputJSON({ status: 'error', message: 'Missing required argument: --title' });
    process.exit(1);
  }

  if (!agentSessionId) {
    outputJSON({ status: 'error', message: 'Missing required argument: --agent-session-id' });
    process.exit(1);
  }

  let uiSpec;
  let metadata;
  try {
    uiSpec = loadUiSpec(args);
    metadata = parseJsonInput(args.metadata || '{}', 'metadata') || {};
  } catch (err) {
    outputJSON({ status: 'error', message: err.message });
    process.exit(1);
  }

  try {
    await fetchWithRetry(`http://localhost:${port}/health`);
  } catch {
    const skillDir = path.resolve(__dirname, '..');
    outputJSON({
      status: 'error',
      message: `Server not running at localhost:${port}. Run: node ${skillDir}/scripts/start.js`,
    });
    process.exit(1);
  }

  log(`Upserting alignment: "${title}"`);
  const upsertRes = await fetchWithRetry(`http://localhost:${port}/api/alignment/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      agent_session_id: agentSessionId,
      thread_id: threadId,
      metadata,
      content: {
        type: 'ui_spec',
        ui_spec: uiSpec,
      },
    }),
  });

  if (!upsertRes.ok) {
    const errBody = await upsertRes.json();
    outputJSON({
      status: 'error',
      message: errBody.error?.message || 'Failed to upsert alignment',
    });
    process.exit(1);
  }

  const upsertData = await upsertRes.json();
  const deliveryId = upsertData.id;
  const deliveryUrl = upsertData.url;

  log(`Waiting for alignment feedback at ${deliveryUrl}`);
  log(`Session: ${agentSessionId} | Thread: ${threadId}`);
  log(`Timeout: ${Math.round(timeoutSec / 60)} minutes`);

  let heartbeatTimer = null;
  let finalized = false;

  const sendHeartbeat = async () => {
    try {
      await fetch(`http://localhost:${port}/api/alignment/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_session_id: agentSessionId,
          thread_id: threadId,
        }),
      });
    } catch {
      // Ignore transient heartbeat errors; polling loop is source of truth.
    }
  };

  const cancelAlignment = async (reason) => {
    try {
      await fetch(`http://localhost:${port}/api/alignment/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_session_id: agentSessionId,
          thread_id: threadId,
          reason,
        }),
      });
    } catch {
      // Best effort cleanup.
    }
  };

  const resolveAlignment = async () => {
    try {
      await fetch(`http://localhost:${port}/api/alignment/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_session_id: agentSessionId,
          thread_id: threadId,
          delivery_id: deliveryId,
        }),
      });
    } catch {
      // Best effort resolve.
    }
  };

  const cleanupAndExit = async (exitCode, payload, opts = {}) => {
    if (finalized) return;
    finalized = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (opts.cancelReason) {
      await cancelAlignment(opts.cancelReason);
    }

    outputJSON(payload);
    process.exit(exitCode);
  };

  process.on('SIGINT', async () => {
    await cleanupAndExit(0, {
      status: 'canceled',
      delivery_id: deliveryId,
      url: deliveryUrl,
      message: 'Alignment canceled because wait thread was interrupted.',
    }, { cancelReason: 'thread_interrupted' });
  });

  process.on('SIGTERM', async () => {
    await cleanupAndExit(0, {
      status: 'canceled',
      delivery_id: deliveryId,
      url: deliveryUrl,
      message: 'Alignment canceled because wait thread was terminated.',
    }, { cancelReason: 'thread_terminated' });
  });

  heartbeatTimer = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
  await sendHeartbeat();

  const deadline = Date.now() + timeoutSec * 1000;

  while (Date.now() < deadline) {
    let activePayload;

    try {
      const activeRes = await fetchWithRetry(
        `http://localhost:${port}/api/alignment/active?agent_session_id=${encodeURIComponent(agentSessionId)}`
      );

      if (!activeRes.ok) {
        await sleep(POLL_INTERVAL_SEC * 1000);
        continue;
      }

      activePayload = await activeRes.json();
    } catch {
      await sleep(POLL_INTERVAL_SEC * 1000);
      continue;
    }

    if (!activePayload.active) {
      await cleanupAndExit(0, {
        status: 'canceled',
        delivery_id: deliveryId,
        url: deliveryUrl,
        message: 'Alignment is no longer active in this agent session.',
      });
      return;
    }

    if (activePayload.active.id !== deliveryId) {
      await cleanupAndExit(0, {
        status: 'replaced',
        delivery_id: deliveryId,
        url: deliveryUrl,
        message: `Alignment replaced by newer alignment ${activePayload.active.id}`,
      });
      return;
    }

    const pendingCount = activePayload.pending_feedback_count || 0;
    if (pendingCount > 0) {
      await resolveAlignment();
      await cleanupAndExit(0, {
        status: 'responded',
        delivery_id: deliveryId,
        response: activePayload.pending_feedback,
      });
      return;
    }

    await sleep(POLL_INTERVAL_SEC * 1000);
  }

  await cleanupAndExit(0, {
    status: 'timeout',
    delivery_id: deliveryId,
    url: deliveryUrl,
    message: `No response received within ${Math.round(timeoutSec / 60)} minutes. Alignment canceled until thread restarts.`,
  }, { cancelReason: 'timeout' });
}

main().catch(async (err) => {
  log(`Error: ${err.message}`);
  outputJSON({ status: 'error', message: err.message });
  process.exit(1);
});
