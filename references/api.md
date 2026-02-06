# API Reference

## Table of Contents

- [Health Check](#health-check)
- [Create Delivery](#create-delivery)
- [List Deliveries](#list-deliveries)
- [Get Delivery](#get-delivery)
- [Submit Feedback](#submit-feedback)
- [Add Annotation](#add-annotation)
- [Get Session](#get-session)
- [Get Design Tokens](#get-design-tokens)

Base URL: `http://localhost:3847`

---

## Health Check

```
GET /health
```

Response: `{ "status": "ok", "uptime": 3600, "version": "1.0.0" }`

---

## Create Delivery

```
POST /api/deliveries
Content-Type: application/json
```

Body:
```json
{
  "mode": "passive|interactive|blocking",
  "title": "string (required)",
  "content": { "type": "markdown|html", "body": "string" },
  "feedback_schema": null | { schema object }
}
```

- `feedback_schema` required for interactive/blocking, null for passive

Response (201):
```json
{
  "id": "d_1738850400_001",
  "url": "http://localhost:3847/d/d_1738850400_001",
  "session_id": "s_1738850400_001"
}
```

`session_id` only present for blocking mode.

---

## List Deliveries

```
GET /api/deliveries
GET /api/deliveries?mode=blocking&status=awaiting_feedback
```

Query: `mode`, `status`, `limit` (default 50), `offset` (default 0)

Response: `{ "deliveries": [...], "total": 12 }`

---

## Get Delivery

```
GET /api/deliveries/:id
```

Returns full delivery with annotations and feedback inline.

---

## Submit Feedback

```
POST /api/deliveries/:id/feedback
Content-Type: application/json
```

Body: `{ "values": { ... } }`

Updates delivery status to "completed". If blocking, updates session.

---

## Add Annotation

```
POST /api/deliveries/:id/annotate
Content-Type: application/json
```

Body:
```json
{
  "type": "comment|highlight",
  "content": "string",
  "target": null | { "type": "text_range", "start": 45, "end": 78 }
}
```

---

## Get Session

```
GET /api/sessions/:session_id
```

Response statuses: `waiting`, `responded`, `timeout`

When `responded`: includes `response` field with user's feedback values.

---

## Get Design Tokens

```
GET /api/design-tokens
```

Returns current tokens.json content.

---

## Error Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Delivery d_xxx not found"
  }
}
```

Codes: `INVALID_REQUEST` (400), `NOT_FOUND` (404), `ALREADY_RESPONDED` (409), `INTERNAL_ERROR` (500)
