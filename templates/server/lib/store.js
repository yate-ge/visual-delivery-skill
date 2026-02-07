const fs = require('fs');
const path = require('path');

const LOCK_TIMEOUT = 5000;
const LOCK_RETRY = 50;

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const start = Date.now();

  ensureParentDir(filePath);

  while (true) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      try {
        const lockPid = parseInt(fs.readFileSync(lockPath, 'utf8'));
        try {
          process.kill(lockPid, 0);
        } catch {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() - start > LOCK_TIMEOUT) {
        throw new Error(`Lock timeout on ${filePath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY));
    }
  }
}

function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Lock release error:', err.message);
    }
  }
}

function writeFileAtomically(filePath, content) {
  ensureParentDir(filePath);
  const tmpFile = path.join(
    path.dirname(filePath),
    `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
  fs.writeFileSync(tmpFile, content, 'utf8');
  fs.renameSync(tmpFile, filePath);
}

async function writeJSON(filePath, data) {
  const lockPath = await acquireLock(filePath);
  try {
    writeFileAtomically(filePath, JSON.stringify(data, null, 2));
  } finally {
    releaseLock(lockPath);
  }
}

function readJSONArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`Warning: ${filePath} is not an array. Resetting to [].`);
      writeFileAtomically(filePath, '[]');
      return [];
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') {
      writeFileAtomically(filePath, '[]');
      return [];
    }
    if (err instanceof SyntaxError) {
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.error(`Corrupted JSON at ${filePath}, backed up to ${backupPath}`);
      writeFileAtomically(filePath, '[]');
      return [];
    }
    throw err;
  }
}

function readJSONObject(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
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

async function updateJSON(filePath, updater, defaultValue = []) {
  const lockPath = await acquireLock(filePath);
  try {
    let data = defaultValue;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(raw);
    } catch {
      data = defaultValue;
    }

    const next = updater(data);
    writeFileAtomically(filePath, JSON.stringify(next, null, 2));
    return next;
  } finally {
    releaseLock(lockPath);
  }
}

module.exports = {
  writeJSON,
  readJSONArray,
  readJSONObject,
  updateJSON,
};
