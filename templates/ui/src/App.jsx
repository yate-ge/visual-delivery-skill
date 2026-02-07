import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { useDesignTokens } from './hooks/useDesignTokens';
import { fetchSettings } from './lib/api';
import { eventBus } from './lib/eventBus';
import { setLang } from './lib/i18n';
import Dashboard from './pages/Dashboard';
import DeliveryPage from './pages/DeliveryPage';
import Settings from './pages/Settings';

export default function App() {
  useWebSocket();
  useDesignTokens();

  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        if (settings && settings.language) {
          setLang(settings.language);
        }
      })
      .catch(() => {
        // Keep detected language if settings are unavailable.
      });

    function onSettingsUpdated(nextSettings) {
      if (nextSettings && nextSettings.language) {
        setLang(nextSettings.language);
      }
    }

    eventBus.on('settings_updated', onSettingsUpdated);
    return () => eventBus.off('settings_updated', onSettingsUpdated);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/d/:id" element={<DeliveryPage />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
