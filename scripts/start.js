#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PORT = 3847;           // Avoids conflict with 3000/5173/8080 common dev ports
const HEALTH_TIMEOUT = 15;   // Seconds to wait for server startup

const SKILL_DIR = path.resolve(__dirname, '..');
const SUPPORTED_LANGS = ['zh', 'en'];

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

function normalizeLang(lang) {
  if (typeof lang !== 'string') return null;
  const v = lang.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('zh')) return 'zh';
  if (v.startsWith('en')) return 'en';
  return SUPPORTED_LANGS.includes(v) ? v : null;
}

function detectEnvLang() {
  const envLang = normalizeLang(process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '');
  return envLang || 'en';
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
  const dataDir = path.resolve(args['data-dir'] || path.join(process.cwd(), '.visual-delivery'));
  const initLang = normalizeLang(args['lang']) || detectEnvLang();
  const shouldSyncTemplates = args['sync-templates'] !== 'false';

  // Check Node.js version
  const nodeVersion = parseInt(process.versions.node.split('.')[0]);
  if (nodeVersion < 18) {
    outputJSON({
      status: 'error',
      message: `Node.js >= 18 required (found v${process.versions.node}). Install: https://nodejs.org`
    });
    process.exit(1);
  }

  // Check if already running — stop old server so we can resync templates and restart
  const pidFile = path.join(dataDir, 'server.pid');
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    if (isProcessAlive(pid)) {
      log(`Stopping previous server (PID ${pid}) to resync templates...`);
      try {
        process.kill(pid, 'SIGTERM');
        // Wait for process to exit (up to 5s)
        const killDeadline = Date.now() + 5000;
        while (Date.now() < killDeadline && isProcessAlive(pid)) {
          await sleep(200);
        }
        if (isProcessAlive(pid)) {
          process.kill(pid, 'SIGKILL');
          await sleep(500);
        }
      } catch {
        // Process already gone
      }
    }
    try { fs.unlinkSync(pidFile); } catch {}
  }

  // Determine if first run
  const firstRun = !fs.existsSync(path.join(dataDir, 'server'));

  // Initialize work directory (first run)
  let templatesSynced = false;
  if (firstRun) {
    log('Initializing work directory...');

    // Create data directories
    fs.mkdirSync(path.join(dataDir, 'data', 'deliveries'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });

    // Initialize index.json
    const indexPath = path.join(dataDir, 'data', 'index.json');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '[]', 'utf8');
    }

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

    // Remove any stale dist/ copied from templates — always rebuild on first run
    const copiedDist = path.join(dataDir, 'ui', 'dist');
    if (fs.existsSync(copiedDist)) {
      fs.rmSync(copiedDist, { recursive: true });
    }
  } else {
    // Ensure data dirs exist on subsequent runs
    fs.mkdirSync(path.join(dataDir, 'data', 'deliveries'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });

    if (shouldSyncTemplates) {
      log('Syncing runtime templates...');
      fs.cpSync(path.join(SKILL_DIR, 'templates', 'server'), path.join(dataDir, 'server'), {
        recursive: true,
        force: true,
      });
      fs.cpSync(path.join(SKILL_DIR, 'templates', 'ui'), path.join(dataDir, 'ui'), {
        recursive: true,
        force: true,
      });
      templatesSynced = true;
    }
  }

  // Initialize settings.json if missing.
  // This preserves existing language choices and only bootstraps empty workspaces.
  const settingsPath = path.join(dataDir, 'data', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        language: initLang,
        language_explicit: true,
        platform: {
          name: 'Visual Delivery',
          logo_url: '',
          slogan: 'Turn work into clear decisions.',
          visual_style: 'executive-brief',
        },
      }, null, 2),
      'utf8'
    );
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
  if (!fs.existsSync(distDir) || templatesSynced) {
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
    '--ui-dir', distDir
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

  // Handle remote access
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
    templates_synced: templatesSynced,
    language: initLang,
    design_spec_path: firstRun ? designSpecPath : undefined
  });
}

main().catch(err => {
  log(`Error: ${err.message}`);
  outputJSON({ status: 'error', message: err.message });
  process.exit(1);
});
