function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function toLocalISO(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = pad(date.getMilliseconds(), 3);

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}${sign}${offsetHours}:${offsetMins}`;
}

function nowLocalISO() {
  return toLocalISO(new Date());
}

function ensureLocalISO(input, fallback) {
  const normalized = toLocalISO(input);
  if (normalized) return normalized;
  return fallback || nowLocalISO();
}

module.exports = {
  toLocalISO,
  nowLocalISO,
  ensureLocalISO,
};
