import { createContext, useContext, useEffect, useState } from 'react';
import { fetchSettings } from '../lib/api';
import { t } from '../lib/i18n';

const SettingsContext = createContext({ platform: {}, update: () => {} });

export function SettingsProvider({ children }) {
  const [platform, setPlatform] = useState({
    name: t('appTitle'),
    slogan: '',
  });

  function applyFavicon(emoji) {
    const icon = emoji || '🐂';
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${encodeURIComponent(icon)}</text></svg>`;
  }

  function applyPlatform(p) {
    if (!p) return;
    setPlatform(p);
    document.title = p.name || t('appTitle');
    applyFavicon(p.favicon);
  }

  // Load from API on mount
  useEffect(() => {
    fetchSettings()
      .then((data) => applyPlatform(data?.platform))
      .catch(() => {});
  }, []);

  // update(settings) — apply immediately from caller data, no extra fetch
  function update(settings) {
    applyPlatform(settings?.platform);
  }

  return (
    <SettingsContext.Provider value={{ platform, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
