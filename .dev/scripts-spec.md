# Scripts Specification

## Design Principle

> "Prefer instructions over scripts unless you need deterministic behavior or external tooling."

Only 3 scripts exist. Each handles logic that is too complex, critical, or
stateful for ad-hoc agent commands.

## scripts/start.sh

**Purpose:** Start the web server with environment detection and optional tunnel.

**Why it's a script:** Multi-step deterministic logic — environment detection,
dependency check, process deduplication, tunnel setup. Too complex and too
important to leave to ad-hoc agent commands.

### Input

| Argument | Default | Description |
|----------|---------|-------------|
| `--port` | `3847` | Server port |
| `--data-dir` | `{CWD}/.visual-delivery` | Data directory path |
| `--remote` | (prompt) | Force enable remote access |
| `--no-remote` | (prompt) | Force disable remote access |

When neither `--remote` nor `--no-remote` is given, the script decides based on
environment detection (see below).

### Output (stdout, JSON)

```json
{
  "status": "started",
  "local_url": "http://localhost:3847",
  "remote_url": "https://seasonal-deck-organisms-sf.trycloudflare.com",
  "pid": 12345
}
```

If server is already running:
```json
{
  "status": "already_running",
  "local_url": "http://localhost:3847",
  "pid": 12345
}
```

### Logic Flow

```
1. Parse arguments
2. Set DATA_DIR (default: $PWD/.visual-delivery)
3. Check if already running:
   a. Read {DATA_DIR}/server.pid
   b. Check if PID is alive: kill -0 $PID
   c. Check if port responds: curl -s localhost:{PORT}/health
   d. If both OK → output already_running JSON, exit 0
   e. If PID stale → remove PID file, continue

4. Create data directory structure:
   mkdir -p {DATA_DIR}/data {DATA_DIR}/custom {DATA_DIR}/logs
   Initialize empty JSON arrays in data/*.json if files don't exist

5. Check Node.js availability:
   command -v node || { echo "Node.js required"; exit 1; }

6. Install server dependencies (if needed):
   cd {SKILL_DIR}/server && npm install --production --silent

7. Start server:
   node {SKILL_DIR}/server/index.js \
     --data-dir {DATA_DIR} \
     --port {PORT} \
     > {DATA_DIR}/logs/server.log 2>&1 &

8. Wait for server ready:
   Poll localhost:{PORT}/health for up to 10 seconds

9. Determine remote access:
   a. If --remote → enable tunnel
   b. If --no-remote → skip tunnel
   c. If neither:
      - Detect environment (see Environment Detection)
      - If remote environment → enable tunnel
      - If local environment → output local_url only
        (agent will ask user based on SKILL.md instructions)

10. If tunnel enabled:
    npx cloudflared tunnel --url http://localhost:{PORT} \
      > {DATA_DIR}/logs/tunnel.log 2>&1 &
    Parse tunnel URL from log output
    Write URL to {DATA_DIR}/tunnel.url
    Write tunnel PID to {DATA_DIR}/tunnel.pid

11. Output result JSON
```

### Environment Detection

```bash
detect_remote_environment() {
  # GitHub Codespaces
  [ -n "$CODESPACE_NAME" ] && return 0
  # Gitpod
  [ -n "$GITPOD_WORKSPACE_URL" ] && return 0
  # Replit
  [ -n "$REPL_ID" ] && return 0
  # SSH session
  [ -n "$SSH_CLIENT" ] || [ -n "$SSH_TTY" ] && return 0
  # Docker container
  [ -f "/.dockerenv" ] && return 0
  # AWS Cloud9
  [ -n "$C9_HOSTNAME" ] && return 0
  # Google Cloud Shell
  [ -n "$CLOUD_SHELL" ] && return 0
  # CI/CD (unlikely but possible)
  [ -n "$CI" ] && return 0

  return 1  # local environment
}
```

---

## scripts/stop.sh

**Purpose:** Stop the server and tunnel processes.

**Why it's a script:** Process cleanup must be reliable and deterministic.

### Input

| Argument | Default | Description |
|----------|---------|-------------|
| `--data-dir` | `{CWD}/.visual-delivery` | Data directory path |

### Output (stdout)

```
Server stopped (PID 12345)
Tunnel stopped (PID 12346)
```

### Logic Flow

```
1. Read {DATA_DIR}/server.pid
   If exists and process alive → kill $PID, remove PID file
   Else → "Server not running"

2. Read {DATA_DIR}/tunnel.pid
   If exists and process alive → kill $PID, remove PID file
   Remove {DATA_DIR}/tunnel.url

3. Output status
```

---

## scripts/await-feedback.sh

**Purpose:** Create a blocking delivery and poll until user responds or timeout.

**Why it's a script:** The polling loop must execute as a single bash process so
the agent's Bash tool call blocks until completion. Cannot be split across
multiple agent turns.

### Input

