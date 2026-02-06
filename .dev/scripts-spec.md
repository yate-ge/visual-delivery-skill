# Scripts Specification

## Design Principle

> "Prefer instructions over scripts unless you need deterministic behavior or external tooling."

Only 3 scripts exist. Each handles logic that is too complex, critical, or
stateful for ad-hoc agent commands.

> **Cross-Platform**: All scripts are Node.js (not bash) to ensure compatibility
> across Windows, macOS, and Linux. Invoked with `node scripts/start.js` etc.

> **UX Principle**: All scripts output human-readable progress messages prefixed
> with `[visual-delivery]` to stderr, and machine-readable JSON to stdout.
> The agent reads stdout JSON; the user sees stderr progress.

## scripts/start.js

**Purpose:** Initialize the work directory (first run) and start the web server.

**Why it's a script:** Template copying, dependency installation, frontend build,
environment detection, process deduplication, tunnel setup. Too complex and too
important to leave to ad-hoc agent commands.

### Input

| Argument | Default | Description |
|----------|---------|-------------|
| `--port` | `3847` | Server port |
| `--data-dir` | `{CWD}/.visual-delivery` | Data directory path |
| `--remote` | (auto-detect) | Force enable remote access |
| `--no-remote` | (auto-detect) | Force disable remote access |

### Output (stdout, JSON)

```json
{
  "status": "started",
  "local_url": "http://localhost:3847",
  "remote_url": null,
  "pid": 12345,
  "first_run": true,
  "design_spec_path": ".visual-delivery/design/design-spec.md"
}
```

If server is already running:
```json
{
  "status": "already_running",
  "local_url": "http://localhost:3847",
  "pid": 12345,
  "first_run": false
}
```

### UX Output (stderr, human-readable)

First run:
```
[visual-delivery] Initializing work directory...
[visual-delivery]   Copying server template...
[visual-delivery]   Copying frontend template...
[visual-delivery]   Generating design specification...
[visual-delivery] Installing server dependencies...
[visual-delivery] Installing frontend dependencies...
[visual-delivery] Building frontend...
[visual-delivery] Starting server...
[visual-delivery] Checking remote access...
[visual-delivery]   cloudflared not found.
[visual-delivery]   Install for remote access: brew install cloudflared
[visual-delivery]   Or: npm install -g cloudflared
[visual-delivery]   Continuing with local access only.
[visual-delivery]
[visual-delivery] Ready!
[visual-delivery]   Local URL:   http://localhost:3847
[visual-delivery]   Design spec: .visual-delivery/design/design-spec.md
[visual-delivery]   Edit design-spec.md or tokens.json to customize the UI.
```

Subsequent runs:
```
[visual-delivery] Starting server...
[visual-delivery] Ready! http://localhost:3847
```

Already running:
```
[visual-delivery] Server already running at http://localhost:3847 (PID 12345)
```

### Logic Flow

```
1. Parse arguments (process.argv)
2. Set DATA_DIR (default: path.join(process.cwd(), '.visual-delivery'))
3. Resolve SKILL_DIR:
   const SKILL_DIR = path.resolve(__dirname, '..');

4. Check if already running:
   a. Read {DATA_DIR}/server.pid
   b. Check if PID is alive:
      try { process.kill(pid, 0); } catch { /* dead */ }
   c. Check if port responds:
      fetch(`http://localhost:${PORT}/health`)
   d. If both OK → output already_running JSON, exit 0
   e. If PID stale → remove PID file, continue

5. Determine if first run:
   const firstRun = !fs.existsSync(path.join(DATA_DIR, 'server'));

6. Initialize work directory (first run):
   a. log('Initializing work directory...')
   b. fs.mkdirSync(path.join(DATA_DIR, 'data', 'deliveries'), { recursive: true })
      fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true })
   c. Initialize index.json as [] if not exists
   d. fs.cpSync(templates/server/, DATA_DIR/server/, { recursive: true })
      log('  Copying server template...')
   e. fs.cpSync(templates/ui/, DATA_DIR/ui/, { recursive: true })
      log('  Copying frontend template...')
   f. fs.cpSync(templates/design/, DATA_DIR/design/, { recursive: true })
      (only if DATA_DIR/design/ not exists)
      log('  Generating design specification...')

7. Install dependencies (if node_modules missing):
   a. If DATA_DIR/server/node_modules not exists:
      log('Installing server dependencies...')
      execSync('npm install --production --silent', { cwd: DATA_DIR/server })
   b. If DATA_DIR/ui/node_modules not exists:
      log('Installing frontend dependencies...')
      execSync('npm install --silent', { cwd: DATA_DIR/ui })

