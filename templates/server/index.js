const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { setupWebSocket, broadcast, closeWebSocket } = require('./lib/ws');
const { setupRoutes } = require('./routes/api');

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

const args = parseArgs(process.argv);
const dataDir = args['data-dir'] || path.join(process.cwd(), '.visual-delivery');
const port = parseInt(args.port, 10) || 3847;
const host = args.host || '127.0.0.1';
const uiDir = args['ui-dir'] || path.join(dataDir, 'ui', 'dist');

fs.mkdirSync(path.join(dataDir, 'data', 'deliveries'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'data', 'sessions'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });

const indexPath = path.join(dataDir, 'data', 'index.json');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath, '[]', 'utf8');
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.set('port', port);

setupRoutes(app, dataDir);

if (fs.existsSync(uiDir)) {
  app.use(express.static(uiDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(uiDir, 'index.html'));
    }
  });
}

const server = http.createServer(app);
setupWebSocket(server);

function watchDesignTokens() {
  const tokensPath = path.join(dataDir, 'design', 'tokens.json');
  if (!fs.existsSync(tokensPath)) return;

  let debounceTimer = null;
  fs.watch(tokensPath, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        if (tokens.colors && tokens.typography && tokens.spacing) {
          broadcast('design_updated', tokens);
        }
      } catch (err) {
        console.error('Invalid tokens.json:', err.message);
      }
    }, 200);
  });
}

const pidPath = path.join(dataDir, 'server.pid');
fs.writeFileSync(pidPath, String(process.pid));

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
  watchDesignTokens();
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  closeWebSocket();
  server.close(() => {
    try {
      fs.unlinkSync(pidPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('PID cleanup error:', err.message);
      }
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
