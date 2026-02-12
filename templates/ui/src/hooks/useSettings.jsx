import { createContext, useContext, useEffect, useState } from 'react';
import { fetchSettings } from '../lib/api';
import { t } from '../lib/i18n';

const SettingsContext = createContext({ platform: {}, update: () => {} });

export function SettingsProvider({ children }) {
  const [platform, setPlatform] = useState({
    name: t('appTitle'),
    slogan: '',
  });

  function applyPlatform(p) {
    if (!p) return;
    setPlatform(p);
    document.title = p.name || t('appTitle');
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
