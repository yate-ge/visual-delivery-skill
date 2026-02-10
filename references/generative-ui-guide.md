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

1. **Interactive first**: even for informational content, build functional widgets — sortable tables, interactive charts, filter bars. Never produce a static wall of text.
2. **Visual richness**: use color, layout, cards, gradients, icons, and subtle animations. The page should feel like a crafted product, not a document.
3. **No placeholders**: every element must be functional with real data. Remove any element that cannot be fully realized.
4. **Self-contained**: one HTML string with inline `<style>` and `<script>`. No external files except CDN libraries.
5. **Responsive**: must look good on both desktop (1200px+) and narrow viewports (400px).
6. **Mandatory per-item feedback**: every delivery page MUST include per-item choice options (`data-vd-feedback-*` buttons) for each reviewable item. A page without feedback components is incomplete. Do NOT generate global/overall feedback — the platform sidebar handles that. Options must be contextually specific to the content. See [Per-Item Feedback (Survey Model)](#per-item-feedback-survey-model) and [Feedback Requirements](#feedback-requirements).
7. **No hidden content**: all content and feedback buttons must be fully visible by default. NEVER use `<details>`/`<summary>`, accordions, collapsible panels, or any pattern that hides content behind a click. Users must see all information and feedback controls without extra interaction steps.

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

## Per-Item Feedback (Survey Model)

The feedback system follows a **survey/questionnaire** model. Each item that needs user input is treated as a survey question with multiple-choice options. The user picks one option and the feedback is complete — no additional text input required.

The platform injects a Bridge Script that automatically captures clicks on elements marked with `data-vd-feedback-*` attributes.

### Core concept

Think of every reviewable item as a **survey question**:

- The **item content** (code issue, proposal section, metric) is the question context.
- The **choice options** are `<button>` elements with `data-vd-feedback-action`. Each represents one distinct answer.
- Options are **mutually exclusive** per item (same `data-vd-feedback-item-id`). Selecting a new option automatically deselects the previous one.
- Clicking a predefined option is the **complete feedback action**. No text input needed.
- The platform auto-injects an **"Other..."** option at the end of every option group. Only this option requires text input. Agent MUST NOT generate its own "Other" or free-text input.

### Design principles

- **Contextually specific options**: Options must be tailored to the actual content, not generic. For a code review issue, use "Accept Fix / Defer / Won't Fix" — not "Approve / Reject". For an architecture proposal, use "Adopt / Need POC / Alternative Approach" — not "Yes / No".
- **Visually distinct**: Feedback options must be standalone, clearly visible buttons. They should look like actionable controls, not blend into content.
- **Separated from content interaction**: NEVER put `data-vd-feedback-*` on elements that also serve a content purpose (expandable sections, tabs, sortable headers).
- **Explicit placement**: Place option groups in a dedicated area — below content items, in a table action column, or in a fixed action bar. The user must clearly understand "clicking this submits my choice".

### Anti-patterns (DO NOT do this)

```html
<!-- WRONG: collapsible content hides details behind a click -->
<details>
  <summary>Issue #1: Missing null check</summary>
  <p>Details here...</p>
  <button data-vd-feedback-action="approve_fix">Approve</button>
</details>

<!-- WRONG: feedback attribute on a content interaction element -->
<div class="card" onclick="toggleExpand(this)"
     data-vd-feedback-action="select_item">
  ...
</div>

<!-- WRONG: global overall feedback form (platform sidebar handles this) -->
<form data-vd-feedback-action="overall_decision">
  <select name="decision">...</select>
  <button type="submit">Submit Overall Decision</button>
</form>

<!-- WRONG: generic options not tailored to the content -->
<button data-vd-feedback-action="approve" ...>Approve</button>
<button data-vd-feedback-action="reject" ...>Reject</button>

<!-- WRONG: textarea/text-input alongside options (platform injects "Other..." automatically) -->
<button data-vd-feedback-action="accept" ...>Accept</button>
<textarea placeholder="Add comments..."></textarea>

<!-- WRONG: form with select+textarea (not the survey model) -->
<form data-vd-feedback-action="review_decision">
  <select name="decision">...</select>
  <textarea name="notes" placeholder="Notes..."></textarea>
  <button type="submit">Submit</button>
</form>
```

### Correct pattern — survey-style per-item choices

Each item card shows all content visually, then presents contextually specific choice buttons:

```html
<!-- Code review item: options specific to code issues -->
<div class="card">
  <h3>Issue #1: Missing null check at auth.js:42</h3>
  <p>The <code>user</code> object is accessed without a null guard,
     which can throw TypeError when session expires.</p>
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
    <!-- "Other..." is auto-injected by the platform — do NOT add it -->
  </div>
</div>

<!-- Architecture proposal: options specific to design decisions -->
<div class="card">
  <h3>Proposal A: Migrate to PostgreSQL</h3>
  <p>Replace SQLite with PostgreSQL for better concurrency...</p>
  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid var(--vds-colors-border,#e2e8f0)">
    <button data-vd-feedback-action="adopt"
            data-vd-feedback-label="Proposal A: Migrate to PostgreSQL"
            data-vd-feedback-item-id="proposal-a">
      Adopt
    </button>
    <button data-vd-feedback-action="need_poc"
            data-vd-feedback-label="Proposal A: Migrate to PostgreSQL"
            data-vd-feedback-item-id="proposal-a">
      Need POC First
    </button>
    <button data-vd-feedback-action="alternative"
            data-vd-feedback-label="Proposal A: Migrate to PostgreSQL"
            data-vd-feedback-item-id="proposal-a">
      Consider Alternative
    </button>
  </div>
</div>
```

### How it works

When a user clicks an option button, the Bridge sends to the feedback sidebar:

```json
{
  "kind": "interactive",
  "payload": { "action": "accept_fix", "item-id": "issue-1" },
  "target": { "target_type": "interactive_element", "anchor": "Issue #1: Missing null check" }
}
```

The clicked button gets a visual "selected" state. If the user clicks a different option for the same item, the old choice is deselected and the new one takes its place (mutual exclusion).

### Attribute reference

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-vd-feedback-action` | Yes | Action identifier — a content-specific verb (e.g. `accept_fix`, `defer`, `adopt`, `need_poc`) |
| `data-vd-feedback-label` | No | Human-readable label shown in sidebar (should describe the item, not the action) |
| `data-vd-feedback-item-id` | Yes* | Groups options for mutual exclusion. All buttons for the same item MUST share the same `item-id`. (*Required when multiple options exist per item) |

### Important rules

- The agent does NOT write any `postMessage` code. The Bridge Script handles all communication.
- Annotation feedback (text selection + comment) is fully automatic and global. No agent action needed.
- Buttons with `data-vd-feedback-action` trigger on click. One click = feedback complete.
- The platform auto-injects an **"Other..."** text-input option at the end of every button group. Agent MUST NOT generate its own "Other", "Comment", or free-text input alongside feedback buttons.
- Do NOT use `<form>`, `<select>`, or `<textarea>` for feedback. Use only `<button>` elements with `data-vd-feedback-*` attributes. The survey model is buttons-only.

## File Links

To link to local project files from within generated pages:

```html
<!-- View a local file -->
<a href="http://localhost:3847/api/files/view?path=/absolute/path/to/file.js"
   target="_blank">
  View file.js
</a>

<!-- External URLs also work (sandbox allows popups) -->
<a href="https://github.com/user/repo" target="_blank">GitHub Repo</a>
```

The `/api/files/view` endpoint serves files within the project directory with correct MIME types. Always use `target="_blank"` for links — the iframe sandbox allows popups.

## JavaScript Guidelines

- Use `DOMContentLoaded` to ensure DOM is ready.
- Wrap complex logic in `try...catch` with `console.error`.
- All JS must be self-contained within the page. Do NOT access `window.parent` or `window.top`.
- Do NOT use `localStorage` or `sessionStorage`.
- Do NOT trigger `alert()`, `confirm()`, or `prompt()` dialogs.

## Feedback Requirements

Every delivery page **MUST** include interactive feedback elements. A page without `data-vd-feedback-*` components is considered incomplete.

### Choosing the right options

Only generate **per-item** choice options. Do NOT generate global/overall feedback forms — the platform's FeedbackSidebar already provides free-text and overall feedback functionality.

Design options that are **specific to the content domain**:

| Content type | Example contextual options |
|---|---|
| Code review issues | Accept Fix / Defer / Won't Fix / Needs Refactor |
| Architecture proposals | Adopt / Need POC First / Consider Alternative |
| Design mockups | Looks Good / Adjust Layout / Rethink Approach |
| Data quality findings | Confirmed / False Positive / Need More Data |
| Dependency updates | Upgrade Now / Schedule Later / Pin Current Version |
| Security vulnerabilities | Patch Immediately / Accept Risk / Mitigate Differently |
| Test failures | Fix Required / Known Flaky / Environment Issue |

### Per-item choices (most common)

When the page presents a list of items that each need a decision, add choice buttons **inside** each item card, visually separated from the content:

```html
<div class="item-card">
  <h3>Issue #1: Missing null check at auth.js:42</h3>
  <p>The <code>user</code> object is accessed without a null guard...</p>

  <!-- Choice options — visually distinct, at the bottom of the card -->
  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid var(--vds-colors-border,#e2e8f0)">
    <button data-vd-feedback-action="accept_fix"
            data-vd-feedback-label="Issue #1: Missing null check"
            data-vd-feedback-item-id="issue-1"
            style="padding:6px 16px; background:#10b981; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600">
      Accept Fix
    </button>
    <button data-vd-feedback-action="defer"
            data-vd-feedback-label="Issue #1: Missing null check"
            data-vd-feedback-item-id="issue-1"
            style="padding:6px 16px; background:var(--vds-colors-surface,#f1f5f9); color:var(--vds-colors-text,#1e293b); border:1px solid var(--vds-colors-border,#e2e8f0); border-radius:8px; cursor:pointer">
      Defer
    </button>
    <button data-vd-feedback-action="wont_fix"
            data-vd-feedback-label="Issue #1: Missing null check"
            data-vd-feedback-item-id="issue-1"
            style="padding:6px 16px; background:var(--vds-colors-surface,#f1f5f9); color:var(--vds-colors-text,#1e293b); border:1px solid var(--vds-colors-border,#e2e8f0); border-radius:8px; cursor:pointer">
      Won't Fix
    </button>
    <!-- "Other..." auto-injected by platform -->
  </div>
</div>
```

## Common Patterns

### Data table with row-level choices

```html
<table>
  <thead><tr><th>Item</th><th>Status</th><th>Decision</th></tr></thead>
  <tbody>
    <tr>
      <td>api/auth.js:42</td>
      <td>Missing null check</td>
      <td style="display:flex; gap:6px">
        <button data-vd-feedback-action="accept_fix"
                data-vd-feedback-label="auth.js:42"
                data-vd-feedback-item-id="auth-42"
                style="padding:4px 12px; border-radius:6px; border:1px solid var(--vds-colors-border,#e2e8f0); background:var(--vds-colors-surface,#f8fafc); cursor:pointer; font-size:13px">
          Accept Fix
        </button>
        <button data-vd-feedback-action="defer"
                data-vd-feedback-label="auth.js:42"
                data-vd-feedback-item-id="auth-42"
                style="padding:4px 12px; border-radius:6px; border:1px solid var(--vds-colors-border,#e2e8f0); background:var(--vds-colors-surface,#f8fafc); cursor:pointer; font-size:13px">
          Defer
        </button>
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
8. **Collapsible/expandable content** — never use `<details>`, accordions, or toggle-to-show patterns. All content must be visible by default.
9. **Global feedback forms** — do not generate "overall decision" or "overall review" forms. The platform sidebar handles global feedback.
10. **Redundant "Other" or free-text input** — do not generate "Other", "Comment", or text input alongside feedback buttons. The Bridge Script auto-injects an "Other..." option for every button group.
11. **Generic options** — do not use generic "Approve / Reject" for every item. Options must be contextually specific to the actual content (e.g. "Accept Fix / Defer / Won't Fix" for code issues).
12. **Using `<form>`, `<select>`, or `<textarea>` for feedback** — the feedback model is buttons-only. Each option is a single `<button>` click. Do not use form elements.