8. Build frontend (if dist/ missing or ui/src newer than dist/):
   log('Building frontend...')
   execSync('npm run build', { cwd: DATA_DIR/ui })

9. Start server:
   log('Starting server...')
   const logFd = fs.openSync(DATA_DIR/logs/server.log, 'a')
   const child = spawn('node', [
     'index.js',
     '--data-dir', DATA_DIR,
     '--port', String(PORT),
     '--ui-dir', path.join(DATA_DIR, 'ui', 'dist')
   ], {
     cwd: path.join(DATA_DIR, 'server'),
     detached: true,
     stdio: ['ignore', logFd, logFd]
   })
   child.unref()
   fs.writeFileSync(DATA_DIR/server.pid, String(child.pid))

10. Wait for server ready:
    Poll fetch(`http://localhost:${PORT}/health`) for up to 15 seconds
    (15s to account for first-run cold start)

11. Handle remote access:
    a. If --remote → enable tunnel
    b. If --no-remote → skip tunnel
    c. If neither:
       - Detect environment (see Environment Detection)
       - If remote environment → enable tunnel
       - If local environment → skip tunnel

12. If tunnel enabled:
    a. Check cloudflared availability:
       - which('cloudflared') or execSync('cloudflared --version')
       - If not found:
         log('  cloudflared not found.')
         log('  Install for remote access: brew install cloudflared')
         log('  Or: npm install -g cloudflared')
         log('  Continuing with local access only.')
         → skip tunnel (NOT an error, continue normally)
    b. If found:
       const tunnelLog = fs.openSync(DATA_DIR/logs/tunnel.log, 'a')
       const tunnel = spawn('cloudflared', [
         'tunnel', '--url', `http://localhost:${PORT}`
       ], { detached: true, stdio: ['ignore', tunnelLog, tunnelLog] })
       tunnel.unref()
       Parse tunnel URL from log output
       fs.writeFileSync(DATA_DIR/tunnel.url, tunnelUrl)
       fs.writeFileSync(DATA_DIR/tunnel.pid, String(tunnel.pid))

13. Output results:
    a. Compose JSON result to stdout
    b. Log summary to stderr:
       log('')
       log('Ready!')
       log(`  Local URL:   http://localhost:${PORT}`)
       if (tunnelUrl) log(`  Remote URL:  ${tunnelUrl}`)
       if (firstRun) {
         log(`  Design spec: ${DATA_DIR}/design/design-spec.md`)
         log('  Edit design-spec.md or tokens.json to customize the UI.')
       }
```

### Environment Detection

```javascript
function isRemoteEnvironment() {
  const env = process.env;
  return !!(
    env.CODESPACE_NAME ||      // GitHub Codespaces
    env.GITPOD_WORKSPACE_URL || // Gitpod
    env.REPL_ID ||             // Replit
    env.SSH_CLIENT ||          // SSH session
    env.SSH_TTY ||             // SSH session
    env.C9_HOSTNAME ||         // AWS Cloud9
    env.CLOUD_SHELL ||         // Google Cloud Shell
    env.CI                     // CI/CD
  );
  // Docker detection: fs.existsSync('/.dockerenv')
}
```

### Cross-Platform Process Management

```javascript
// Check if process is alive (works on Windows, macOS, Linux)
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);  // signal 0 = test existence
    return true;
  } catch {
    return false;
  }
}

// Kill a process (works on Windows, macOS, Linux)
// Node.js translates SIGTERM to TerminateProcess on Windows
function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

