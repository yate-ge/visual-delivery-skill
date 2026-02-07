---
name: visual-delivery
description: >
  Delivers ALL task results as rich visual UI through a web interface. Two-phase model:
  (1) User explicitly initializes by saying "start visual delivery" or similar.
  (2) Once initialized ({CWD}/.visual-delivery/server.pid exists), the skill is ALWAYS
  active — every task result MUST be delivered as visual UI (mermaid diagrams, interactive
  tables, visual architecture, etc.), NOT plain text or diffs.
  IMPORTANT: On EVERY interaction, check if {CWD}/.visual-delivery/server.pid exists.
  If yes, this skill is active and you MUST use it for all output.
---

## Visual Delivery / 任务交付平台

Deliver task results as rich visual UI — mermaid diagrams, interactive tables,
visual architecture layouts — through a local web interface.

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
| **Uninitialized** | `server.pid` does not exist | Skill is dormant. Only activate when user explicitly requests initialization (e.g., "start visual delivery", "启动任务交付", "initialize delivery"). |
| **Initialized** | `server.pid` exists | Skill is **ALWAYS ACTIVE**. Go to Step 1, then deliver ALL task results as rich visual UI. No exceptions. |

**Once initialized, EVERY task result MUST be delivered as rich visual UI.** This includes:
- Architecture designs → mermaid diagrams + visual layout
- Code analysis results → interactive tables, visual dependency graphs
- Investigation reports → structured visual summaries
- File changes → visual diff with interactive review
- Test results → visual dashboard
- Any structured output → appropriate visual representation

The ONLY things that stay as plain text:
- Direct conversational replies (greetings, short clarifications, yes/no answers)
- Error messages about the skill itself failing

### Step 0: Explicit initialization (first time only)

When the user explicitly requests initialization:

**Detect user language**: If the user communicates in Chinese, use `--lang zh`. Otherwise use `--lang en`.

Tell user: "Starting Visual Delivery service..." / "正在启动任务交付平台..."

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR} --lang {LANG}
```

Parse JSON from stdout. Handle these statuses:

| `status` | Action |
|----------|--------|
| `started` | Continue. If `first_run` is true, tell user about the design spec path. |
| `already_running` | Continue, no action needed |
| `error` | Tell user the error `message`. Stop. |

Tell user: "Visual Delivery ready at {local_url}" / "任务交付平台已就绪：{local_url}"

**After successful initialization, ask user about remote access:**

Tell user (adapt to their language):
> The service is running locally at {local_url}.
> If you need remote access, you have two options:
> 1. Ensure port 3847 is open on your network for direct access
> 2. I can start a temporary tunnel (requires cloudflared) for a public URL
>
> Do you need remote access? (If not, we'll continue with local access only.)

If user wants tunnel:
```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR} --remote
```

**After successful initialization, the skill is now ALWAYS ACTIVE for this project.**


### Step 1: Ensure service is running (every interaction when initialized)

Before delivering results, verify the server is healthy:

```bash
curl -s http://localhost:3847/health
```

If healthy → proceed to Step 2.

If NOT healthy → restart the server (detect user language for --lang):

```bash
node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR} --lang {LANG}
```

### Step 2: Deliver results as RICH VISUAL UI

**CRITICAL: You are NOT delivering plain text, diffs, or simple markdown.**
**You are generating VISUAL UI CODE — HTML with embedded CSS/JS that creates interactive, visual experiences.**

Choose the delivery mode, then generate rich visual content:

- You want to **SHOW** visual results → `passive`
- You want to **COLLECT** feedback via interactive UI → `interactive`
- You **CANNOT** continue without user input → `blocking`

#### Content types

Choose the best content type for each delivery:

**`markdown` with mermaid** — For content that benefits from diagrams:
```json
{
  "type": "markdown",
  "body": "## Architecture Overview\n\n```mermaid\ngraph TD\n  A[Client] --> B[API Gateway]\n  B --> C[Service A]\n  B --> D[Service B]\n```\n\nThe system uses a microservices architecture..."
}
```

**`html`** — For rich interactive content (PREFERRED for complex results):
```json
{
  "type": "html",
  "body": "<div id='app'>...</div><style>...</style><script>...</script>"
}
```

When generating HTML content, create SELF-CONTAINED HTML with:
- Inline `<style>` for styling (use CSS variables from the host: `var(--vds-colors-primary)`, etc.)
- Inline `<script>` for interactivity
- CDN libraries when needed (e.g., mermaid from CDN for complex diagrams)
- No external dependencies that require npm install

#### Visual content examples

**Architecture design** → Mermaid diagram + visual component layout:
```json
{
  "type": "html",
  "body": "<div><div id='diagram'></div><script src='https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js'></script><script>mermaid.initialize({startOnLoad:true}); document.getElementById('diagram').innerHTML = '<div class=\"mermaid\">graph TD\\n  A-->B</div>'; mermaid.run();</script></div>"
}
```

**Interactive confirmation table** → Checkboxes for user to review items:
```json
{
  "type": "html",
  "body": "<style>.item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--vds-colors-border)}.item:hover{background:var(--vds-colors-surface)}.item input{width:18px;height:18px}.confirmed{color:var(--vds-colors-success)}</style><div id='items'></div><script>const items=[{name:'Item 1',status:'pending'},{name:'Item 2',status:'pending'}];function render(){document.getElementById('items').innerHTML=items.map((it,i)=>`<div class='item'><input type='checkbox' ${it.status==='confirmed'?'checked':''} onchange='toggle(${i})'><span class='${it.status}'>${it.name}</span></div>`).join('')}function toggle(i){items[i].status=items[i].status==='confirmed'?'pending':'confirmed';render()}render();</script>"
}
```

**Visual summary with metrics** → Dashboard-style layout:
```json
{
  "type": "html",
  "body": "<style>.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.card{padding:20px;background:var(--vds-colors-surface);border:1px solid var(--vds-colors-border);border-radius:var(--vds-spacing-border-radius)}.card h3{font-size:13px;color:var(--vds-colors-text-secondary);margin:0 0 8px}.card .value{font-size:28px;font-weight:600;color:var(--vds-colors-text)}</style><div class='grid'><div class='card'><h3>Files Changed</h3><div class='value'>12</div></div><div class='card'><h3>Lines Added</h3><div class='value'>+340</div></div></div>"
}
```

#### Passive delivery

Tell user: "Preparing visual delivery..." / "正在准备可视化交付..."

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "passive",
    "title": "YOUR TITLE",
    "content": {"type": "html", "body": "YOUR RICH HTML CONTENT"}
  }'
```

