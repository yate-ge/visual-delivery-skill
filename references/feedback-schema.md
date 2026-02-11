# Feedback Payload Schema (v2)

## Table of Contents

- [File Storage](#file-storage)
- [Overview](#overview)
- [Draft Feedback Item](#draft-feedback-item)
- [Committed Feedback Item](#committed-feedback-item)
- [Kinds](#kinds)
- [Target Object](#target-object)
- [Lifecycle Rules](#lifecycle-rules)
- [Examples](#examples)

## File Storage

Committed feedback is stored at:

```
{DATA_DIR}/data/deliveries/{DELIVERY_ID}/feedback.json
```

The file contains a JSON array of committed feedback items. Agent can read this file directly as an alternative to the API endpoint.

## Overview

In v2, all feedback is unified into a single item model. There are two stages:

1. Draft (`feedback/draft`): staged in sidebar.
2. Committed (`feedback/commit`): becomes actionable feedback for agent.

All committed feedback entries are item-level resolvable via `feedback/resolve`.

## Draft Feedback Item

Used by `POST /api/deliveries/:id/feedback/draft`.

```json
{
  "id": "optional",
  "kind": "annotation|interactive",
  "payload": {},
  "target": null,
  "created_at": "optional ISO datetime"
}
```

Fields:

- `id`: optional client-generated id (server generates if absent)
- `kind`: `annotation` or `interactive`
- `payload`: free-form object
- `target`: nullable target pointer
- `created_at`: optional timestamp

## Committed Feedback Item

Persisted in `feedback.json`.

```json
{
  "id": "f_1771000000_001",
  "kind": "annotation",
  "payload": {
    "text": "请把该段结论拆成两条"
  },
  "target": {
    "component_id": "summary-block",
    "target_type": "selected_text",
    "anchor": "current sentence"
  },
  "handled": false,
  "handled_at": null,
  "handled_by": null,
  "created_at": "2026-02-07T08:00:00.000Z"
}
```

Resolution updates:

- `handled = true`
- `handled_at = ISO datetime`
- `handled_by = "agent" | custom string`

## Kinds

### `annotation`

Feedback from selection toolbar on UI components.

Typical payload:

```json
{
  "text": "这个数据口径需要统一",
  "selected_text": "..."
}
```

### `interactive`

Feedback from interactive widgets or direct sidebar input.

Typical payloads:

```json
{ "text": "建议保留方案B" }
```

```json
{
  "component_id": "decision-form",
  "action": "decision_form_submission",
  "values": {
    "decision": "Approve",
    "notes": "looks good"
  }
}
```

```json
{
  "component_id": "critical-review",
  "action": "review_decision",
  "item_id": "A1",
  "decision": "confirm",
  "notes": "术语修正同意"
}
```

```json
{
  "component_id": "file-table",
  "action": "data_view_state",
  "view_mode": "table",
  "query": "api",
  "order_key": "size",
  "order_dir": "desc"
}
```

## Target Object

Optional location pointer:

```json
{
  "component_id": "component-1",
  "target_type": "selected_text|data_view|decision_form|review_table",
  "anchor": "selected text or semantic key"
}
```

## Lifecycle Rules

1. Draft items do not affect delivery status.
2. Commit creates committed feedback items with `handled=false`.
3. Delivery status rule:
   - Any `handled=false` => `pending_feedback`
   - All `handled=true` => `normal`
4. Resolve is item-level, not page-level.

## Examples

### Commit mixed items

```json
{
  "items": [
    {
      "kind": "annotation",
      "payload": {"text": "标题更聚焦"},
      "target": {"component_id": "title", "target_type": "selected_text", "anchor": "..."}
    },
    {
      "kind": "interactive",
      "payload": {"text": "建议默认选项改为第二个"},
      "target": null
    }
  ]
}
```

### Resolve subset

```json
{
  "feedback_ids": ["f_1771000000_001", "f_1771000000_003"],
  "handled_by": "agent"
}
```
