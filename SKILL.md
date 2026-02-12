---
name: visual-delivery
description: >
  Delivers task outcomes through a generative UI web interface. Creates visual
  result presentations with structured feedback collection. Use when the agent
  should communicate work visually or collect structured feedback.
  Skip for simple inline text answers.
---

## Visual Delivery

Deliver results through local generative UI pages.

### Paths

```
SKILL_DIR = {directory containing this SKILL.md}
DATA_DIR  = {CWD}/.visual-delivery
```

### Activation (CRITICAL)

When this skill is invoked, IMMEDIATELY execute Step 1 below. Do NOT:
- Output a description or summary of the skill's capabilities
- Paraphrase the skill description from the frontmatter
- Ask "What would you like me to help you with?" or similar open-ended questions

Instead, go directly to Step 1: start the service, show the URL, and ask the remote access question.

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

#### Locale system

UI strings are stored in `{DATA_DIR}/data/locale.json`. The server injects this into every HTML response as `window.__VD_LOCALE__` — zero flash, immediate rendering in the correct language.

Built-in presets exist for `zh` and `en` (`templates/locales/`). For ANY other language, the agent generates the locale at init time.

### Step 1: Ensure service is running

Detect interaction language first — use the **actual language**, not just zh/en:
- Chinese → `lang = zh`
- English → `lang = en`
- Japanese → `lang = ja`
- Korean → `lang = ko`
- Any other → use the appropriate language code

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

#### Step 1b: Generate locale (if needed)

`start.js` uses built-in presets for `zh` and `en`. For any other language, it falls back to English and the agent MUST generate the locale.

Check if locale needs generation: read `{DATA_DIR}/data/locale.json` — if the strings are in the wrong language (e.g., English when user speaks Japanese), generate a new locale.

To generate: read the reference template `{DATA_DIR}/locales/en.json` (contains all required keys). Translate every value to the user's language. Then write via API:

```bash
curl -s -X PUT http://localhost:3847/api/locale \
  -H 'Content-Type: application/json' \
  -d '{ "appTitle": "ビジュアルデリバリー", "settings": "設定", ... }'
```

After writing, tell user to refresh the browser (or the next page load will pick up the new locale automatically).

### Step 1.5: Check trigger mode

Read the current trigger mode from settings:

```bash
curl -s http://localhost:3847/api/settings
```

Check the `trigger_mode` field:

| `trigger_mode` | Behavior |
|----------------|----------|
| `auto` | Always proceed to Step 2 for every task result. |
| `smart` (default) | Proceed to Step 2 only when the result benefits from visual presentation (structured data, code reviews, dashboards, comparisons, multi-item decisions). Skip for simple text answers, confirmations, or short responses — reply with plain text instead. |
| `manual` | Only proceed to Step 2 when the user explicitly requests visual delivery (e.g., "show me visually", "deliver this", "create a delivery page"). Otherwise respond with plain text. |

If the current interaction does not qualify based on trigger_mode, respond normally with plain text and skip Steps 2–4.

### Step 2: Generate delivery page (Generative UI)

Generate `content.type = "generated_html"` — a complete, self-contained HTML page.

Pipeline:

1. **Requirement Analysis**: define goals, audience, key decision points.
2. **Design Planning**: choose layout, visual style, interaction strategy. Read design tokens from `GET /api/design-tokens` and use `var(--vds-*)` CSS variables.
3. **HTML Generation**: produce a full `<!DOCTYPE html>` page with inline CSS and JS. See [references/generative-ui-guide.md](references/generative-ui-guide.md) for rules.
4. **Feedback Hooks (REQUIRED)**: every reviewable item MUST have per-item choice options using `data-vd-feedback-*` button attributes. Options must be **contextually specific** to the content (not generic approve/reject). Each item group MUST also include an always-visible "Other..." text input form for free-text feedback. See [references/generative-ui-guide.md](references/generative-ui-guide.md) for the survey model and patterns. Annotation feedback (text selection) is automatic — no agent action needed.
5. **Self-check**: before publishing, verify the HTML contains at least one element with `data-vd-feedback-action`. If none exists, go back to step 4.
6. **Publish**: POST to `/api/deliveries`.

Core principles:

- **Interactive first**: build functional widgets, charts, forms — not walls of text.
- **Visual richness**: use colors, grids, cards, gradients, icons, animations.
- **Self-contained**: single HTML string with inline `<style>` and `<script>`. No external files except CDN libraries.
- **Design tokens**: reference `var(--vds-colors-primary)`, `var(--vds-colors-text)`, etc. The platform injects token values at runtime.
- **Allowed CDNs**: Tailwind CSS (`https://cdn.tailwindcss.com`), Chart.js, Mermaid, D3.js, Highlight.js, and similar visualization/utility libraries.
- **File links**: to reference local project files, use `http://localhost:3847/api/files/view?path=ABSOLUTE_PATH`. The platform serves files within the project directory. For external URLs, use `target="_blank"` (iframe sandbox allows popups).
- **Responsive**: support desktop and mobile viewports.
- **No placeholders**: every element must be functional with real data.
- **No hidden content**: all content and feedback buttons must be fully visible by default. NEVER use `<details>`/`<summary>`, accordions, collapsible panels, or click-to-expand patterns.
- **Mandatory per-item feedback (survey model)**: every reviewable item MUST have `data-vd-feedback-*` choice buttons plus an always-visible "Other..." text input form. Options must be **contextually specific** — tailored to the actual content, not generic. Do NOT generate global/overall feedback forms — the platform sidebar handles that.
- **Predefined options = buttons**: use `<button>` elements with `data-vd-feedback-*` for predefined choices. Each button click = one complete feedback action.
- **"Other..." option = inline form**: each item group MUST include a `<form data-vd-feedback-action="other_comment">` with a text input and submit button. The form must be always visible (not hidden behind a click). Use the same `data-vd-feedback-item-id` as the predefined buttons.
- **Mutual exclusion**: all buttons and the "Other..." form for the same item share the same `data-vd-feedback-item-id`. Selecting a predefined option deselects any previous choice; submitting "Other..." text replaces any selected predefined option.

