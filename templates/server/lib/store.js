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

// Read-modify-write with locking
async function updateJSON(filePath, updater) {
  const lockPath = await acquireLock(filePath);
  try {
    let data;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(raw);
    } catch {
      data = [];
    }
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

module.exports = { writeJSON, readJSONArray, readJSONObject, updateJSON };
