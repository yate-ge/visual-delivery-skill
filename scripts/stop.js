#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function log(msg) {
  process.stderr.write(`[visual-delivery] ${msg}\n`);
}

function outputJSON(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
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

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv);
const dataDir = path.resolve(args['data-dir'] || path.join(process.cwd(), '.visual-delivery'));

let serverPid = null;
let tunnelPid = null;

// Stop server
const pidFile = path.join(dataDir, 'server.pid');
if (fs.existsSync(pidFile)) {
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
  if (isProcessAlive(pid)) {
    killProcess(pid);
    serverPid = pid;
    log(`Server stopped (PID ${pid})`);
  } else {
    log('Server not running (stale PID file)');
  }
  try { fs.unlinkSync(pidFile); } catch {}
} else {
  log('Server not running');
}

// Stop tunnel
const tunnelPidFile = path.join(dataDir, 'tunnel.pid');
if (fs.existsSync(tunnelPidFile)) {
  const pid = parseInt(fs.readFileSync(tunnelPidFile, 'utf8'));
  if (isProcessAlive(pid)) {
    killProcess(pid);
    tunnelPid = pid;
    log(`Tunnel stopped (PID ${pid})`);
  }
  try { fs.unlinkSync(tunnelPidFile); } catch {}
  // Clean up tunnel URL
  const urlFile = path.join(dataDir, 'tunnel.url');
  try { fs.unlinkSync(urlFile); } catch {}
}

outputJSON({
  status: 'stopped',
  server_pid: serverPid,
  tunnel_pid: tunnelPid
});