// Check if a command exists on PATH
function commandExists(cmd) {
  try {
    execSync(
      process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`,
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}
```

---

## scripts/stop.js

**Purpose:** Stop the server and tunnel processes.

**Why it's a script:** Process cleanup must be reliable and deterministic.

### Input

| Argument | Default | Description |
|----------|---------|-------------|
| `--data-dir` | `{CWD}/.visual-delivery` | Data directory path |

### Output (stderr, human-readable)

```
[visual-delivery] Server stopped (PID 12345)
[visual-delivery] Tunnel stopped (PID 12346)
```

### Output (stdout, JSON)

```json
{
  "status": "stopped",
  "server_pid": 12345,
  "tunnel_pid": 12346
}
```

### Logic Flow

```
1. Parse arguments (process.argv)
2. Set DATA_DIR

3. Stop server:
   const pidFile = path.join(DATA_DIR, 'server.pid')
   if (fs.existsSync(pidFile)) {
     const pid = parseInt(fs.readFileSync(pidFile, 'utf8'))
     if (isProcessAlive(pid)) {
       killProcess(pid)
       log(`Server stopped (PID ${pid})`)
     } else {
       log('Server not running (stale PID file)')
     }
     fs.unlinkSync(pidFile)
   } else {
     log('Server not running')
   }

4. Stop tunnel:
   const tunnelPidFile = path.join(DATA_DIR, 'tunnel.pid')
   if (fs.existsSync(tunnelPidFile)) {
     const pid = parseInt(fs.readFileSync(tunnelPidFile, 'utf8'))
     if (isProcessAlive(pid)) {
       killProcess(pid)
       log(`Tunnel stopped (PID ${pid})`)
     }
     fs.unlinkSync(tunnelPidFile)
     // Clean up tunnel URL
     const urlFile = path.join(DATA_DIR, 'tunnel.url')
     if (fs.existsSync(urlFile)) fs.unlinkSync(urlFile)
   }

5. Output JSON result
```

---

## scripts/await-feedback.js

**Purpose:** Create a blocking delivery and poll until user responds or timeout.

**Why it's a script:** The polling loop must execute as a single process so
the agent's Bash tool call blocks until completion. Cannot be split across
multiple agent turns.

### Input

| Argument | Required | Description |
|----------|----------|-------------|
| `--title` | yes | Delivery title |
| `--schema` | yes | Feedback schema as JSON string |
| `--content` | no | Markdown content (default: empty) |
| `--content-file` | no | Read content from file (alternative to --content) |
| `--timeout` | no | Timeout in seconds (default: 300 = 5 minutes) |
| `--port` | no | Server port (default: 3847) |

### Output (stdout, JSON)

On success (user responded):
```json
{
  "status": "responded",
  "delivery_id": "d_1738850400_003",
  "response": {
    "value": "staging"
  }
}
```

On timeout (NOT an error — gentle reminder for user):
```json
{
  "status": "timeout",
  "delivery_id": "d_1738850400_003",
  "url": "http://localhost:3847/d/d_1738850400_003",
  "message": "No response received within 5 minutes. The delivery is still available for feedback."
}
```

On error:
```json
{
  "status": "error",
  "message": "Server not running at localhost:3847. Run: node {SKILL_DIR}/scripts/start.js"
}
```

### UX Output (stderr)

```
[visual-delivery] Creating blocking delivery: "Choose Deploy Target"
[visual-delivery] Waiting for user response at http://localhost:3847/d/d_...
[visual-delivery] (timeout in 5 minutes)
```

On response:
```
[visual-delivery] Response received!
```

On timeout:
```
[visual-delivery] No response received within 5 minutes.
[visual-delivery] The delivery is still available at http://localhost:3847/d/d_...
[visual-delivery] User can respond later; agent should remind them.
```

### Timeout Behavior

**Important:** Timeout is NOT an error. When timeout occurs:

1. Script exits with code 0 (success)
2. The delivery remains in `awaiting_feedback` status — it is NOT cancelled
3. The JSON output includes `"status": "timeout"` with the delivery URL
4. The agent should inform the user: "No response received within 5 minutes.
   Please visit {url} when you're ready to provide feedback."
5. The agent should NOT retry or create a new blocking delivery
6. The user can still respond at any time — the delivery stays open
7. If the agent needs the response later, it can read
   `data/deliveries/{id}/session.json` to check if the user has since responded

### Logic Flow

```
1. Parse arguments (process.argv)
2. Validate --schema is valid JSON:
   try { JSON.parse(schema) } catch { output error, exit 1 }

3. Check server is running:
   try { await fetch(`http://localhost:${PORT}/health`) }
   catch { output error JSON, exit 1 }

4. Read content from --content or --content-file:
   if (contentFile) content = fs.readFileSync(contentFile, 'utf8')

5. Create blocking delivery:
   log(`Creating blocking delivery: "${title}"`)
   const res = await fetch(`http://localhost:${PORT}/api/deliveries`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       mode: 'blocking',
       title,
       content: { type: 'markdown', body: content || '' },
       feedback_schema: JSON.parse(schema)
     })
   })
   const { id: deliveryId, url: deliveryUrl, session_id: sessionId } = await res.json()

   log(`Waiting for user response at ${deliveryUrl}`)
   log(`(timeout in ${Math.round(timeout / 60)} minutes)`)

6. Poll loop (with timeout):
   const deadline = Date.now() + timeout * 1000

   while (Date.now() < deadline) {
     const res = await fetch(`http://localhost:${PORT}/api/sessions/${sessionId}`)
     const session = await res.json()

     if (session.status === 'responded') {
       log('Response received!')
       outputJSON({
         status: 'responded',
         delivery_id: deliveryId,
         response: session.response
       })
       process.exit(0)
     }

     await sleep(POLL_INTERVAL * 1000)
   }

