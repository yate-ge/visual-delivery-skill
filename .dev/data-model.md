# Data Model

## Storage Location

All runtime data is stored under the user's working directory:

```
{CWD}/.visual-delivery/
├── data/
│   ├── deliveries.json           ← all delivery records
│   ├── annotations.json          ← user annotations on deliveries
│   ├── feedback-responses.json   ← user feedback submissions
│   └── sessions.json             ← active blocking sessions
├── custom/
│   └── theme.json                ← user theme overrides (optional)
└── logs/
    └── server.log                ← server output log
```

The `.visual-delivery/` directory is auto-created by `start.sh` on first run.

Consider adding `.visual-delivery/` to the project's `.gitignore`.

## JSON File Formats

### deliveries.json

Array of delivery records. Append-only during normal operation.

```jsonc
[
  {
    "id": "d_1738850400_001",       // format: d_{unix_timestamp}_{seq}
    "mode": "passive",              // "passive" | "interactive" | "blocking"
    "status": "delivered",          // see Status Lifecycle below
    "title": "API Refactoring Complete",
    "content": {
      "type": "markdown",           // "markdown" | "html"
      "body": "## Summary\n..."
    },
    "feedback_schema": null,        // null for passive; object for interactive/blocking
    "created_at": "2026-02-06T14:00:00.000Z",
    "completed_at": null            // set when feedback received or manually closed
  },
  {
    "id": "d_1738850400_002",
    "mode": "interactive",
    "status": "awaiting_feedback",
    "title": "Review API Design",
    "content": {
      "type": "markdown",
      "body": "## Proposed API\n..."
    },
    "feedback_schema": {
      "type": "form",
      "fields": [
        { "name": "approval", "type": "select", "label": "Decision", "options": ["approve", "reject", "needs-changes"] },
        { "name": "notes", "type": "textarea", "label": "Comments", "placeholder": "Any feedback..." }
      ]
    },
    "created_at": "2026-02-06T14:05:00.000Z",
    "completed_at": null
  },
  {
    "id": "d_1738850400_003",
    "mode": "blocking",
    "status": "completed",
    "title": "Choose Deploy Target",
    "content": {
      "type": "markdown",
      "body": "Build is ready. Where should I deploy?"
    },
    "feedback_schema": {
      "type": "select",
      "prompt": "Select deployment environment",
      "options": ["staging", "production", "dev"],
      "multiple": false
    },
    "created_at": "2026-02-06T14:10:00.000Z",
    "completed_at": "2026-02-06T14:10:45.000Z"
  }
]
```

### Status Lifecycle

```
passive:      delivered (terminal)

interactive:  delivered → awaiting_feedback → completed
              (status changes to awaiting_feedback on creation since schema is present)
              (status changes to completed when first feedback is submitted)

blocking:     delivered → awaiting_feedback → completed
              (same as interactive, but agent is actively polling)
              (can also → timeout if await-feedback.sh times out)
```

| Status | Meaning |
|--------|---------|
| `delivered` | Content published, no feedback expected (passive only) |
| `awaiting_feedback` | Feedback schema present, waiting for user response |
| `completed` | User has submitted feedback |
| `timeout` | Blocking session timed out without response |

### annotations.json

Array of user annotations. Each annotation references a delivery.

```jsonc
[
  {
    "id": "a_1738850500_001",        // format: a_{unix_timestamp}_{seq}
    "delivery_id": "d_1738850400_001",
    "type": "comment",               // "comment" | "highlight"
    "content": "This endpoint should use PATCH, not PUT",
    "target": {                      // optional: what the annotation refers to
      "type": "text_range",          // "text_range" | "line" | "section"
      "start": 45,                   // character offset in content body
      "end": 78
    },
    "created_at": "2026-02-06T14:30:00.000Z"
  },
  {
    "id": "a_1738850500_002",
    "delivery_id": "d_1738850400_001",
    "type": "comment",
    "content": "Good approach overall",
    "target": null,                  // null = general comment on the delivery
    "created_at": "2026-02-06T14:31:00.000Z"
  }
]
```

### feedback-responses.json

Array of feedback submissions. One entry per user response to an interactive/blocking delivery.

```jsonc
[
  {
    "id": "f_1738850600_001",
    "delivery_id": "d_1738850400_002",
    "values": {
      "approval": "needs-changes",
      "notes": "The error response format should follow RFC 7807"
    },
    "created_at": "2026-02-06T14:35:00.000Z"
  },
  {
    "id": "f_1738850600_002",
    "delivery_id": "d_1738850400_003",
    "values": {
      "value": "staging"
    },
    "created_at": "2026-02-06T14:10:45.000Z"
  }
]
```

### sessions.json

Active blocking sessions only. Cleaned up after completion or timeout.

```jsonc
[
  {
    "id": "s_1738850700_001",
    "delivery_id": "d_1738850400_003",
    "status": "waiting",              // "waiting" | "responded" | "timeout"
    "response": null,                 // populated when user responds
    "created_at": "2026-02-06T14:10:00.000Z",
    "timeout_at": "2026-02-06T14:15:00.000Z",  // created_at + timeout
    "responded_at": null
  }
]
```

When the user submits feedback for a blocking delivery:
1. Server writes to `feedback-responses.json` (permanent record)
2. Server updates the session in `sessions.json` (status → "responded", response populated)
3. Server updates delivery in `deliveries.json` (status → "completed")
4. `await-feedback.sh` poll loop detects "responded" and returns the response

## Feedback Schema Types

The `feedback_schema` field defines what UI the browser renders. Supported types:

### confirm

```jsonc
{
  "type": "confirm",
  "prompt": "Deploy to production?",
  "confirm_label": "Yes, deploy",    // optional, default: "Confirm"
  "cancel_label": "Cancel"           // optional, default: "Cancel"
}
// Response: { "value": true } or { "value": false }
```

### select

```jsonc
{
  "type": "select",
  "prompt": "Choose deployment environment",
  "options": ["staging", "production", "dev"],
  "multiple": false                   // optional, default: false
}
// Single: { "value": "staging" }
// Multiple: { "value": ["staging", "dev"] }
```

### form

```jsonc
{
  "type": "form",
  "fields": [
    {
      "name": "priority",
      "type": "select",               // "text" | "number" | "textarea" | "select" | "checkbox"
      "label": "Priority",
      "options": ["P0", "P1", "P2"],  // only for type:"select"
      "required": true                 // optional, default: false
    },
    {
      "name": "description",
      "type": "textarea",
      "label": "Description",
      "placeholder": "Describe the issue...",
      "required": false
    }
  ]
}
// Response: { "values": { "priority": "P1", "description": "..." } }
```

### rating

```jsonc
{
  "type": "rating",
  "prompt": "How satisfied are you with this result?",
  "max": 5                            // optional, default: 5
}
// Response: { "value": 4 }
```

## ID Generation

All IDs follow the pattern: `{prefix}_{unix_seconds}_{sequence}`

| Entity | Prefix | Example |
|--------|--------|---------|
| Delivery | `d_` | `d_1738850400_001` |
| Annotation | `a_` | `a_1738850500_001` |
| Feedback | `f_` | `f_1738850600_001` |
| Session | `s_` | `s_1738850700_001` |

Sequence resets per second. Server generates IDs; agent never creates IDs directly.

## File Locking

JSON files may be written concurrently by the server (handling browser requests) and read by the agent. Strategy:

- Server uses atomic writes (write to temp file, then rename) to prevent partial reads
- Agent reads are always safe (worst case: slightly stale data, retry on next read)
- No explicit file locking needed for this use case
