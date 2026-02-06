# Server Design

## Technology Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Node.js (>=18) | Universal, lightweight, agent environments usually have it |
| HTTP framework | Express | Minimal, well-known, small dependency footprint |
| WebSocket | ws | Lightweight, no Socket.IO overhead |
| Frontend serving | express.static | Serve pre-built SPA from `server/public/` |
| Tunnel | cloudflared (npm) | Zero-signup, programmatic API via `cloudflared` npm package |

## Server Entry Point

`server/index.js` — single file entry point that:
1. Parses CLI arguments (`--data-dir`, `--port`)
2. Ensures data directory structure exists
3. Starts Express + WebSocket server
4. Binds to `127.0.0.1:{port}`

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--data-dir` | `{CWD}/.visual-delivery` | Path to data directory |
| `--port` | `3847` | HTTP server port |
| `--host` | `127.0.0.1` | Bind address |

### Server Startup Sequence

```
1. Parse arguments
2. mkdir -p {data-dir}/data, {data-dir}/custom, {data-dir}/logs
3. Initialize JSON files if not exist (empty arrays)
4. Load custom theme if exists ({data-dir}/custom/theme.json)
5. Start Express server
   ├── Static: serve server/public/ (pre-built frontend)
   ├── API routes: /api/*
   ├── SPA fallback: serve index.html for all non-API, non-static routes
   └── WebSocket: upgrade handler on /ws
6. Write PID to {data-dir}/server.pid
7. Log "Server running at http://127.0.0.1:{port}"
```

## File I/O Strategy

### Atomic Writes

All JSON file writes use atomic write to prevent partial reads:

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

function atomicWriteJSON(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  const tmpFile = path.join(os.tmpdir(), `vds_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmpFile, content, 'utf8');
  fs.renameSync(tmpFile, filePath);
}
```

### Read Helper (Solve, Don't Punt)

```javascript
function readJSON(filePath) {
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
      // File doesn't exist yet — create with empty array
      atomicWriteJSON(filePath, []);
      return [];
    }
    if (err instanceof SyntaxError) {
      // Corrupted JSON — back up and reset
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.error(`Corrupted JSON at ${filePath}, backed up to ${backupPath}`);
      atomicWriteJSON(filePath, []);
      return [];
    }
    throw err; // Unexpected errors still surface
  }
}
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
  const deliveries = readJSON(deliveriesPath);
  const blocking = deliveries.filter(d =>
    d.mode === 'blocking' && d.status === 'awaiting_feedback'
  );
  blocking.forEach(d => {
    ws.send(JSON.stringify({ event: 'new_delivery', data: d }));
  });
});
```

## Tunnel Management

Tunnel is managed by `scripts/start.sh`, not by the server process itself. This keeps the server simple and the tunnel lifecycle controllable from the outside.

If the server needs to know its public URL (e.g., to include in API responses), it reads from `{data-dir}/tunnel.url` file that `start.sh` writes after tunnel is established.

## Custom Theme Loading

The server serves the default theme, but checks for a user override:

```javascript
app.get('/api/theme', (req, res) => {
  const customPath = path.join(dataDir, 'custom', 'theme.json');
  const defaultPath = path.join(__dirname, '..', 'assets', 'theme', 'default.json');

  let theme = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));

  if (fs.existsSync(customPath)) {
    const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
    theme = deepMerge(theme, custom);  // custom overrides default
  }

  res.json(theme);
});
```

## Process Management

### PID File

Server writes its PID to `{data-dir}/server.pid` on startup. Used by:
- `start.sh` to check if server is already running
- `stop.sh` to kill the process

### Graceful Shutdown

```javascript
process.on('SIGTERM', () => {
  wss.close();
  server.close(() => {
    // Clean up PID file
    fs.unlinkSync(pidPath);
    process.exit(0);
  });
});
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

Note: `cloudflared` npm package is used by `start.sh` (run via npx), not a server dependency.

## Directory: server/

```
server/
├── package.json
├── index.js              ← entry point, CLI args, server bootstrap
├── routes/
│   └── api.js            ← all /api/* route handlers
├── lib/
│   ├── store.js          ← JSON file read/write helpers
│   ├── ws.js             ← WebSocket setup and broadcast
│   └── ids.js            ← ID generation
└── public/               ← pre-built frontend (copied from ui/dist at build time)
    ├── index.html
    ├── assets/
    └── ...
```
