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

module.exports = { generateId };
