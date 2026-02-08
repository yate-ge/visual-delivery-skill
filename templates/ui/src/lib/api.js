const BASE = '';

async function ensureOk(res, message) {
  if (res.ok) return res;

  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || '';
  } catch {
    // ignore
  }

  throw new Error(detail ? `${message}: ${detail}` : message);
}

export async function fetchDeliveries(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${BASE}/api/deliveries?${query}` : `${BASE}/api/deliveries`;
  const res = await fetch(url);
  await ensureOk(res, 'Failed to fetch deliveries');
  return res.json();
}

export async function fetchDelivery(id) {
  const res = await fetch(`${BASE}/api/deliveries/${id}`);
  await ensureOk(res, `Failed to fetch delivery ${id}`);
  return res.json();
}

export async function saveFeedbackDraft(deliveryId, items) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/feedback/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  await ensureOk(res, 'Failed to save feedback draft');
  return res.json();
}

export async function commitFeedback(deliveryId, items) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/feedback/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  await ensureOk(res, 'Failed to commit feedback');
  return res.json();
}

export async function resolveFeedback(deliveryId, feedbackIds, handledBy = 'agent') {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/feedback/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feedback_ids: feedbackIds,
      handled_by: handledBy,
    }),
  });
  await ensureOk(res, 'Failed to resolve feedback');
  return res.json();
}

export async function fetchExecutionEvents(deliveryId) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/execution-events`);
  await ensureOk(res, 'Failed to fetch execution events');
  return res.json();
}

export async function appendExecutionEvents(deliveryId, events) {
  const payload = Array.isArray(events) ? { events } : { event: events };
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/execution-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await ensureOk(res, 'Failed to append execution events');
  return res.json();
}

export async function addAnnotation(deliveryId, annotation) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation),
  });
  await ensureOk(res, 'Failed to add annotation');
  return res.json();
}

export async function fetchActiveAlignment(agentSessionId) {
  const res = await fetch(
    `${BASE}/api/alignment/active?agent_session_id=${encodeURIComponent(agentSessionId)}`
  );
  await ensureOk(res, 'Failed to fetch active alignment');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${BASE}/api/settings`);
  await ensureOk(res, 'Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  await ensureOk(res, 'Failed to update settings');
  return res.json();
}

export async function fetchDesignTokens() {
  const res = await fetch(`${BASE}/api/design-tokens`);
  await ensureOk(res, 'Failed to fetch design tokens');
  return res.json();
}

export async function revokeFeedback(deliveryId, feedbackIds) {
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/feedback/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback_ids: feedbackIds }),
  });
  await ensureOk(res, 'Failed to revoke feedback');
  return res.json();
}

export async function updateDeliveryContent(deliveryId, content, title) {
  const body = { content };
  if (title) body.title = title;
  const res = await fetch(`${BASE}/api/deliveries/${deliveryId}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'Failed to update delivery content');
  return res.json();
}
