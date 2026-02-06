# Server Design

## Technology Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Node.js (>=18) | Universal, lightweight, agent environments usually have it |
| HTTP framework | Express | Minimal, well-known, small dependency footprint |
| WebSocket | ws | Lightweight, no Socket.IO overhead |
| Frontend serving | express.static | Serve runtime-built SPA from `{DATA_DIR}/ui/dist/` |
| Tunnel | cloudflared (CLI) | Zero-signup, installed separately by user |

## Runtime Location

The server source code lives in the skill directory as a template
(`templates/server/`). On first `start.js` run, it is copied to the work
directory (`{DATA_DIR}/server/`). The server always runs from the work directory.

This ensures:
- Skill directory remains read-only
- Dependencies (`node_modules/`) are installed in the work directory
- Users can modify server code if needed (advanced)

## Server Entry Point

`server/index.js` — single file entry point that:
1. Parses CLI arguments (`--data-dir`, `--port`, `--ui-dir`)
2. Ensures data directory structure exists
3. Starts Express + WebSocket server
4. Starts design token file watcher
5. Binds to `127.0.0.1:{port}`

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--data-dir` | `{CWD}/.visual-delivery` | Path to data directory |
| `--port` | `3847` | HTTP server port |
| `--host` | `127.0.0.1` | Bind address |
| `--ui-dir` | `{DATA_DIR}/ui/dist` | Path to built frontend static files |

### Server Startup Sequence

```
1. Parse arguments
2. mkdir -p {data-dir}/data/deliveries, {data-dir}/logs
3. Initialize index.json as [] if not exist
4. Start Express server
   ├── Static: serve {ui-dir}/ (runtime-built frontend)
   ├── API routes: /api/*
   ├── SPA fallback: serve index.html for all non-API, non-static routes
   └── WebSocket: upgrade handler on /ws
5. Start design token watcher on {data-dir}/design/tokens.json
6. Write PID to {data-dir}/server.pid
7. Log "Server running at http://127.0.0.1:{port}"
```

## File I/O Strategy

### Per-Delivery Data Layout

Data is organized per-delivery instance. See [data-model.md](./data-model.md)
for full schema. The server manages:

- `{DATA_DIR}/data/index.json` — lightweight delivery index (locked globally)
- `{DATA_DIR}/data/deliveries/{id}/delivery.json` — full delivery record
- `{DATA_DIR}/data/deliveries/{id}/annotations.json` — per-delivery annotations
- `{DATA_DIR}/data/deliveries/{id}/feedback.json` — per-delivery feedback
- `{DATA_DIR}/data/deliveries/{id}/session.json` — blocking session (if applicable)

### File Locking

JSON file writes use file-level locking to prevent concurrent access
conflicts. Per-delivery files are locked independently, reducing contention:

- Writing feedback for delivery A doesn't block delivery B
- Only `index.json` is a shared resource (brief lock on create/status update)
- The agent may read files while the server is writing (safe: worst case stale read)

**Lock implementation using lockfile pattern:**

```javascript
const fs = require('fs');
const path = require('path');

const LOCK_TIMEOUT = 5000;  // 5s — max time to wait for lock
const LOCK_RETRY = 50;      // 50ms — retry interval

async function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const start = Date.now();

  while (true) {
    try {
      // O_EXCL: fail if file exists (atomic check-and-create)
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      // Check for stale lock (process died)
      try {
        const lockPid = parseInt(fs.readFileSync(lockPath, 'utf8'));
        try {
          process.kill(lockPid, 0);  // Check if process exists
        } catch {
          // Process is dead — remove stale lock
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        // Lock file disappeared — retry
        continue;
      }

      if (Date.now() - start > LOCK_TIMEOUT) {
        throw new Error(`Lock timeout on ${filePath}`);
      }
      await new Promise(r => setTimeout(r, LOCK_RETRY));
    }
  }
}

function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Lock release error:', err.message);
  }
}
```

### Atomic Writes (with locking)

All JSON file writes use atomic write combined with locking:

```javascript
const os = require('os');

async function writeJSON(filePath, data) {
  const lockPath = await acquireLock(filePath);
  try {
    const content = JSON.stringify(data, null, 2);
    const tmpFile = path.join(
      path.dirname(filePath),
      `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    fs.writeFileSync(tmpFile, content, 'utf8');
    fs.renameSync(tmpFile, filePath);
  } finally {
    releaseLock(lockPath);
  }
}
```

Note: temp files are written to the same directory as the target file to ensure
`rename()` is atomic (same filesystem).

### Read Helpers (Solve, Don't Punt)

```javascript
// Read array JSON (index.json, annotations.json, feedback.json)
function readJSONArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error(`Warning: ${filePath} is not an array, resetting`);
      return [];
    }
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(filePath, '[]', 'utf8');
      return [];
    }
    if (err instanceof SyntaxError) {
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.error(`Corrupted JSON at ${filePath}, backed up to ${backupPath}`);
      fs.writeFileSync(filePath, '[]', 'utf8');
      return [];
    }
    throw err;
  }
}

// Read object JSON (delivery.json, session.json)
function readJSONObject(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.error(`Corrupted JSON at ${filePath}, backed up to ${backupPath}`);
      return null;
    }
    throw err;
  }
}
```

### Read-Modify-Write Helper

For operations that need to read, modify, and write atomically:

```javascript
async function updateJSON(filePath, updater) {
  const lockPath = await acquireLock(filePath);
  try {
    const data = readJSON(filePath);
    const updated = updater(data);
    const content = JSON.stringify(updated, null, 2);
    const tmpFile = path.join(
      path.dirname(filePath),
      `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    fs.writeFileSync(tmpFile, content, 'utf8');
    fs.renameSync(tmpFile, filePath);
    return updated;
  } finally {
    releaseLock(lockPath);
  }
}

// Usage: append to index.json
await updateJSON(indexPath, (entries) => {
  entries.push(newEntry);
  return entries;
});

// Usage: append feedback to per-delivery feedback.json
const feedbackPath = path.join(dataDir, 'data', 'deliveries', deliveryId, 'feedback.json');
await updateJSON(feedbackPath, (items) => {
  items.push(newFeedback);
  return items;
});
```

### ID Generation

```javascript
let seqCounter = 0;
let lastSecond = 0;

function generateId(prefix) {
  const now = Math.floor(Date.now() / 1000);
  if (now !== lastSecond) {
    lastSecond = now;
    seqCounter = 0;
  }
  seqCounter++;
  return `${prefix}_${now}_${String(seqCounter).padStart(3, '0')}`;
}
```

## WebSocket Management

```javascript
const WebSocket = require('ws');

// Attached to the same HTTP server
const wss = new WebSocket.Server({ server });

function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// On new connection, send pending blocking deliveries
wss.on('connection', (ws) => {
  const index = readJSONArray(indexPath);
  const blocking = index.filter(d =>
    d.mode === 'blocking' && d.status === 'awaiting_feedback'
  );
  blocking.forEach(d => {
    ws.send(JSON.stringify({ event: 'new_delivery', data: d }));
  });
});
```

## Design Token Watcher

The server watches `{DATA_DIR}/design/tokens.json` for changes and broadcasts
updates to all connected browsers via WebSocket.

```javascript
function watchDesignTokens(dataDir, broadcast) {
  const tokensPath = path.join(dataDir, 'design', 'tokens.json');

  let debounceTimer = null;
  fs.watch(tokensPath, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        // Validate minimal structure
        if (tokens.colors && tokens.typography && tokens.spacing) {
          broadcast('design_updated', tokens);
          console.log('Design tokens updated, broadcast to clients');
        } else {
          console.error('Invalid tokens.json: missing required sections');
        }
      } catch (err) {
        console.error('Invalid tokens.json:', err.message);
      }
    }, 200);  // 200ms debounce
  });
}
```

### Design Token API

```javascript
app.get('/api/design-tokens', (req, res) => {
  const tokensPath = path.join(dataDir, 'design', 'tokens.json');
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    res.json(tokens);
  } catch (err) {
    // Fallback: serve default tokens if custom is invalid
    console.error('Error reading tokens.json:', err.message);
    res.status(500).json({ error: 'Invalid design tokens' });
  }
});
```

## Tunnel Management

Tunnel is managed by `scripts/start.js`, not by the server process itself.
This keeps the server simple and the tunnel lifecycle controllable from the outside.

If the server needs to know its public URL (e.g., to include in API responses),
it reads from `{DATA_DIR}/tunnel.url` file that `start.js` writes after tunnel
is established.

## Process Management

### PID File

Server writes its PID to `{DATA_DIR}/server.pid` on startup. Used by:
- `start.js` to check if server is already running
- `stop.js` to kill the process

### Graceful Shutdown (Solve, Don't Punt)

```javascript
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  wss.close();
  server.close(() => {
    try {
      fs.unlinkSync(pidPath);
    } catch (err) {
      // PID file already removed — not a problem
      if (err.code !== 'ENOENT') console.error('PID cleanup error:', err.message);
    }
    process.exit(0);
  });
  // Force exit if graceful shutdown takes too long (5s)
  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

## Dependencies (package.json)

Minimal dependency footprint:

```json
{
  "name": "visual-delivery-server",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0"
  }
}
```

Note: No file-locking library needed — the lock implementation uses native
`fs.writeFileSync` with `O_EXCL` flag, which is atomic on all platforms.

## Directory: templates/server/

```
templates/server/
├── package.json
├── index.js              ← entry point, CLI args, server bootstrap
├── routes/
│   └── api.js            ← all /api/* route handlers
└── lib/
    ├── store.js          ← JSON file read/write with locking
    ├── ws.js             ← WebSocket setup and broadcast
    └── ids.js            ← ID generation
```

At runtime, this is copied to `{DATA_DIR}/server/` and `node_modules/` is
installed there. The server is then started from the work directory.
