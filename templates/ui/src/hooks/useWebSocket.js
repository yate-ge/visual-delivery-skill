import { useState, useEffect, useRef } from 'react';
import { eventBus } from '../lib/eventBus';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);

      ws.onopen = () => {
        setConnected(true);
        attemptsRef.current = 0;
      };

      ws.onclose = () => {
        setConnected(false);
        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), 10000);
        attemptsRef.current++;
        setTimeout(connect, delay);
      };

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data);
          eventBus.emit(event, data);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      wsRef.current = ws;
    }

    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connected };
}