7. Timeout reached:
   log(`No response received within ${Math.round(timeout / 60)} minutes.`)
   log(`The delivery is still available at ${deliveryUrl}`)
   log('User can respond later; agent should remind them.')
   outputJSON({
     status: 'timeout',
     delivery_id: deliveryId,
     url: deliveryUrl,
     message: `No response received within ${Math.round(timeout / 60)} minutes. The delivery is still available for feedback.`
   })
   process.exit(0)
```

### HTTP Retry Logic

```javascript
// Retry fetch with exponential backoff
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
```

---

## Shared Utilities

All scripts share these helper patterns:

### UX Output Convention

```javascript
function log(msg) {
  process.stderr.write(`[visual-delivery] ${msg}\n`);
}

function outputJSON(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Argument Parsing

Simple arg parser (no external dependency):

```javascript
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[key] = argv[++i];
      } else {
        args[key] = true;  // boolean flag
      }
    }
  }
  return args;
}
```

### Script Location Resolution

Scripts reference `SKILL_DIR` to locate templates:

```javascript
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
```

Works regardless of where the script is called from, on all platforms.

---

## Error Handling: Solve, Don't Punt

Per best practices: scripts handle error conditions explicitly rather than
failing and letting the agent figure it out.

### Principles

- Exit 0 on success (including "already running" and "timeout")
- Exit 1 on error (server not found, Node.js too old, etc.)
- All stdout output is JSON (parseable by agent)
- All stderr output is human-readable (prefixed with `[visual-delivery]`)
- Errors include a `"message"` field with **actionable information**

### Specific Error Handling by Script

**start.js must handle:**

| Error | Bad (punt) | Good (solve) |
|-------|-----------|-------------|
| Node.js < 18 | `exit 1` | `{"status":"error","message":"Node.js >= 18 required (found v16). Install: https://nodejs.org"}` |
| Port in use | `exit 1` | Check if it's our server (PID match) → report already_running. If foreign process → `{"status":"error","message":"Port 3847 in use. Use --port to choose another"}` |
| npm install fails | `exit 1` | `{"status":"error","message":"Failed to install dependencies. Check network and retry."}` |
| cloudflared not found | fail silently | Log to stderr: `"cloudflared not found. Install: brew install cloudflared"`. Continue without tunnel. JSON includes `"remote_url": null` |
| Frontend build fails | `exit 1` | `{"status":"error","message":"Frontend build failed. Check {DATA_DIR}/logs/server.log for details."}` |

**await-feedback.js must handle:**

| Error | Bad (punt) | Good (solve) |
|-------|-----------|-------------|
| Server not running | `exit 1` | `{"status":"error","message":"Server not running at localhost:3847. Run: node {SKILL_DIR}/scripts/start.js"}` |
| Invalid schema JSON | crash at server | Validate JSON syntax locally before POST. `{"status":"error","message":"Invalid JSON in --schema argument"}` |
| fetch fails mid-poll | crash | Retry with backoff (3 attempts), then report error |
| Timeout | error | Normal exit 0 with `"status":"timeout"`. Delivery stays open. Agent reminds user. |

### Constants Documentation

All magic numbers are justified (no "voodoo constants"):

```javascript
const PORT = 3847;           // Avoids conflict with 3000/5173/8080 common dev ports
const POLL_INTERVAL = 2;     // Seconds between polls. 2s balances responsiveness vs server load
const TIMEOUT = 300;         // 5 minutes. Reasonable for human decision-making
const HEALTH_TIMEOUT = 15;   // Seconds to wait for server startup. First run may be slow (npm install + build)
const FETCH_RETRY = 3;       // Retries for transient network errors. Most resolve by second attempt
```

## Cross-Platform Compatibility

All scripts use Node.js APIs that work identically on Windows, macOS, and Linux:

| Operation | Node.js API | Cross-platform? |
|-----------|------------|----------------|
| Copy directory | `fs.cpSync(src, dst, { recursive: true })` | Yes (Node 16.7+) |
| Create directory | `fs.mkdirSync(path, { recursive: true })` | Yes |
| Check process alive | `process.kill(pid, 0)` | Yes |
| Kill process | `process.kill(pid, 'SIGTERM')` | Yes (TerminateProcess on Windows) |
| Spawn detached | `spawn(cmd, args, { detached: true })` | Yes |
| Path resolution | `path.resolve()`, `path.join()` | Yes (handles \ vs /) |
| Environment vars | `process.env.VAR` | Yes |
| HTTP requests | `fetch()` (Node 18+) | Yes (built-in) |
| Run shell cmd | `execSync('npm install', { cwd })` | Yes |
| Find command | `where` (Win) / `which` (Unix) | Wrapper needed |
| File watching | `fs.watch()` | Yes (platform-specific impl) |