Tell user: "View the delivery at {url}" / "查看交付结果：{url}"

#### Interactive delivery

```bash
curl -s -X POST http://localhost:3847/api/deliveries \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "interactive",
    "title": "YOUR TITLE",
    "content": {"type": "html", "body": "YOUR RICH HTML CONTENT"},
    "feedback_schema": YOUR_SCHEMA
  }'
```

See [references/feedback-schema.md](references/feedback-schema.md) for schema types.

#### Blocking delivery

Tell user: "I need your input." / "需要您的确认。"

```bash
node {SKILL_DIR}/scripts/await-feedback.js \
  --title "YOUR TITLE" \
  --content "YOUR MARKDOWN OR HTML CONTENT" \
  --schema '{"type":"select","prompt":"YOUR PROMPT","options":["opt1","opt2"]}'
```

Parse JSON from stdout:

| `status` | Action |
|----------|--------|
| `responded` | Process `response`, tell user thanks |
| `timeout` | Tell user: "Please visit {url} when ready." Do NOT retry. |
| `error` | Tell user the error message. |

### Step 3: Read feedback and annotations

```
Read {DATA_DIR}/data/deliveries/{id}/feedback.json
Read {DATA_DIR}/data/deliveries/{id}/annotations.json
```

### Step 4: Design customization (when requested)

1. Read `{DATA_DIR}/design/design-spec.md`
2. Read `{DATA_DIR}/design/tokens.json`
3. Update `{DATA_DIR}/design/tokens.json`
4. Tell user: "Design tokens updated. The UI will refresh automatically."

### Deactivation

When the user says "stop visual delivery" / "停止任务交付" or similar:

```bash
node {SKILL_DIR}/scripts/stop.js --data-dir {DATA_DIR}
```

### References

- [references/feedback-schema.md](references/feedback-schema.md) — Feedback schema types
- [references/api.md](references/api.md) — API endpoints
- [references/design-system.md](references/design-system.md) — Design system tokens
