#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PORT = 3847;
const POLL_INTERVAL = 2;     // Seconds between polls
const TIMEOUT = 300;         // 5 minutes default

function log(msg) {
  process.stderr.write(`[visual-delivery] ${msg}\n`);
}

function outputJSON(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[key] = argv[++i];
      } else {
        args[key] = true;
      }
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
      const delay = 1000 * Math.pow(2, attempt);  // 1s, 2s, 4s
      await sleep(delay);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const port = parseInt(args['port']) || PORT;
  const timeout = parseInt(args['timeout']) || TIMEOUT;
  const title = args['title'];
  const schema = args['schema'];
  const contentArg = args['content'] || '';
  const contentFile = args['content-file'];

  // Validate required args
  if (!title) {
    outputJSON({ status: 'error', message: 'Missing required argument: --title' });
    process.exit(1);
  }
  if (!schema) {
    outputJSON({ status: 'error', message: 'Missing required argument: --schema' });
    process.exit(1);
  }

  // Validate schema JSON
  let parsedSchema;
  try {
    parsedSchema = JSON.parse(schema);
  } catch {
    outputJSON({ status: 'error', message: 'Invalid JSON in --schema argument' });
    process.exit(1);
  }

  // Check server is running
  try {
    await fetch(`http://localhost:${port}/health`);
  } catch {
    const skillDir = path.resolve(__dirname, '..');
    outputJSON({
      status: 'error',
      message: `Server not running at localhost:${port}. Run: node ${skillDir}/scripts/start.js`
    });
    process.exit(1);
  }

  // Read content
  let content = contentArg;
  if (contentFile) {
    try {
      content = fs.readFileSync(contentFile, 'utf8');
    } catch (err) {
      outputJSON({ status: 'error', message: `Cannot read content file: ${contentFile}` });
      process.exit(1);
    }
  }

  // Create blocking delivery
  log(`Creating blocking delivery: "${title}"`);
  const createRes = await fetchWithRetry(`http://localhost:${port}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'blocking',
      title,
      content: { type: 'markdown', body: content },
      feedback_schema: parsedSchema
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    outputJSON({ status: 'error', message: err.error?.message || 'Failed to create delivery' });
    process.exit(1);
  }

  const { id: deliveryId, url: deliveryUrl, session_id: sessionId } = await createRes.json();

  log(`Waiting for user response at ${deliveryUrl}`);
  log(`(timeout in ${Math.round(timeout / 60)} minutes)`);

  // Poll loop
  const deadline = Date.now() + timeout * 1000;

  while (Date.now() < deadline) {
    try {
      const res = await fetchWithRetry(`http://localhost:${port}/api/sessions/${sessionId}`);
      const session = await res.json();

      if (session.status === 'responded') {
        log('Response received!');
        outputJSON({
          status: 'responded',
          delivery_id: deliveryId,
          response: session.response
        });
        process.exit(0);
      }
    } catch (err) {
      // Transient error, continue polling
    }

    await sleep(POLL_INTERVAL * 1000);
  }

  // Timeout reached
  log(`No response received within ${Math.round(timeout / 60)} minutes.`);
  log(`The delivery is still available at ${deliveryUrl}`);
  log('User can respond later; agent should remind them.');
  outputJSON({
    status: 'timeout',
    delivery_id: deliveryId,
    url: deliveryUrl,
    message: `No response received within ${Math.round(timeout / 60)} minutes. The delivery is still available for feedback.`
  });
  process.exit(0);
}

main().catch(err => {
  log(`Error: ${err.message}`);
  outputJSON({ status: 'error', message: err.message });
  process.exit(1);
});