Per-item feedback example (survey-style choices):

```html
<!-- Code review: contextually specific options for each issue -->
<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid var(--vds-colors-border,#e2e8f0)">
  <button data-vd-feedback-action="accept_fix"
          data-vd-feedback-label="Issue #1: Missing null check"
          data-vd-feedback-item-id="issue-1">
    Accept Fix
  </button>
  <button data-vd-feedback-action="defer"
          data-vd-feedback-label="Issue #1: Missing null check"
          data-vd-feedback-item-id="issue-1">
    Defer
  </button>
  <button data-vd-feedback-action="wont_fix"
          data-vd-feedback-label="Issue #1: Missing null check"
          data-vd-feedback-item-id="issue-1">
    Won't Fix
  </button>
  <!-- Always-visible "Other..." text input -->
  <form data-vd-feedback-action="other_comment"
        data-vd-feedback-label="Issue #1: Missing null check"
        data-vd-feedback-item-id="issue-1"
        style="display:inline-flex; gap:6px; align-items:center; margin:0">
    <input type="text" name="text" placeholder="Other..."
           style="width:140px; padding:6px 10px; border:1px solid var(--vds-colors-border,#e2e8f0); border-radius:8px; font-size:13px; font-family:inherit">
    <button type="submit"
            style="padding:6px 12px; border:none; border-radius:8px; background:#6b7280; color:#fff; font-size:13px; cursor:pointer">
      Submit
    </button>
  </form>
</div>
```

The platform Bridge Script automatically captures clicks and routes them to the feedback sidebar. Agent does NOT need to write any postMessage code.

### Step 3: Create delivery

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

### Step 4: Process user feedback

When user submits feedback via the UI, the delivery status changes to `pending_feedback`.

#### 4a: Read feedback (lightweight)

Use ONE of these methods — both avoid loading the full HTML content:

**Method 1 — API (preferred):**

```bash
curl -s http://localhost:3847/api/deliveries/{DELIVERY_ID}/feedback
```

Returns:
```json
{
  "delivery_id": "d_...",
  "status": "pending_feedback",
  "pending_count": 2,
  "pending_feedback": [
    {
      "id": "f_...",
      "kind": "interactive",
      "payload": { "action": "accept_fix", "item_id": "issue-1", "label": "..." },
      "handled": false
    }
  ],
  "feedback": [...]
}
```

**Method 2 — Direct file read:**

```
{DATA_DIR}/data/deliveries/{DELIVERY_ID}/feedback.json
```

Read the file and filter for `handled === false` entries.

#### 4b: Act on feedback

Process each pending feedback item according to its `payload.action` and `payload.item_id`. Perform the actual work (fix code, update docs, etc.).

#### 4c: Update delivery page (incremental — NOT full regeneration)

After processing feedback, update the EXISTING delivery HTML to visually mark which items were addressed. Do NOT regenerate the entire page from scratch.

Strategy: read the current HTML from `GET /api/deliveries/{DELIVERY_ID}`, then make **targeted edits** to the relevant sections only. For each processed item:
- Add a visual "resolved" indicator (e.g., green checkmark, strikethrough, "✓ Resolved" badge)
- Keep all other content unchanged

Then push the updated HTML:

```bash
curl -s -X PUT http://localhost:3847/api/deliveries/{DELIVERY_ID}/content \
  -H 'Content-Type: application/json' \
  -d '{
    "content": {
      "type": "generated_html",
      "html": "<!DOCTYPE html>...INCREMENTALLY UPDATED PAGE..."
    }
  }'
```

**Critical**: The updated HTML should be the original with minimal edits — typically just adding CSS classes or small HTML snippets to resolved items. This saves tokens and time vs regenerating the full page.

#### 4d: Resolve feedback

Mark the processed feedback items as handled:

```bash
curl -s -X POST http://localhost:3847/api/deliveries/{DELIVERY_ID}/feedback/resolve \
  -H 'Content-Type: application/json' \
  -d '{
    "feedback_ids": ["f_...", "f_..."],
    "handled_by": "agent"
  }'
```

When all feedback is resolved, delivery status returns to `normal`.

User can also revoke (undo) unhandled feedback via the sidebar UI, or agent can revoke programmatically:

```bash
POST /api/deliveries/:id/feedback/revoke
```

### Step 5: Design and platform settings

- Read current design tokens:

```bash
GET /api/design-tokens
```

- Read/update platform fields (`name`, `logo_url`, `slogan`, `visual_style`):

```bash
GET /api/settings
PUT /api/settings
```

- Language is set at initialization time (Step 1). The Settings page displays it as read-only. To change language, re-initialize the skill with the new language.

- Update locale strings (agent-generated):

```bash
GET /api/locale
PUT /api/locale
```

Tell user after update: "Settings updated. The UI refreshes in real time."

### References

- API endpoints: [references/api.md](references/api.md)
- Generative UI guide: [references/generative-ui-guide.md](references/generative-ui-guide.md)
- Feedback payload model: [references/feedback-schema.md](references/feedback-schema.md)
- Design tokens: [references/design-system.md](references/design-system.md)
