// Locale is injected by the server into index.html as window.__VD_LOCALE__
// This eliminates the flash-of-wrong-language issue and supports any language.
const locale = (typeof window !== 'undefined' && window.__VD_LOCALE__) || {};

export function t(key, params = {}) {
  const str = locale[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}

export function has(key) {
  return key in locale;
}

export function getLang() {
  return (typeof window !== 'undefined' && window.__VD_LANG__) || 'en';
}
