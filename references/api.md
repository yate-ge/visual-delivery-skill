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
    "type": "generated_html",
    "html": "<!DOCTYPE html><html><head>...</head><body>...</body></html>"
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

Returns delivery with `feedback`, `drafts`, `execution_events`, and `pending_feedback_count`.

Response fields:

- delivery core (`id`, `mode`, `status`, `title`, `content`, `metadata`)
- `feedback[]`
- `drafts[]`
- `execution_events[]`
- `pending_feedback_count`

### `GET /api/deliveries/:id/execution-events`

Get execution timeline events for this delivery.

Response:

```json
{
  "delivery_id": "d_...",
  "events": [
    {
      "id": "e_...",
      "feedback_id": "f_...",
      "stage": "queued|in_progress|completed|failed|info",
      "message": "string",
      "actor": "user|agent|system",
      "meta": {},
      "created_at": "ISO datetime"
    }
  ]
}
```

### `POST /api/deliveries/:id/execution-events`

Append execution timeline event(s).

```json
{
  "events": [
    {
      "feedback_id": "f_...",
      "stage": "in_progress",
      "message": "Applying requested changes to content.md",
      "actor": "agent",
      "meta": {}
    }
  ]
}
```

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

### `POST /api/deliveries/:id/feedback/revoke`

Revoke (undo) unhandled feedback entries. Only removes items where `handled === false`.

```json
{
  "feedback_ids": ["f_..."]
}
```

Response:

```json
{
  "delivery_id": "d_...",
  "revoked_count": 1,
  "status": "normal"
}
```

### `PUT /api/deliveries/:id/content`

Update delivery content (for agent post-processing after feedback).

```json
{
  "content": {
    "type": "generated_html",
    "html": "<!DOCTYPE html>..."
  },
  "title": "Optional new title"
}
```

Response:

```json
{
  "delivery_id": "d_...",
  "updated_at": "ISO datetime"
}
```

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
    "type": "generated_html",
    "html": "<!DOCTYPE html>..."
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

## File View

### `GET /api/files/view?path=...`

Serves local project files for viewing in generated pages. Restricted to the project directory (parent of DATA_DIR).

Query params:

- `path` (required) — absolute or relative file path

Response: file content with detected MIME type.

Error codes:

- `INVALID_REQUEST` (400) — missing path
- `FORBIDDEN` (403) — path outside project directory
- `NOT_FOUND` (404) — file does not exist

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
- `content_updated`
- `feedback_revoked`

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
