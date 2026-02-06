# API Specification

## Base URL

```
http://localhost:3847
```

When remote access is enabled via cloudflared:
```
https://{random}.trycloudflare.com
```

## REST API

### Health Check

```
GET /health
```

**Response:**
```json
{ "status": "ok", "uptime": 3600, "version": "1.0.0" }
```

Used by agent to check if server is running before delivering content.

---

### Create Delivery

```
POST /api/deliveries
Content-Type: application/json
```

**Request Body:**
```jsonc
{
  "mode": "passive",                 // required: "passive" | "interactive" | "blocking"
  "title": "Task Result Title",      // required: string
  "content": {                       // required
    "type": "markdown",              // "markdown" | "html"
    "body": "## Result\n..."         // string
  },
  "feedback_schema": null            // required for interactive/blocking, null for passive
}
```

**Response (201 Created):**
```json
{
  "id": "d_1738850400_001",
  "url": "http://localhost:3847/d/d_1738850400_001",
  "session_id": "s_1738850400_001"
}
```

Notes:
- `session_id` is only present when `mode` is `"blocking"`
- Server creates `data/deliveries/{id}/` directory with delivery.json, annotations.json, feedback.json
- For blocking mode, also creates `session.json` in the delivery directory
- Server appends summary to `data/index.json`
- Server pushes `new_delivery` event via WebSocket to connected browsers

---

### List Deliveries

```
GET /api/deliveries
GET /api/deliveries?mode=blocking
GET /api/deliveries?status=awaiting_feedback
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `mode` | string | Filter by mode |
| `status` | string | Filter by status |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

**Response (200):**
```json
{
  "deliveries": [ ... ],
  "total": 12
}
```

---

### Get Single Delivery

```
GET /api/deliveries/:id
```

**Response (200):**
```json
{
  "id": "d_1738850400_001",
  "mode": "passive",
  "status": "delivered",
  "title": "...",
  "content": { "type": "markdown", "body": "..." },
  "feedback_schema": null,
  "annotations": [ ... ],
  "feedback": [ ... ],
  "created_at": "...",
  "completed_at": null
}
```

This endpoint returns the delivery with its associated annotations and feedback
responses inline for convenience (browser uses this to render the full page).

---

### Add Annotation

```
POST /api/deliveries/:id/annotate
Content-Type: application/json
```

**Request Body:**
```jsonc
{
  "type": "comment",                // "comment" | "highlight"
  "content": "This should use PATCH",
  "target": {                       // optional
    "type": "text_range",
    "start": 45,
    "end": 78
  }
}
```

**Response (201):**
```json
{
  "id": "a_1738850500_001",
  "delivery_id": "d_1738850400_001"
}
```

---

### Submit Feedback

```
POST /api/deliveries/:id/feedback
Content-Type: application/json
```

**Request Body:**
```jsonc
{
  "values": {
    "approval": "needs-changes",
    "notes": "Error format should follow RFC 7807"
  }
}
```

**Response (201):**
```json
{
  "id": "f_1738850600_001",
  "delivery_id": "d_1738850400_002"
}
```

Side effects (all writes use file locking):
- Appends feedback to `data/deliveries/{id}/feedback.json`
- Updates delivery status to `"completed"` in `data/deliveries/{id}/delivery.json`
- Updates status in `data/index.json`
- If delivery has an active blocking session: updates `data/deliveries/{id}/session.json` (status → `"responded"`)
- Pushes `feedback_received` event via WebSocket

---

### Get Design Tokens

```
GET /api/design-tokens
```

**Response (200):**
```json
{
  "colors": {
    "primary": "#2563EB",
    "background": "#FFFFFF",
    "text": "#1E293B"
  },
  "typography": {
    "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-size-base": "15px"
  },
  "spacing": {
    "page-padding": "24px",
    "border-radius": "8px"
  },
  "components": { ... }
}
```

Returns the current design tokens from `{DATA_DIR}/design/tokens.json`.

The frontend fetches this on load and applies as CSS variables.
Changes to tokens.json are pushed to the browser via WebSocket (`design_updated` event).

---

### Poll Session Status (Blocking Mode)

```
GET /api/sessions/:session_id
```

**Response (200):**
```jsonc
// While waiting:
{
  "id": "s_1738850700_001",
  "status": "waiting",
  "response": null
}

// After user responds:
{
  "id": "s_1738850700_001",
  "status": "responded",
  "response": {
    "value": "staging"
  }
}

// After timeout:
{
  "id": "s_1738850700_001",
  "status": "timeout",
  "response": null
}
```

This endpoint is called by `await-feedback.js` in a polling loop.

---

## WebSocket Protocol

WebSocket endpoint: `ws://localhost:3847/ws`

The WebSocket is **server → browser only** for push notifications. The browser
uses REST API (not WebSocket) for submitting data.

### Events (Server → Browser)

#### new_delivery
Sent when a new delivery is created.

```json
{
  "event": "new_delivery",
  "data": {
    "id": "d_1738850400_001",
    "mode": "blocking",
    "title": "Choose Deploy Target",
    "status": "awaiting_feedback"
  }
}
```

#### update_delivery
Sent when a delivery is updated (e.g., content change).

```json
{
  "event": "update_delivery",
  "data": {
    "id": "d_1738850400_001",
    "status": "completed"
  }
}
```

#### feedback_received
Sent when feedback is submitted (to update other open browser tabs).

```json
{
  "event": "feedback_received",
  "data": {
    "delivery_id": "d_1738850400_001",
    "feedback_id": "f_1738850600_001"
  }
}
```

#### design_updated
Sent when `{DATA_DIR}/design/tokens.json` is modified (file watcher).

```json
{
  "event": "design_updated",
  "data": {
    "colors": { ... },
    "typography": { ... },
    "spacing": { ... },
    "components": { ... }
  }
}
```

The frontend receives this and updates CSS variables on `:root` without page reload.

### Connection Lifecycle

1. Browser connects to `ws://localhost:3847/ws` on SPA load
2. Server sends all pending blocking deliveries as `new_delivery` events
3. Browser receives real-time updates for the lifetime of the connection
4. On disconnect, browser auto-reconnects with exponential backoff

## Error Responses

All error responses follow the same format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Delivery d_xxx not found"
  }
}
```

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `INVALID_REQUEST` | Missing required fields, invalid schema |
| 404 | `NOT_FOUND` | Delivery or session not found |
| 409 | `ALREADY_RESPONDED` | Feedback already submitted for blocking session |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
