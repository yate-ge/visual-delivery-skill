import { Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { useDesignTokens } from './hooks/useDesignTokens';
import Dashboard from './pages/Dashboard';
import DeliveryPage from './pages/DeliveryPage';
import Settings from './pages/Settings';

export default function App() {
  useWebSocket();
  useDesignTokens();

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/d/:id" element={<DeliveryPage />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
