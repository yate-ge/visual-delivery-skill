# Data Model

## Storage Location

All runtime data is stored under the user's working directory:

```
{CWD}/.visual-delivery/
├── server/                             ← Server instance (from template)
│   ├── package.json
│   ├── node_modules/
│   └── ...
├── ui/                                 ← Frontend instance (from template)
│   ├── package.json
│   ├── node_modules/
│   ├── dist/                           ← Built static files
│   └── src/
├── design/                             ← Design system instance (user-editable)
│   ├── design-spec.md                  ← Design specification (human-readable)
│   └── tokens.json                     ← Design tokens (machine-readable)
├── data/                               ← Runtime data (per-delivery instance)
│   ├── index.json                      ← Lightweight delivery index
│   └── deliveries/                     ← One directory per delivery
│       ├── d_1738850400_001/
│       │   ├── delivery.json           ← Full delivery record
│       │   ├── annotations.json        ← Annotations for this delivery
│       │   └── feedback.json           ← Feedback for this delivery
│       ├── d_1738850400_002/
│       │   ├── delivery.json
│       │   ├── annotations.json
│       │   ├── feedback.json
│       │   └── session.json            ← Only for blocking deliveries
│       └── ...
├── logs/
│   └── server.log                      ← Server output log
├── server.pid                          ← Server process ID
└── tunnel.pid                          ← Tunnel process ID (optional)
```

The `.visual-delivery/` directory is auto-created by `start.js` on first run.
Templates from the skill directory are copied here on initialization.

Consider adding `.visual-delivery/` to the project's `.gitignore`.

## Per-Delivery Instance Architecture

Data is organized **per delivery instance** rather than in monolithic arrays.
Each delivery gets its own directory under `data/deliveries/`.

### Benefits

| Benefit | Explanation |
|---------|-------------|
| Agent reads only what it needs | `Read data/deliveries/{id}/feedback.json` — no parsing large arrays |
| Less lock contention | Writing feedback for delivery A doesn't block delivery B |
| Files stay small | No growing monolithic arrays |
| Clean isolation | Delete a delivery by removing its directory |
| Simpler concurrency | Fewer write conflicts across deliveries |

### Tradeoff: Dashboard Listing

Listing all deliveries requires reading multiple directories. Solved by
maintaining a lightweight **index.json** that contains only summary fields.
The server updates index.json on every delivery create/status change.

## JSON File Formats

### index.json (Delivery Index)

Lightweight array of delivery summaries. Used by the Dashboard API and
for quick lookups. All writes use file locking.

```jsonc
[
  {
    "id": "d_1738850400_001",
    "mode": "passive",
    "status": "delivered",
    "title": "API Refactoring Complete",
    "created_at": "2026-02-06T14:00:00.000Z",
    "completed_at": null
  },
  {
    "id": "d_1738850400_002",
    "mode": "interactive",
    "status": "awaiting_feedback",
    "title": "Review API Design",
    "created_at": "2026-02-06T14:05:00.000Z",
    "completed_at": null
  },
  {
    "id": "d_1738850400_003",
    "mode": "blocking",
    "status": "completed",
    "title": "Choose Deploy Target",
    "created_at": "2026-02-06T14:10:00.000Z",
    "completed_at": "2026-02-06T14:10:45.000Z"
  }
]
```

**Fields in index.json:** Only `id`, `mode`, `status`, `title`, `created_at`, `completed_at`.
No `content`, no `feedback_schema` — those live in the per-delivery `delivery.json`.

### delivery.json (Per-Delivery)

Full delivery record. One file per delivery at `data/deliveries/{id}/delivery.json`.

```jsonc
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
}
```

Example with feedback schema (interactive/blocking):

```jsonc
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
```

### Status Lifecycle

```
passive:      delivered (terminal)

interactive:  awaiting_feedback → completed
              (status is awaiting_feedback on creation since schema is present)
              (status changes to completed when first feedback is submitted)

blocking:     awaiting_feedback → completed
              (same as interactive, but agent is actively polling)
              (can also → timeout if await-feedback.js times out)
              NOTE: timeout does NOT cancel the delivery — user can still respond later
```

| Status | Meaning |
|--------|---------|
| `delivered` | Content published, no feedback expected (passive only) |
| `awaiting_feedback` | Feedback schema present, waiting for user response |
| `completed` | User has submitted feedback |
| `timeout` | Blocking session timed out — delivery stays open for later response |

