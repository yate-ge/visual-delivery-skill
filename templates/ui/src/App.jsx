import { Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { useDesignTokens } from './hooks/useDesignTokens';
import { SettingsProvider } from './hooks/useSettings';
import Dashboard from './pages/Dashboard';
import DeliveryPage from './pages/DeliveryPage';
import Settings from './pages/Settings';
import Footer from './components/Footer';

export default function App() {
  useWebSocket();
  useDesignTokens();

  return (
    <SettingsProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/d/:id" element={<DeliveryPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </SettingsProvider>
  );
}
