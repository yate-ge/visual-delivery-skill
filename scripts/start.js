#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PORT = 3847;           // Avoids conflict with 3000/5173/8080 common dev ports
const HEALTH_TIMEOUT = 15;   // Seconds to wait for server startup

const SKILL_DIR = path.resolve(__dirname, '..');

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

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

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

function isRemoteEnvironment() {
  const env = process.env;
  return !!(
    env.CODESPACE_NAME ||
    env.GITPOD_WORKSPACE_URL ||
    env.REPL_ID ||
    env.SSH_CLIENT ||
    env.SSH_TTY ||
    env.C9_HOSTNAME ||
    env.CLOUD_SHELL ||
    env.CI
  );
}

async function checkServerHealth(port, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const port = parseInt(args['port']) || PORT;
  const lang = args['lang'] || 'en';
  const dataDir = path.resolve(args['data-dir'] || path.join(process.cwd(), '.visual-delivery'));

  // Check Node.js version
  const nodeVersion = parseInt(process.versions.node.split('.')[0]);
  if (nodeVersion < 18) {
    outputJSON({
      status: 'error',
      message: `Node.js >= 18 required (found v${process.versions.node}). Install: https://nodejs.org`
    });
    process.exit(1);
  }

  // Check if already running
  const pidFile = path.join(dataDir, 'server.pid');
  let portInUse = false;

  // First check if the port is in use by any process
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    if (res.ok) portInUse = true;
  } catch {
    // Port not in use
  }

  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    if (isProcessAlive(pid) && portInUse) {
      log(`Server already running at http://localhost:${port} (PID ${pid})`);
      outputJSON({
        status: 'already_running',
        local_url: `http://localhost:${port}`,
        pid,
        first_run: false
      });
      process.exit(0);
    }
    // Stale PID file — kill old process if alive
    if (isProcessAlive(pid)) {
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
    try { fs.unlinkSync(pidFile); } catch {}
  }

  // Port occupied by unknown process (PID mismatch or no PID file) — try to find and kill it
  if (portInUse) {
    log(`Port ${port} occupied by another process, attempting to free it...`);
    try {
      const result = execSync(
        process.platform === 'win32'
          ? `netstat -ano | findstr :${port}`
          : `lsof -ti :${port}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (result) {
        const pids = result.split('\n').map(p => parseInt(p.trim())).filter(Boolean);
        for (const p of pids) {
          try { process.kill(p, 'SIGTERM'); } catch {}
        }
        await sleep(1000);
        log('  Port freed.');
      }
    } catch {
      // Could not find/kill process
    }
  }

  // Always clear delivery data on server start (clean slate for each session)
  if (fs.existsSync(path.join(dataDir, 'data'))) {
    log('Clearing previous delivery data...');
    const deliveriesDataDir = path.join(dataDir, 'data', 'deliveries');
    if (fs.existsSync(deliveriesDataDir)) {
      fs.rmSync(deliveriesDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(deliveriesDataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'data', 'index.json'), '[]', 'utf8');
  }

  // Determine if first run
  const firstRun = !fs.existsSync(path.join(dataDir, 'server'));

  // Initialize work directory (first run)
  if (firstRun) {
    log('Initializing work directory...');

    // Create data directories (always start with clean delivery data)
    const deliveriesDataDir = path.join(dataDir, 'data', 'deliveries');
    if (fs.existsSync(deliveriesDataDir)) {
      fs.rmSync(deliveriesDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(deliveriesDataDir, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });

    // Initialize index.json (always clean)
    fs.writeFileSync(path.join(dataDir, 'data', 'index.json'), '[]', 'utf8');

    // Copy server template
    log('  Copying server template...');
    fs.cpSync(path.join(SKILL_DIR, 'templates', 'server'), path.join(dataDir, 'server'), { recursive: true });

    // Copy frontend template
    log('  Copying frontend template...');
    fs.cpSync(path.join(SKILL_DIR, 'templates', 'ui'), path.join(dataDir, 'ui'), { recursive: true });

    // Copy design template (only if not exists)
    if (!fs.existsSync(path.join(dataDir, 'design'))) {
      log('  Generating design specification...');
      fs.cpSync(path.join(SKILL_DIR, 'templates', 'design'), path.join(dataDir, 'design'), { recursive: true });
    }
  } else {
    // Ensure data dirs exist on subsequent runs
    fs.mkdirSync(path.join(dataDir, 'data', 'deliveries'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
  }

  // Install server dependencies (if node_modules missing)
  const serverDir = path.join(dataDir, 'server');
  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    log('Installing server dependencies...');
    try {
      execSync('npm install --production --silent', { cwd: serverDir, stdio: 'pipe' });
    } catch (err) {
      outputJSON({
        status: 'error',
        message: 'Failed to install server dependencies. Check network and retry.'
      });
      process.exit(1);
    }
  }

  // Install frontend dependencies (if node_modules missing)
  const uiDir = path.join(dataDir, 'ui');
  if (!fs.existsSync(path.join(uiDir, 'node_modules'))) {
    log('Installing frontend dependencies...');
    try {
      execSync('npm install --silent', { cwd: uiDir, stdio: 'pipe' });
    } catch (err) {
      outputJSON({
        status: 'error',
        message: 'Failed to install frontend dependencies. Check network and retry.'
      });
      process.exit(1);
    }
  }

  // Build frontend (if dist/ missing)
  const distDir = path.join(uiDir, 'dist');
  if (!fs.existsSync(distDir)) {
    log('Building frontend...');
    try {
      execSync('npm run build', { cwd: uiDir, stdio: 'pipe' });
    } catch (err) {
      outputJSON({
        status: 'error',
        message: `Frontend build failed. Check ${path.join(dataDir, 'logs', 'server.log')} for details.`
      });
      process.exit(1);
    }
  }

  // Start server
  log('Starting server...');
  const logFd = fs.openSync(path.join(dataDir, 'logs', 'server.log'), 'a');
  const child = spawn('node', [
    'index.js',
    '--data-dir', dataDir,
    '--port', String(port),
    '--ui-dir', distDir,
    '--lang', lang
  ], {
    cwd: serverDir,
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });
  child.unref();
  fs.closeSync(logFd);

  // Wait for server ready
  const healthy = await checkServerHealth(port, HEALTH_TIMEOUT);
  if (!healthy) {
    outputJSON({
      status: 'error',
      message: `Server failed to start within ${HEALTH_TIMEOUT}s. Check ${path.join(dataDir, 'logs', 'server.log')}`
    });
    process.exit(1);
  }

  // Handle remote access (only when explicitly requested with --remote)
  let remoteUrl = null;
  const wantRemote = args['remote'] === true;

  if (wantRemote) {
    log('Checking remote access...');
    if (commandExists('cloudflared')) {
      try {
        const tunnelLogPath = path.join(dataDir, 'logs', 'tunnel.log');
        const tunnelLogFd = fs.openSync(tunnelLogPath, 'a');
        const tunnel = spawn('cloudflared', [
          'tunnel', '--url', `http://localhost:${port}`
        ], {
          detached: true,
          stdio: ['ignore', tunnelLogFd, tunnelLogFd]
        });
        tunnel.unref();
        fs.closeSync(tunnelLogFd);
        fs.writeFileSync(path.join(dataDir, 'tunnel.pid'), String(tunnel.pid));

        // Wait for tunnel URL (parse from log)
        const tunnelDeadline = Date.now() + 15000;
        while (Date.now() < tunnelDeadline) {
          await sleep(1000);
          try {
            const logContent = fs.readFileSync(tunnelLogPath, 'utf8');
            const match = logContent.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
            if (match) {
              remoteUrl = match[0];
              fs.writeFileSync(path.join(dataDir, 'tunnel.url'), remoteUrl);
              break;
            }
          } catch {}
        }
      } catch (err) {
        log(`  Tunnel setup failed: ${err.message}`);
        log('  Continuing with local access only.');
      }
    } else {
      log('  cloudflared not found.');
      log('  Install for remote access: brew install cloudflared');
      log('  Or: npm install -g cloudflared');
      log('  Continuing with local access only.');
    }
  }

  // Output results
  const designSpecPath = path.relative(process.cwd(), path.join(dataDir, 'design', 'design-spec.md'));

  log('');
  log('Ready!');
  log(`  Local URL:   http://localhost:${port}`);
  if (remoteUrl) log(`  Remote URL:  ${remoteUrl}`);
  if (firstRun) {
    log(`  Design spec: ${designSpecPath}`);
    log('  Edit design-spec.md or tokens.json to customize the UI.');
  }

  outputJSON({
    status: 'started',
    local_url: `http://localhost:${port}`,
    remote_url: remoteUrl,
    pid: child.pid,
    first_run: firstRun,
    design_spec_path: firstRun ? designSpecPath : undefined
  });
}

main().catch(err => {
  log(`Error: ${err.message}`);
  outputJSON({ status: 'error', message: err.message });
  process.exit(1);
});
