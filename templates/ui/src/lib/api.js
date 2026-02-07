const BASE = '';

export async function fetchDeliveries(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${BASE}/api/deliveries?${query}` : `${BASE}/api/deliveries`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch deliveries');
  return res.json();
}

export async function fetchDelivery(id) {
  const res = await fetch(`${BASE}/api/deliveries/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch delivery ${id}`);
  return res.json();
}

export async function submitFeedback(deliveryId, values) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}

export async function addAnnotation(deliveryId, annotation) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation)
  });
  if (!res.ok) throw new Error('Failed to add annotation');
  return res.json();
}

export async function fetchDesignTokens() {
  const res = await fetch(`${BASE}/api/design-tokens`);
  if (!res.ok) throw new Error('Failed to fetch design tokens');
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}
