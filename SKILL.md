---
name: visual-delivery
description: >
  Delivers task results visually through a web interface. Supports three modes:
  passive (display reports, diffs, summaries), interactive (collect feedback,
  reviews, approvals), and blocking (wait for user decisions before continuing).
  Activates when the agent needs to present structured results, request user
  review, or obtain a decision required to proceed. Does not activate for
  simple text responses or terminal-inline answers.
---

## Visual Delivery

Present task results through a local web interface with feedback collection
and real-time design customization.

### Paths

```
SKILL_DIR = {directory containing this SKILL.md}
DATA_DIR  = {CWD}/.visual-delivery
```

### Step 1: Ensure service is running

Tell user: "Starting Visual Delivery service..."

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR}
```

Parse JSON from stdout. Handle these statuses:

| `status` | Action |
|----------|--------|
| `started` | Continue. If `first_run` is true, tell user: "Design specification created at {design_spec_path}. Edit to customize the UI." |
| `already_running` | Continue, no action needed |
| `error` | Tell user the error `message`. Stop. |

Tell user: "Visual Delivery ready at {local_url}"

If `remote_url` is present, also tell user the remote URL.

### Step 2: Deliver results

Choose the delivery mode based on your need:

- You want to **SHOW** results → `passive`
  Examples: test report, code diff, generated documentation

- You want to **COLLECT** feedback but can continue working → `interactive`
  Examples: code review request, design review, satisfaction survey

- You **CANNOT** continue without user input → `blocking`
  Examples: deployment target selection, destructive action confirmation,
  ambiguous requirement clarification

#### Passive delivery

Tell user: "Preparing visual delivery..."

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "passive",
    "title": "YOUR TITLE",
    "content": {"type": "markdown", "body": "YOUR MARKDOWN CONTENT"}
  }'
```

Tell user: "View the delivery at {url}" (from response JSON).

#### Interactive delivery

Tell user: "Creating interactive delivery for your review..."

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "interactive",
    "title": "YOUR TITLE",
    "content": {"type": "markdown", "body": "YOUR MARKDOWN CONTENT"},
    "feedback_schema": YOUR_SCHEMA
  }'
```

Tell user: "Review and provide feedback at {url}"

See [references/feedback-schema.md](references/feedback-schema.md) for schema types.

#### Blocking delivery

Tell user: "I need your input. Opening delivery for your response..."

```bash
node {SKILL_DIR}/scripts/await-feedback.js \
  --title "YOUR TITLE" \
  --content "YOUR MARKDOWN CONTENT" \
  --schema '{"type":"select","prompt":"YOUR PROMPT","options":["opt1","opt2"]}'
```

Parse JSON from stdout:

| `status` | Action |
|----------|--------|
| `responded` | Process `response`, tell user "Thanks for your feedback" |
| `timeout` | Tell user: "No response received within 5 minutes. Please visit {url} when you're ready." Do NOT retry. Do NOT create a new blocking delivery. |
| `error` | Tell user the error message. Check if server is running. |

### Step 3: Read feedback and annotations

After a delivery, read per-delivery files to see user feedback:

```
Read {DATA_DIR}/data/deliveries/{id}/feedback.json    → array of feedback entries
Read {DATA_DIR}/data/deliveries/{id}/annotations.json  → array of annotations
```

Tell user what feedback was received and what action you will take.

To check if a blocking delivery was responded to after timeout:
```
Read {DATA_DIR}/data/deliveries/{id}/session.json → check "status" field
```

To list all deliveries:
```
Read {DATA_DIR}/data/index.json → array of delivery summaries
```

### Step 4: Design customization (when requested)

When the user asks to change the visual design:

1. Read `{DATA_DIR}/design/design-spec.md` for design intent
2. Read `{DATA_DIR}/design/tokens.json` for current values
3. Update `{DATA_DIR}/design/tokens.json` to apply changes
4. Tell user: "Design tokens updated. The UI will refresh automatically."

The user can also edit tokens.json directly — changes apply instantly.

See [references/design-system.md](references/design-system.md) for token format.

### References

**Feedback schema types**: See [references/feedback-schema.md](references/feedback-schema.md)
**API endpoints**: See [references/api.md](references/api.md)
**Design system**: See [references/design-system.md](references/design-system.md)
