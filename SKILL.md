---
name: visual-delivery
description: >
  Delivers ALL task results through a visual web interface. Two-phase model:
  (1) User explicitly initializes by saying "start visual delivery" or similar.
  (2) Once initialized ({CWD}/.visual-delivery exists), the skill is ALWAYS
  active — every task result MUST be delivered visually. Supports passive
  (display), interactive (feedback), and blocking (decision) modes.
  IMPORTANT: On EVERY interaction, check if {CWD}/.visual-delivery/server.pid
  exists. If yes, this skill is active and you MUST use it for all output.
---

## Visual Delivery

Present task results through a local web interface with feedback collection
and real-time design customization.

### Paths

```
SKILL_DIR = {directory containing this SKILL.md}
DATA_DIR  = {CWD}/.visual-delivery
```

### Activation Rule (CHECK ON EVERY INTERACTION)

**At the start of EVERY user interaction**, determine the skill state:

```
Check: does {DATA_DIR}/server.pid exist?
```

| State | Condition | Action |
|-------|-----------|--------|
| **Uninitialized** | `server.pid` does not exist | Skill is dormant. Only activate when user explicitly requests initialization (e.g., "start visual delivery", "启动可视化交付", "initialize delivery"). |
| **Initialized** | `server.pid` exists | Skill is **ALWAYS ACTIVE**. Go to Step 1, then deliver ALL task results through the visual interface. No exceptions. |

**Once initialized, EVERY task result MUST be delivered visually.** This includes:
- Code generation / modification summaries
- Analysis and investigation reports
- File change diffs
- Test results
- Any structured output

The ONLY things that stay as plain text:
- Direct conversational replies (greetings, short clarifications, yes/no answers)
- Error messages about the skill itself failing

### Step 0: Explicit initialization (first time only)

When the user explicitly requests initialization:

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

**After successful initialization, the skill is now ALWAYS ACTIVE for this project.**

### Step 1: Ensure service is running (every interaction when initialized)

Before delivering results, verify the server is healthy:

```bash
curl -s http://localhost:3847/health
```

If healthy → proceed to Step 2.

If NOT healthy → restart the server:

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR}
```

Parse JSON and handle as in Step 0. Then proceed to Step 2.

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

### Deactivation

When the user says "stop visual delivery" or similar:

```bash
node {SKILL_DIR}/scripts/stop.js --data-dir {DATA_DIR}
```

Tell user: "Visual Delivery stopped. Results will be delivered as plain text."

### References

**Feedback schema types**: See [references/feedback-schema.md](references/feedback-schema.md)
**API endpoints**: See [references/api.md](references/api.md)
**Design system**: See [references/design-system.md](references/design-system.md)
