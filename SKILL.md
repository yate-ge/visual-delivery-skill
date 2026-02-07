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

### Step 3: Generate delivery page (Generative UI)

Generate `content.type = "generated_html"` — a complete, self-contained HTML page.

Pipeline:

1. **Requirement Analysis**: define goals, audience, key decision points.
2. **Design Planning**: choose layout, visual style, interaction strategy. Read design tokens from `GET /api/design-tokens` and use `var(--vds-*)` CSS variables.
3. **HTML Generation**: produce a full `<!DOCTYPE html>` page with inline CSS and JS. See [references/generative-ui-guide.md](references/generative-ui-guide.md) for rules.
4. **Feedback Hooks (REQUIRED)**: every page MUST embed at least one interactive feedback element using `data-vd-feedback-*` attributes. These must be visually prominent, dedicated buttons or forms — not hidden or attached to content elements. See [references/generative-ui-guide.md#feedback-requirements](references/generative-ui-guide.md#feedback-requirements) for patterns. Annotation feedback (text selection) is automatic — no agent action needed.
5. **Self-check**: before publishing, verify the HTML contains at least one element with `data-vd-feedback-action`. If none exists, go back to step 4.
6. **Publish**: POST to `/api/deliveries`.

Core principles:

- **Interactive first**: build functional widgets, charts, forms — not walls of text.
- **Visual richness**: use colors, grids, cards, gradients, icons, animations.
- **Self-contained**: single HTML string with inline `<style>` and `<script>`. No external files except CDN libraries.
- **Design tokens**: reference `var(--vds-colors-primary)`, `var(--vds-colors-text)`, etc. The platform injects token values at runtime.
- **Allowed CDNs**: Tailwind CSS (`https://cdn.tailwindcss.com`), Chart.js, Mermaid, D3.js, Highlight.js, and similar visualization/utility libraries.
- **Responsive**: support desktop and mobile viewports.
- **No placeholders**: every element must be functional with real data.
- **Mandatory feedback UI**: every page MUST contain `data-vd-feedback-*` buttons or forms. A page without them is incomplete. Use per-item buttons for review lists, global forms for overall decisions.
- **Feedback UI separation**: `data-vd-feedback-*` attributes must ONLY be on dedicated feedback buttons/forms, never on content interaction elements (expandable sections, cards, tabs). See [references/generative-ui-guide.md](references/generative-ui-guide.md) for patterns and anti-patterns.

Interactive feedback elements (agent embeds in HTML):

```html
<!-- Button feedback -->
<button data-vd-feedback-action="approve"
        data-vd-feedback-label="Approve proposal">
  Approve
</button>

<!-- Form feedback -->
<form data-vd-feedback-action="review_decision"
      data-vd-feedback-label="Code review item 1">
  <select name="decision">
    <option value="confirm">Confirm</option>
    <option value="reject">Reject</option>
    <option value="change_request">Request changes</option>
  </select>
  <textarea name="notes" placeholder="Notes..."></textarea>
  <button type="submit">Submit decision</button>
</form>
```

The platform Bridge Script automatically captures these interactions and routes them to the feedback sidebar. Agent does NOT need to write any postMessage code.

### Step 4: Create delivery

#### Task delivery

Tell user: "Preparing visual delivery..."

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
      "type": "generated_html",
      "html": "<!DOCTYPE html><html>...YOUR GENERATED PAGE...</html>"
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
      "type": "generated_html",
      "html": "<!DOCTYPE html><html>...YOUR GENERATED PAGE...</html>"
    }
  }'
```

Rules:

- One active alignment per `agent_session_id`.
- New alignment replaces old active alignment and marks old one as canceled.
- If wait thread closes, alignment must be canceled.
- Alignment content is generated HTML (same as task_delivery). The platform shell provides the submit/confirm button.

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
- Generative UI guide: [references/generative-ui-guide.md](references/generative-ui-guide.md)
- Feedback payload model: [references/feedback-schema.md](references/feedback-schema.md)
- Design tokens: [references/design-system.md](references/design-system.md)