### annotations.json (Per-Delivery)

Array of user annotations for this delivery. Located at
`data/deliveries/{id}/annotations.json`. Initialized as `[]`.

```jsonc
[
  {
    "id": "a_1738850500_001",        // format: a_{unix_timestamp}_{seq}
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
    "type": "comment",
    "content": "Good approach overall",
    "target": null,                  // null = general comment on the delivery
    "created_at": "2026-02-06T14:31:00.000Z"
  }
]
```

Note: `delivery_id` is not stored here — it is implicit from the directory path.

### feedback.json (Per-Delivery)

Array of feedback submissions for this delivery. Located at
`data/deliveries/{id}/feedback.json`. Initialized as `[]`.

```jsonc
[
  {
    "id": "f_1738850600_001",
    "values": {
      "approval": "needs-changes",
      "notes": "The error response format should follow RFC 7807"
    },
    "created_at": "2026-02-06T14:35:00.000Z"
  }
]
```

For blocking deliveries with simple schemas, the values mirror the schema:

```jsonc
[
  {
    "id": "f_1738850600_002",
    "values": {
      "value": "staging"
    },
    "created_at": "2026-02-06T14:10:45.000Z"
  }
]
```

Note: `delivery_id` is not stored — implicit from directory path.

### session.json (Per-Delivery, Blocking Only)

Single object (not array). Only exists for blocking deliveries. Located at
`data/deliveries/{id}/session.json`.

```jsonc
{
  "id": "s_1738850700_001",
  "status": "waiting",              // "waiting" | "responded" | "timeout"
  "response": null,                 // populated when user responds
  "created_at": "2026-02-06T14:10:00.000Z",
  "timeout_at": "2026-02-06T14:15:00.000Z",  // created_at + timeout
  "responded_at": null
}
```

Note: `delivery_id` is not stored — implicit from directory path.

## Server Write Operations

When the server creates a delivery:
1. Generate delivery ID
2. Create directory `data/deliveries/{id}/`
3. Write `delivery.json` with full record
4. Write `annotations.json` as `[]`
5. Write `feedback.json` as `[]`
6. If blocking: write `session.json`
7. Acquire lock on `index.json`, append summary entry, release lock
8. Broadcast `new_delivery` via WebSocket

When the user submits feedback for a delivery:
1. Acquire lock on `data/deliveries/{id}/feedback.json`
2. Append feedback entry
3. Release lock
4. Update `delivery.json` status → `"completed"`
5. If blocking: update `session.json` (status → `"responded"`, populate response)
6. Acquire lock on `index.json`, update status of this delivery
7. Release lock
8. Broadcast `feedback_received` via WebSocket

On timeout:
1. `await-feedback.js` exits with `"status": "timeout"`
2. The delivery remains in `awaiting_feedback` status — NOT cancelled
3. If user responds later, server still processes the feedback normally
4. Agent can read `data/deliveries/{id}/session.json` later to check if user responded after timeout

## Agent Read Patterns

The agent reads data files directly using the Read tool:

| Agent wants to... | Reads |
|-------------------|-------|
| List all deliveries | `data/index.json` |
| See a specific delivery | `data/deliveries/{id}/delivery.json` |
| Read feedback for a delivery | `data/deliveries/{id}/feedback.json` |
| Read annotations for a delivery | `data/deliveries/{id}/annotations.json` |
| Check blocking session status | `data/deliveries/{id}/session.json` |

Agent reads are always safe (worst case: slightly stale data, retry on next read).

## Design System Files

### design-spec.md

Human-readable design specification. See [design-system.md](./design-system.md)
for template content and customization workflow.

### tokens.json

Machine-readable design tokens. See [design-system.md](./design-system.md)
for format specification and CSS variable mapping.

## Feedback Schema Types

The `feedback_schema` field in `delivery.json` defines what UI the browser
renders. Supported types:

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
The delivery ID also serves as its directory name under `data/deliveries/`.

## File Locking

Per-delivery files are locked independently, reducing contention:

- **index.json** — locked for create/update (brief: append or update one entry)
- **Per-delivery files** — locked only when writing to that specific delivery
- Different deliveries never contend for the same lock

Lock implementation uses lockfile with `O_EXCL` (atomic check-and-create).
See [server-design.md](./server-design.md) for lock implementation details.
