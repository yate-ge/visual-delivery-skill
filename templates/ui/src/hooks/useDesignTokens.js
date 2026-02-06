import { useState, useEffect } from 'react';
import { applyTokens } from '../lib/theme';
import { eventBus } from '../lib/eventBus';
import { fetchDesignTokens } from '../lib/api';

export function useDesignTokens() {
  const [tokens, setTokens] = useState(null);

  // Load tokens on mount
  useEffect(() => {
    fetchDesignTokens()
      .then(data => {
        setTokens(data);
        applyTokens(data);
      })
      .catch(err => console.error('Failed to load design tokens:', err));
  }, []);

  // Listen for hot-reload via WebSocket
  useEffect(() => {
    const handler = (newTokens) => {
      setTokens(newTokens);
      applyTokens(newTokens);
    };
    eventBus.on('design_updated', handler);
    return () => eventBus.off('design_updated', handler);
  }, []);

  return tokens;
}
