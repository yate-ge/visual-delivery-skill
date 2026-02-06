# Design System Specification

## Overview

The Visual Delivery Skill includes a design system that controls the visual
appearance of all delivered content. The design system follows the
**template → instance** pattern:

- **Skill directory** contains default templates (`templates/design/`)
- **Work directory** contains the active instance (`{DATA_DIR}/design/`)
- Users customize by editing the instance files; templates are never overwritten

## Design System Files

### In Skill Directory (templates, read-only)

```
templates/design/
├── design-spec.md          ← Design specification template (human-readable)
└── tokens.json             ← Default design tokens (machine-readable)
```

### In Work Directory (instance, user-editable)

```
{DATA_DIR}/design/
├── design-spec.md          ← Design specification (user + agent can edit)
└── tokens.json             ← Design tokens (drives all CSS variables)
```

## Two-File Architecture

### design-spec.md (Human-Readable Specification)

The design spec is a markdown document that describes the design language in
human-readable terms. It serves two audiences:

1. **Users** — read and edit to express design preferences
2. **Agents** — read to understand design intent, update tokens.json accordingly

The design spec includes:
- Brand identity (colors, personality)
- Typography choices with rationale
- Spacing and layout philosophy
- Component-level guidelines
- Accessibility requirements

When a user edits `design-spec.md`, the agent can read it and update
`tokens.json` to reflect the new design intent. The spec does NOT directly
drive the CSS — `tokens.json` does.

### tokens.json (Machine-Readable Design Tokens)

The tokens file is the **single source of truth** for all visual styling.
It maps directly to CSS custom properties that drive every component.

When `tokens.json` changes:
1. Server's file watcher detects the change
2. Server validates the JSON format
3. Server broadcasts `design_updated` via WebSocket
4. Frontend receives the event and updates CSS variables on `:root`
5. All components re-render with new styles (no page reload)

Users can also edit `tokens.json` directly for quick style changes without
going through the design spec.

## Design Spec Template

The following is the template for `design-spec.md`, copied to the work
directory on first initialization:

```markdown
# Visual Delivery - Design Specification

This document describes the visual design language for your Visual Delivery
interface. Edit this file to express your design preferences, then ask the
agent to update the design tokens accordingly.

You can also edit `tokens.json` directly for immediate changes.

## Brand

- **Name**: Visual Delivery
- **Personality**: Clean, professional, focused
- **Primary color**: Blue (#2563EB) — conveys trust and clarity

## Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary action | Blue | #2563EB |
| Primary hover | Dark blue | #1D4ED8 |
| Background | White | #FFFFFF |
| Surface (cards) | Light gray | #F8FAFC |
| Primary text | Dark slate | #1E293B |
| Secondary text | Slate | #64748B |
| Borders | Light slate | #E2E8F0 |
| Success | Green | #16A34A |
| Warning | Amber | #F59E0B |
| Danger / Blocking | Red | #DC2626 |
| Blocking background | Light red | #FEF2F2 |
| Blocking border | Light coral | #FCA5A5 |
| Interactive background | Light orange | #FFF7ED |
| Interactive border | Light amber | #FDBA74 |

## Typography

- **Body font**: System font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
  - Rationale: Native feel, fast loading, no web font dependency
- **Code font**: 'SF Mono', 'Fira Code', monospace
- **Base size**: 15px — slightly larger than default for readability
- **Line height**: 1.6 — generous for comfortable reading

## Spacing

- **Page padding**: 24px
- **Card padding**: 16px
- **Border radius**: 8px — slightly rounded, modern feel

## Component Guidelines

### Blocking Alert
- Background: danger color at low opacity
- Animation: gentle pulse to draw attention without being jarring
- Position: fixed top bar, above all content

### Code Blocks
- Theme: GitHub-style light theme
- Line numbers: enabled
- Font: monospace stack

### Delivery Cards
- Subtle border, elevated on hover
- Status badge: color-coded by mode
- Timestamp: relative format ("2 min ago")

## Accessibility

- Maintain WCAG 2.1 AA contrast ratios
- All interactive elements must have focus indicators
- Color is not the sole indicator of status (use icons + text)
```

## Design Tokens Format

The `tokens.json` file uses a flat namespace organized by category:

```jsonc
{
  "colors": {
    "primary": "#2563EB",
    "primary-hover": "#1D4ED8",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "text": "#1E293B",
    "text-secondary": "#64748B",
    "border": "#E2E8F0",
    "success": "#16A34A",
    "warning": "#F59E0B",
    "danger": "#DC2626",
    "blocking-bg": "#FEF2F2",
    "blocking-border": "#FCA5A5",
    "interactive-bg": "#FFF7ED",
    "interactive-border": "#FDBA74"
  },
  "typography": {
    "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-family-mono": "'SF Mono', 'Fira Code', monospace",
    "font-size-base": "15px",
    "line-height": "1.6"
  },
  "spacing": {
    "page-padding": "24px",
    "card-padding": "16px",
    "border-radius": "8px"
  },
  "components": {
    "blocking-alert": {
      "animation": "pulse",
      "icon": "alert-circle"
    },
    "code-block": {
      "theme": "github",
      "line-numbers": true
    }
  }
}
```

## CSS Variable Mapping

Tokens are mapped to CSS custom properties with the `--vds-` prefix:

| Token Path | CSS Variable |
|-----------|-------------|
| `colors.primary` | `--vds-colors-primary` |
| `colors.background` | `--vds-colors-background` |
| `typography.font-family` | `--vds-typography-font-family` |
| `spacing.border-radius` | `--vds-spacing-border-radius` |
| `components.code-block.theme` | `--vds-components-code-block-theme` |

### Flattening Algorithm

```javascript
function flattenTokens(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value, path));
    } else {
      result[path] = String(value);
    }
  }
  return result;
}

// Apply to DOM
function applyTokens(tokens) {
  const flat = flattenTokens(tokens);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(flat)) {
    root.style.setProperty(`--vds-${key}`, value);
  }
}
```

### Component CSS Usage

All components reference CSS variables, never hardcoded values:

```css
/* Good */
.button-primary {
  background: var(--vds-colors-primary);
  color: white;
  border-radius: var(--vds-spacing-border-radius);
  font-family: var(--vds-typography-font-family);
}

/* Bad — never hardcode */
.button-primary {
  background: #2563EB;
  border-radius: 8px;
}
```

## Token Hot-Reload Flow

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────────┐
│ User edits       │     │ Server       │     │ Browser          │
│ tokens.json      │     │              │     │                  │
│                  │     │              │     │                  │
│ Save file ───────┼────▶│ fs.watch()   │     │                  │
│                  │     │ detects      │     │                  │
│                  │     │ change       │     │                  │
│                  │     │              │     │                  │
│                  │     │ Validate     │     │                  │
│                  │     │ JSON ────────┼────▶│ ws: design_      │
│                  │     │              │     │   updated        │
│                  │     │              │     │                  │
│                  │     │              │     │ applyTokens()    │
│                  │     │              │     │ Update :root     │
│                  │     │              │     │ CSS variables    │
│                  │     │              │     │                  │
│                  │     │              │     │ UI re-renders    │
│                  │     │              │     │ instantly        │
└──────────────────┘     └──────────────┘     └──────────────────┘
```

### Server-Side Watcher

```javascript
const fs = require('fs');
const path = require('path');

function watchDesignTokens(dataDir, broadcast) {
  const tokensPath = path.join(dataDir, 'design', 'tokens.json');

  let debounceTimer = null;
  fs.watch(tokensPath, () => {
    // Debounce: file saves often trigger multiple events
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        broadcast('design_updated', tokens);
        console.log('Design tokens updated, broadcast to clients');
      } catch (err) {
        console.error('Invalid tokens.json:', err.message);
        // Don't broadcast invalid tokens — keep current state
      }
    }, 200);  // 200ms debounce
  });
}
```

### Frontend Token Loader

```javascript
// hooks/useDesignTokens.js
function useDesignTokens() {
  const [tokens, setTokens] = useState(null);

  // Load tokens on mount
  useEffect(() => {
    fetch('/api/design-tokens')
      .then(r => r.json())
      .then(data => {
        setTokens(data);
        applyTokens(data);
      });
  }, []);

  // Listen for hot-reload via WebSocket
  useEffect(() => {
    const handler = (newTokens) => {
      setTokens(newTokens);
      applyTokens(newTokens);
    };
    eventBus.on('design_updated', handler);
    return () => eventBus.off('design_updated', handler);
  }, []);

  return tokens;
}
```

## Server API

### GET /api/design-tokens

Returns the current design tokens from `{DATA_DIR}/design/tokens.json`.

```json
{
  "colors": { ... },
  "typography": { ... },
  "spacing": { ... },
  "components": { ... }
}
```

If `tokens.json` does not exist or is invalid, returns the default tokens
from the template.

## Customization Workflows

### Workflow 1: User Edits tokens.json Directly

Fast path for simple changes (e.g., changing primary color):

1. User opens `{CWD}/.visual-delivery/design/tokens.json`
2. Changes `"primary": "#2563EB"` to `"primary": "#7C3AED"`
3. Saves file
4. Server detects change → broadcasts to frontend
5. UI updates instantly

### Workflow 2: User Edits design-spec.md, Agent Updates Tokens

Semantic path for design-level changes:

1. User edits `{CWD}/.visual-delivery/design/design-spec.md`
2. Changes "Primary color: Blue (#2563EB)" to "Primary color: Purple (#7C3AED)"
3. Tells agent: "I updated the design spec, please apply the changes"
4. Agent reads `design-spec.md`, extracts design intent
5. Agent updates `tokens.json` accordingly
6. Server detects change → broadcasts to frontend
7. UI updates instantly

### Workflow 3: Agent Customizes Design During Delivery

Agent can modify the design system programmatically:

1. Agent reads current `tokens.json`
2. Agent writes updated `tokens.json` with new values
3. Server detects change → broadcasts to frontend
4. UI updates instantly

This is useful when the agent wants to match the delivery styling to the
project's existing design language.

## Initialization

On first `start.sh` run:

1. Copy `templates/design/design-spec.md` → `{DATA_DIR}/design/design-spec.md`
2. Copy `templates/design/tokens.json` → `{DATA_DIR}/design/tokens.json`
3. Log: `"Design specification generated at .visual-delivery/design/design-spec.md"`
4. Log: `"Edit design-spec.md or tokens.json to customize the UI."`

On subsequent runs, existing design files are preserved (never overwritten).

## Validation

The server validates `tokens.json` on load and on change:

- Must be valid JSON
- Must have `colors` object
- Must have `typography` object
- Must have `spacing` object
- `components` is optional

On validation failure:
- Log warning to server log
- Keep using the last valid tokens
- Do not broadcast invalid tokens to frontend