| Argument | Required | Description |
|----------|----------|-------------|
| `--title` | yes | Delivery title |
| `--schema` | yes | Feedback schema as JSON string |
| `--content` | no | Markdown content (default: empty) |
| `--content-file` | no | Read content from file (alternative to --content) |
| `--timeout` | no | Timeout in seconds (default: 300) |
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

On timeout:
```json
{
  "status": "timeout",
  "delivery_id": "d_1738850400_003"
}
```

On error:
```json
{
  "status": "error",
  "message": "Server not running"
}
```

### Logic Flow

```
1. Parse arguments
2. Check server is running: curl localhost:{PORT}/health
   If not → output error JSON, exit 1

3. Read content from --content or --content-file

4. Create blocking delivery:
   response=$(curl -s -X POST localhost:{PORT}/api/deliveries \
     -H 'Content-Type: application/json' \
     -d '{
       "mode": "blocking",
       "title": "...",
       "content": {"type": "markdown", "body": "..."},
       "feedback_schema": ...
     }')
   Extract session_id from response

5. Poll loop (with timeout):
   end_time=$(($(date +%s) + TIMEOUT))

   while [ $(date +%s) -lt $end_time ]; do
     result=$(curl -s localhost:{PORT}/api/sessions/$SESSION_ID)
     status=$(echo $result | jq -r .status)

     if [ "$status" = "responded" ]; then
       # Output the response
       echo $result | jq '{
         status: "responded",
         delivery_id: .delivery_id,
         response: .response
       }'
       exit 0
     fi

     sleep 2
   done

6. Timeout reached:
   echo '{"status":"timeout","delivery_id":"..."}'
   exit 0
```

### Dependencies

- `curl` — HTTP requests (universally available)
- `jq` — JSON parsing (common, but should check availability)
  - Fallback: use `grep`/`sed` for simple JSON extraction if jq not found

---

## Script Location Resolution

Scripts reference `SKILL_DIR` to locate the server code. This is resolved as
the directory containing the scripts themselves:

```bash
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
```

This works regardless of where the script is called from.

## Error Handling: Solve, Don't Punt

Per best practices: scripts handle error conditions explicitly rather than
failing and letting the agent figure it out.

### Principles

- Exit 0 on success (including "already running" and "timeout")
- Exit 1 on error (server not found, Node.js missing, etc.)
- All output is JSON (parseable by agent)
- Errors include a `"message"` field with **actionable information**
- stderr is used for debug logging only (not parsed by agent)

### Specific Error Handling by Script

**start.sh must handle:**

| Error | Bad (punt) | Good (solve) |
|-------|-----------|-------------|
| Node.js not found | `exit 1` | `{"status":"error","message":"Node.js >= 18 required. Install: https://nodejs.org or brew install node"}` |
| Port in use | `exit 1` | Check if it's our server (PID match) → report already_running. If foreign process → `{"status":"error","message":"Port 3847 in use by PID 5678 (node). Use --port to choose another"}` |
| npm install fails | `exit 1` | `{"status":"error","message":"Failed to install dependencies. Check network and run: cd {SKILL_DIR}/server && npm install"}` |
| cloudflared not found | fail silently | `{"status":"started","local_url":"...","remote_url":null,"message":"cloudflared not found. Install: brew install cloudflared. Remote access unavailable."}` |

**await-feedback.sh must handle:**

| Error | Bad (punt) | Good (solve) |
|-------|-----------|-------------|
| Server not running | `exit 1` | `{"status":"error","message":"Server not running at localhost:3847. Run: bash {SKILL_DIR}/scripts/start.sh"}` |
| jq not found | crash | Detect and fall back to grep/sed for JSON parsing. Log to stderr: "jq not found, using fallback parser" |
| curl fails mid-poll | crash | Retry with backoff (3 attempts), then report error |
| Invalid schema JSON | crash at server | Validate JSON syntax locally before POST. `{"status":"error","message":"Invalid JSON in --schema argument"}` |

### jq Fallback Implementation

```bash
# Parse JSON field without jq
json_get() {
  local json="$1" field="$2"
  echo "$json" | grep -o "\"$field\":[[:space:]]*\"[^\"]*\"" | \
    sed "s/\"$field\":[[:space:]]*\"//" | sed 's/"$//'
}

# Usage
if command -v jq >/dev/null 2>&1; then
  status=$(echo "$result" | jq -r .status)
else
  status=$(json_get "$result" "status")
fi
```

### Constants Documentation

All magic numbers are justified (no "voodoo constants"):

```bash
PORT=3847           # Avoids conflict with 3000/5173/8080 common dev ports
POLL_INTERVAL=2     # Seconds between polls. 2s balances responsiveness vs server load
TIMEOUT=300         # 5 minutes. Reasonable for human decision-making
HEALTH_TIMEOUT=10   # Seconds to wait for server startup. npm install may take a few seconds
CURL_RETRY=3        # Retries for transient network errors. Most resolve by second attempt
```
