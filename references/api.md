# API Reference (v2)

## Table of Contents

- [Base URL](#base-url)
- [Health](#health)
- [Delivery APIs](#delivery-apis)
- [Feedback APIs](#feedback-apis)
- [Alignment APIs](#alignment-apis)
- [Settings APIs](#settings-apis)
- [Design Tokens](#design-tokens)
- [WebSocket Events](#websocket-events)
- [Error Format](#error-format)

## Base URL

`http://localhost:3847`

## Health

### `GET /health`

Response:

```json
{ "status": "ok", "uptime": 120, "version": "2.0.0" }
```

## Delivery APIs

### `POST /api/deliveries`

Create `task_delivery` or `alignment` delivery.

Request body:

```json
{
  "mode": "task_delivery|alignment",
  "title": "string",
  "agent_session_id": "string (required for alignment)",
  "thread_id": "string (required for alignment)",
  "metadata": {
    "project_name": "string",
    "task_name": "string",
    "generated_at": "ISO datetime",
    "audience": "string"
  },
  "content": {
    "type": "ui_spec",
    "ui_spec": {
      "version": "2.0",
      "layout": {},
      "components": [],
      "bindings": {},
      "feedback_hooks": {},
      "sidebar_contract": {}
    }
  }
}
```

Response:

```json
{
  "id": "d_1771000000_001",
  "url": "http://localhost:3847/d/d_1771000000_001",
  "replaced_delivery_id": "d_1771000000_000"
}
```

`replaced_delivery_id` is present when alignment upsert replaces old active alignment.

### `GET /api/deliveries`

Query params:

- `mode` = `task_delivery|alignment`
- `status` = `normal|pending_feedback`
- `agent_session_id`
- `limit` (default 50)
- `offset` (default 0)

Response:

```json
{
  "deliveries": [
    {
      "id": "d_...",
      "mode": "task_delivery",
      "status": "pending_feedback",
      "title": "...",
      "created_at": "...",
      "updated_at": "...",
      "metadata": {"project_name":"...","task_name":"..."},
      "agent_session_id": null,
      "alignment_state": null
    }
  ],
  "total": 1
}
```

### `GET /api/deliveries/:id`

Returns delivery with `feedback`, `drafts`, and `pending_feedback_count`.

Response fields:

- delivery core (`id`, `mode`, `status`, `title`, `content`, `metadata`)
- `feedback[]`
- `drafts[]`
- `pending_feedback_count`

## Feedback APIs

### `POST /api/deliveries/:id/feedback/draft`

Store sidebar drafts (no status change).

```json
{
  "items": [
    {
      "id": "optional",
      "kind": "annotation|interactive",
      "payload": {},
      "target": null
    }
  ]
}
```

### `POST /api/deliveries/:id/feedback/commit`

Commit drafts to feedback entries. Delivery status recalculates to `pending_feedback`.

```json
{
  "items": [
    {
      "kind": "annotation|interactive",
      "payload": {},
      "target": null
    }
  ]
}
```

Response:

```json
{
  "delivery_id": "d_...",
  "feedback_ids": ["f_...", "f_..."],
  "status": "pending_feedback"
}
```

### `POST /api/deliveries/:id/feedback/resolve`

Mark feedback entries handled.

```json
{
  "feedback_ids": ["f_..."],
  "handled_by": "agent"
}
```

If all feedback is handled, status becomes `normal`.

### `POST /api/deliveries/:id/annotate`

Compatibility endpoint to quickly append annotation draft.

```json
{
  "content": "comment text",
  "target": {
    "component_id": "component-1",
    "target_type": "selected_text",
    "anchor": "..."
  }
}
```

## Alignment APIs

### `POST /api/alignment/upsert`

Upsert unique active alignment by `agent_session_id`.

```json
{
  "title": "...",
  "agent_session_id": "session-1",
  "thread_id": "thread-1",
  "metadata": {...},
  "content": {
    "type": "ui_spec",
    "ui_spec": {...}
  }
}
```

Old active alignment is moved to history with terminal state `canceled`.

### `GET /api/alignment/active?agent_session_id=...`

Response:

```json
{
  "active": {
    "id": "d_...",
    "mode": "alignment",
    "alignment_state": "active",
    "thread_id": "thread-1",
    "feedback": []
  },
  "pending_feedback_count": 0,
  "pending_feedback": []
}
```

### `POST /api/alignment/heartbeat`

```json
{
  "agent_session_id": "session-1",
  "thread_id": "thread-1"
}
```

Updates `last_heartbeat_at` for active alignment.

### `POST /api/alignment/cancel`

```json
{
  "agent_session_id": "session-1",
  "thread_id": "thread-1",
  "reason": "thread_closed"
}
```

Marks active alignment as canceled.

### `POST /api/alignment/resolve`

```json
{
  "agent_session_id": "session-1",
  "thread_id": "thread-1",
  "delivery_id": "d_..."
}
```

Marks active alignment as resolved.

## Settings APIs

### `GET /api/settings`

Returns platform configuration:

```json
{
  "platform": {
    "name": "Visual Delivery",
    "logo_url": "",
    "slogan": "Turn work into clear decisions.",
    "visual_style": "executive-brief"
  }
}
```

### `PUT /api/settings`

```json
{
  "platform": {
    "name": "My Delivery Hub",
    "logo_url": "https://...",
    "slogan": "...",
    "visual_style": "minimal"
  }
}
```

## Design Tokens

### `GET /api/design-tokens`

Returns `tokens.json`.

## WebSocket Events

Server-to-client events:

- `connected`
- `new_delivery`
- `update_delivery`
- `feedback_received`
- `alignment_update`
- `settings_updated`
- `design_updated`

Event payload shape:

```json
{
  "event": "update_delivery",
  "data": { "id": "d_...", "status": "pending_feedback" }
}
```

## Error Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "..."
  }
}
```

Common codes:

- `INVALID_REQUEST` (400)
- `NOT_FOUND` (404)
- `THREAD_MISMATCH` (409)
- `DELIVERY_MISMATCH` (409)
- `INTERNAL_ERROR` (500)
