# Generative UI Guide

Rules for generating delivery page HTML. The agent produces a **complete, self-contained HTML page** rendered inside a sandboxed iframe.

## HTML Structure

Every generated page must be a full HTML document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Title</title>
  <!-- Optional CDN libraries -->
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Custom styles using design tokens */
    body {
      font-family: var(--vds-typography-font-family, system-ui, sans-serif);
      color: var(--vds-colors-text, #1e293b);
      background: var(--vds-colors-background, #ffffff);
      margin: 0;
      padding: 24px;
    }
  </style>
</head>
<body>
  <!-- Content here -->
  <script>
    // Interactive logic here
  </script>
</body>
</html>
```

## Core Philosophy

1. **Interactive first**: even for informational content, build functional widgets — sortable tables, expandable sections, interactive charts. Never produce a static wall of text.
2. **Visual richness**: use color, layout, cards, gradients, icons, and subtle animations. The page should feel like a crafted product, not a document.
3. **No placeholders**: every element must be functional with real data. Remove any element that cannot be fully realized.
4. **Self-contained**: one HTML string with inline `<style>` and `<script>`. No external files except CDN libraries.
5. **Responsive**: must look good on both desktop (1200px+) and narrow viewports (400px).
6. **Mandatory feedback UI**: every delivery page MUST include at least one interactive feedback element (`data-vd-feedback-*`). A page without feedback components is incomplete. See [Feedback requirements](#feedback-requirements) below.

## Design Tokens

The platform injects CSS custom properties into the iframe at runtime. Reference them with `var(--vds-*)`. Common tokens:

| Token | Description |
|-------|-------------|
| `--vds-colors-primary` | Primary accent color |
| `--vds-colors-text` | Main text color |
| `--vds-colors-text-secondary` | Secondary/muted text |
| `--vds-colors-background` | Page background |
| `--vds-colors-surface` | Card/panel background |
| `--vds-colors-border` | Border color |
| `--vds-colors-danger` | Error/danger accent |
| `--vds-typography-font-family` | Base font family |
| `--vds-typography-font-family-mono` | Monospace font |
| `--vds-spacing-border-radius` | Default border radius |

Always provide fallback values: `var(--vds-colors-primary, #3b82f6)`.

## Allowed CDN Libraries

Use CDN `<script>` or `<link>` tags in `<head>`:

- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js`
- **Mermaid**: `https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js`
- **D3.js**: `https://cdn.jsdelivr.net/npm/d3`
- **Highlight.js**: `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release/build/highlight.min.js`
- **Marked** (markdown): `https://cdn.jsdelivr.net/npm/marked/marked.min.js`

Other well-known CDN libraries are allowed if needed.

## Interactive Feedback Elements

The platform injects a Bridge Script that automatically captures user interactions on elements marked with `data-vd-feedback-*` attributes.

### Design principles

- **Visually distinct**: Feedback elements must be standalone, clearly visible UI components (buttons, forms). They should look like actionable controls, not blend into content.
- **Separated from content interaction**: NEVER put `data-vd-feedback-*` on elements that also serve a content purpose (expandable sections, collapsible panels, tabs, accordion triggers, sortable headers). Content interaction and feedback submission must be completely independent.
- **Explicit placement**: Place feedback buttons/forms in a dedicated area — below content items, in a table action column, or in a fixed action bar. The user must clearly understand "clicking this submits feedback".

### Anti-patterns (DO NOT do this)

```html
<!-- WRONG: feedback attribute on an expandable content element -->
<details data-vd-feedback-action="review_item">
  <summary>Issue #1: Missing null check</summary>
  <p>Details here...</p>
</details>

<!-- WRONG: feedback attribute on a card that also has click-to-expand -->
<div class="card" onclick="toggleExpand(this)"
     data-vd-feedback-action="select_item">
  ...
</div>
```

Instead, separate content interaction from feedback:

```html
<!-- CORRECT: content element is independent, feedback button is separate -->
<details>
  <summary>Issue #1: Missing null check</summary>
  <p>Details here...</p>
  <button data-vd-feedback-action="approve_fix"
          data-vd-feedback-label="Approve fix for Issue #1"
          data-vd-feedback-item-id="issue-1">
    Approve Fix
  </button>
</details>
```

### Button feedback

```html
<button data-vd-feedback-action="approve"
        data-vd-feedback-label="Approve proposal"
        data-vd-feedback-item-id="proposal-1">
  Approve
</button>
```

When clicked, the Bridge sends to the feedback sidebar:
```json
{
  "kind": "interactive",
  "payload": { "action": "approve", "item-id": "proposal-1" },
  "target": { "target_type": "interactive_element", "anchor": "Approve proposal" }
}
```

### Form feedback

```html
<form data-vd-feedback-action="review_decision"
      data-vd-feedback-label="Review item 3">
  <select name="decision">
    <option value="confirm">Confirm</option>
    <option value="reject">Reject</option>
    <option value="change_request">Request changes</option>
  </select>
  <textarea name="notes" placeholder="Notes..."></textarea>
  <button type="submit">Submit</button>
</form>
```

On submit, Bridge collects all form field values and sends:
```json
{
  "kind": "interactive",
  "payload": {
    "action": "review_decision",
    "fields": { "decision": "confirm", "notes": "Looks good" }
  },
  "target": { "target_type": "interactive_form", "anchor": "Review item 3" }
}
```

### Attribute reference

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-vd-feedback-action` | Yes | Action identifier (e.g. `approve`, `review_decision`, `rate`) |
| `data-vd-feedback-label` | No | Human-readable label shown in sidebar |
| `data-vd-feedback-*` | No | Any additional `data-vd-feedback-` attribute is included in payload |

### Important

- The agent does NOT write any `postMessage` code. The Bridge Script handles all communication.
- Annotation feedback (text selection + comment) is fully automatic and global. No agent action needed.
- Form elements inside a `[data-vd-feedback-action]` form use their `name` attribute as the field key.
- Buttons with `data-vd-feedback-action` outside a form trigger on click.
- Forms with `data-vd-feedback-action` trigger on submit and prevent default navigation.

## JavaScript Guidelines

- Use `DOMContentLoaded` to ensure DOM is ready.
- Wrap complex logic in `try...catch` with `console.error`.
- All JS must be self-contained within the page. Do NOT access `window.parent` or `window.top`.
- Do NOT use `localStorage` or `sessionStorage`.
- Do NOT trigger `alert()`, `confirm()`, or `prompt()` dialogs.

## Feedback Requirements

Every delivery page **MUST** include interactive feedback elements. A page without `data-vd-feedback-*` components is considered incomplete.

### Choosing the right feedback pattern

| Content type | Recommended feedback pattern |
|---|---|
| Review with multiple items (code review, document issues, audit) | Per-item approve/reject buttons + optional batch action at bottom |
| Proposal or plan | Global approve / request changes / reject buttons |
| Data report or dashboard | Rating or satisfaction form at bottom |
| Comparison or options | Selection buttons per option |

### Per-item feedback (most common)

When the page presents a list of items that each need a decision, add a dedicated feedback button or form **inside** each item card, visually separated from the content:

```html
<div class="item-card">
  <h3>Issue #1: Missing null check at auth.js:42</h3>
  <p>Details about the issue...</p>

  <!-- Feedback buttons — visually distinct, at the bottom of the card -->
  <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--vds-colors-border,#e2e8f0)">
    <button data-vd-feedback-action="accept_fix"
            data-vd-feedback-label="Accept fix for Issue #1"
            data-vd-feedback-item-id="issue-1"
            style="padding:6px 16px; background:#10b981; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600">
      Accept Fix
    </button>
    <button data-vd-feedback-action="reject_fix"
            data-vd-feedback-label="Skip Issue #1"
            data-vd-feedback-item-id="issue-1"
            style="padding:6px 16px; background:var(--vds-colors-surface,#f1f5f9); color:var(--vds-colors-text,#1e293b); border:1px solid var(--vds-colors-border,#e2e8f0); border-radius:8px; cursor:pointer">
      Skip
    </button>
  </div>
</div>
```

### Global feedback (bottom of page)

For overall approval or rating, place a prominent feedback form at the bottom of the page:

```html
<div style="margin-top:32px; padding:24px; background:var(--vds-colors-surface,#f8fafc); border:1px solid var(--vds-colors-border,#e2e8f0); border-radius:12px">
  <h3 style="margin:0 0 16px">Overall Decision</h3>
  <form data-vd-feedback-action="overall_decision"
        data-vd-feedback-label="Overall review decision"
        style="display:flex; flex-direction:column; gap:12px">
    <select name="decision" style="padding:8px; border-radius:8px; border:1px solid var(--vds-colors-border,#e2e8f0)">
      <option value="approve">Approve all</option>
      <option value="partial">Apply selected fixes</option>
      <option value="reject">Reject all</option>
    </select>
    <textarea name="notes" placeholder="Additional notes..." rows="3"
              style="padding:8px; border-radius:8px; border:1px solid var(--vds-colors-border,#e2e8f0)"></textarea>
    <button type="submit"
            style="padding:10px; background:var(--vds-colors-primary,#3b82f6); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600">
      Submit Decision
    </button>
  </form>
</div>
```

## Common Patterns

### Data table with row-level review

```html
<table>
  <thead><tr><th>Item</th><th>Status</th><th>Action</th></tr></thead>
  <tbody>
    <tr>
      <td>api/auth.js:42</td>
      <td>Missing null check</td>
      <td>
        <form data-vd-feedback-action="review_decision"
              data-vd-feedback-label="auth.js:42">
          <select name="decision">
            <option value="confirm">Accept fix</option>
            <option value="reject">Skip</option>
          </select>
          <button type="submit">Submit</button>
        </form>
      </td>
    </tr>
  </tbody>
</table>
```

### Metric dashboard

```html
<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px">
  <div style="background:var(--vds-colors-surface); border-radius:12px; padding:20px">
    <div style="font-size:13px; color:var(--vds-colors-text-secondary)">Total Tests</div>
    <div style="font-size:32px; font-weight:700; color:var(--vds-colors-text)">142</div>
  </div>
  <!-- more metric cards -->
</div>
```

### Chart with Chart.js

```html
<canvas id="myChart" width="400" height="200"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  new Chart(document.getElementById('myChart'), {
    type: 'bar',
    data: { labels: ['Jan','Feb','Mar'], datasets: [{ data: [10,20,30] }] }
  });
});
</script>
```

## Common Mistakes to Avoid

1. **Missing `<!DOCTYPE html>`** — always include full document structure.
2. **Forgetting fallback values** for CSS variables — `var(--vds-colors-text, #1e293b)`.
3. **Using `window.parent`** — forbidden in sandboxed iframe.
4. **Generating only text** — always add visual structure, even for simple results.
5. **External file references** — all CSS/JS must be inline or from CDN.
6. **Not escaping HTML in data** — use `textContent` instead of `innerHTML` for user data.
7. **Using `localStorage`** — not available in sandboxed context.
