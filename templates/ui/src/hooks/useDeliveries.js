import { useState, useEffect, useCallback } from 'react';
import { fetchDeliveries } from '../lib/api';
import { eventBus } from '../lib/eventBus';

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDeliveries();
      setDeliveries(data.deliveries || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for real-time updates
  useEffect(() => {
    const onNewDelivery = (data) => {
      setDeliveries(prev => {
        // Avoid duplicates
        if (prev.find(d => d.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const onUpdateDelivery = (data) => {
      setDeliveries(prev =>
        prev.map(d => d.id === data.id ? { ...d, ...data } : d)
      );
    };

    const onFeedbackReceived = (data) => {
      setDeliveries(prev =>
        prev.map(d => d.id === data.delivery_id ? { ...d, status: 'completed' } : d)
      );
    };

    eventBus.on('new_delivery', onNewDelivery);
    eventBus.on('update_delivery', onUpdateDelivery);
    eventBus.on('feedback_received', onFeedbackReceived);

    return () => {
      eventBus.off('new_delivery', onNewDelivery);
      eventBus.off('update_delivery', onUpdateDelivery);
      eventBus.off('feedback_received', onFeedbackReceived);
    };
  }, []);

  return { deliveries, loading, error, reload: load };
}
