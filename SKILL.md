---
name: visual-delivery
description: >
  Delivers task outcomes through a generative UI web interface with two modes:
  task_delivery (result presentation + feedback collection) and alignment
  (decision/confirmation pages that block agent progress). Use when the agent
  should communicate work visually, collect structured feedback, or wait for
  session-scoped confirmation. Skip for simple inline text answers.
---

## Visual Delivery

Deliver results and alignment requests through local generative UI pages.

### Paths

```
SKILL_DIR = {directory containing this SKILL.md}
DATA_DIR  = {CWD}/.visual-delivery
```

### User-facing output rules

- Keep startup responses concise and task-oriented.
- Language MUST align with the user's current turn language.
- If user writes Chinese, all skill output and generated UI text must be Chinese.
- If user writes English, all skill output and generated UI text must be English.
- Do NOT output capability menus like "你现在可以 1/2/3" after startup.
- Do NOT ask open-ended questions like "你想做什么？" after startup.
- Do NOT append onboarding checklists or "next step menus" unless user explicitly asks for options.
- After startup, only report readiness + path info (if first run) + remote access choice.

### Language model (required)

- Define `conversation_lang`: follows the user's current input language every turn.
- Define `platform_lang`: language used by the Visual Delivery web UI.
- On first initialization, set `platform_lang = conversation_lang` and persist it in `.visual-delivery/data/settings.json`.
- For later turns, do NOT auto-switch `platform_lang` with conversation language.
- `platform_lang` can only change when:
  1) user changes it in Settings page, or
  2) user explicitly asks to change platform language (then call `PUT /api/settings`).
- Agent chat replies use `conversation_lang`; generated delivery page text uses `platform_lang`.

### Step 1: Ensure service is running

Detect interaction language first:
- Chinese user input -> `lang = zh`
- otherwise -> `lang = en`

Tell user startup message in matched language:
- `zh`: "正在启动视觉交付服务..."
- `en`: "Starting Visual Delivery service..."

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR} --lang {lang}
```

Parse stdout JSON:

| `status` | Action |
|----------|--------|
| `started` | Continue. If `first_run` is true, tell user where design spec is created. |
| `already_running` | Continue. |
| `error` | Tell user the `message` and stop. |

Tell user ready message in matched language:
- `zh`: "视觉交付服务已就绪：{local_url}"
- `en`: "Visual Delivery ready at {local_url}".

If `first_run` is true, also tell user in matched language:
- `zh`: "设计规范已初始化：{design_spec_path}"
- `en`: "Design spec initialized at {design_spec_path}".

Immediately ask remote access choice in matched language (specific, not open-ended):

- `zh`:
  > 服务当前可通过本地地址访问：{local_url}
  > 如需外部访问，请选择：
  > 1) 开放 3847 端口用于局域网/公网访问
  > 2) 启动临时公网隧道（需要 `cloudflared`）
  >
  > 回复：`仅本地` 或 `启动隧道`

- `en`:
  > The service is available locally at {local_url}.
  > For external access, choose one:
  > 1) Open network access to port 3847
  > 2) Start a temporary public tunnel (requires `cloudflared`)
  >
  > Reply with: `local only` or `start tunnel`.

If user chooses tunnel:

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR} --remote
```

If `remote_url` is returned, tell user the tunnel URL.

### Step 2: Choose mode

- Use **task_delivery** for visual task reporting and feedback collection.
- Use **alignment** for session-scoped decisions where agent needs confirmation.

### Step 3: Build UI spec

Always generate `content.type = "ui_spec"` and include:

- `metadata`: `project_name`, `task_name`, `generated_at`, `audience`
- `ui_spec.version = "2.0"`
- `ui_spec.layout`
- `ui_spec.components`
- `ui_spec.bindings`
- `ui_spec.feedback_hooks`
- `ui_spec.sidebar_contract`

Pipeline (strict):

1. Requirement Confirm: define goals, audience, key decision points.
2. Information Architecture: define sections and evidence mapping.
3. Interaction Strategy: include content interaction + annotation feedback + interactive feedback.
   - For item-by-item review workflows, prefer `review_table` so users can submit `confirm/reject/change_request` per row.
4. UI Spec Generation: output `ui_spec v2`.
5. Validation & Publish: ensure schema validity and feedback path completeness.

### Step 4: Create delivery

#### Task delivery

Tell user: "Preparing visual task delivery..."

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "task_delivery",
    "title": "YOUR TITLE",
    "metadata": {
      "project_name": "YOUR PROJECT",
      "task_name": "YOUR TASK",
      "generated_at": "ISO_TIME",
      "audience": "stakeholder"
    },
    "content": {
      "type": "ui_spec",
      "ui_spec": YOUR_UI_SPEC_JSON
    }
  }'
```

Tell user: "View the delivery at {url}".

#### Alignment delivery (session-unique)

Tell user: "Creating alignment page for your confirmation..."

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "alignment",
    "title": "YOUR ALIGNMENT TITLE",
    "agent_session_id": "YOUR_AGENT_SESSION_ID",
    "thread_id": "YOUR_WAIT_THREAD_ID",
    "metadata": {
      "project_name": "YOUR PROJECT",
      "task_name": "YOUR TASK",
      "generated_at": "ISO_TIME",
      "audience": "decision-maker"
    },
    "content": {
      "type": "ui_spec",
      "ui_spec": YOUR_UI_SPEC_JSON
    }
  }'
```

Rules:

- One active alignment per `agent_session_id`.
- New alignment replaces old active alignment and marks old one as canceled.
- If wait thread closes, alignment must be canceled.

### Step 5: Wait for alignment feedback

Use wait script for blocking flow:

```bash
node {SKILL_DIR}/scripts/await-feedback.js \
  --title "YOUR ALIGNMENT TITLE" \
  --agent-session-id "YOUR_AGENT_SESSION_ID" \
  --thread-id "YOUR_WAIT_THREAD_ID" \
  --ui-spec-file "YOUR_UI_SPEC_FILE.json" \
  --metadata '{"project_name":"...","task_name":"..."}'
```

Script semantics:

- registers/upserts alignment
- heartbeat every 2 seconds
- if thread exits, alignment is canceled
- if user submits feedback, script returns `status: responded`
- timeout returns `status: timeout` and cancels alignment

### Step 6: Feedback lifecycle

All UI feedback flows through sidebar and one confirm submit button.

- Draft stage:

```bash
POST /api/deliveries/:id/feedback/draft
```

- Commit stage:

```bash
POST /api/deliveries/:id/feedback/commit
```

- Agent resolve stage:

```bash
POST /api/deliveries/:id/feedback/resolve
```

Delivery status logic:

- `pending_feedback`: any feedback item has `handled=false`
- `normal`: all feedback items handled

### Step 7: Alignment lifecycle operations

- Get active alignment:

```bash
GET /api/alignment/active?agent_session_id=...
```

- Cancel active alignment:

```bash
POST /api/alignment/cancel
```

- Resolve active alignment (after agent receives confirmation):

```bash
POST /api/alignment/resolve
```

### Step 8: Design and platform settings

- Read current design tokens:

```bash
GET /api/design-tokens
```

- Read/update platform fields (`name`, `logo_url`, `slogan`, `visual_style`) and `language`:

```bash
GET /api/settings
PUT /api/settings
```

Tell user after update: "Settings updated. The UI refreshes in real time."

### References

- API endpoints: [references/api.md](references/api.md)
- Feedback payload model: [references/feedback-schema.md](references/feedback-schema.md)
- Design tokens: [references/design-system.md](references/design-system.md)
