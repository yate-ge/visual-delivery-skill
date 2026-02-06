# Frontend Design

## Technology Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | React 18 | Component-based, rich ecosystem, good for interactive UIs |
| Build tool | Vite | Fast build, small output, dev-friendly |
| Styling | CSS Modules + CSS Variables | Design tokens via variables, scoped styles, no runtime CSS-in-JS |
| Markdown | react-markdown + remark-gfm | GFM support, code blocks, tables |
| Code highlighting | highlight.js | Lightweight, many language grammars |
| WebSocket | native WebSocket API | No library needed |

## Runtime Build

The frontend is **built at runtime** in the work directory, not pre-built in
the skill directory. This ensures:

- Skill directory remains read-only
- Node modules are installed in the work directory
- Users can customize frontend code if needed (advanced)

### Build Flow

On first `start.js` run:
1. Copy `templates/ui/` → `{DATA_DIR}/ui/`
2. Run `npm install` in `{DATA_DIR}/ui/`
3. Run `npm run build` in `{DATA_DIR}/ui/` → produces `{DATA_DIR}/ui/dist/`
4. Server serves static files from `{DATA_DIR}/ui/dist/`

On subsequent runs:
- If `{DATA_DIR}/ui/dist/` exists, skip build (fast start)
- If `ui/src/` is newer than `ui/dist/`, rebuild

### Rebuild After Customization

If the user modifies frontend source files in `{DATA_DIR}/ui/src/`:
```bash
cd {DATA_DIR}/ui && npm run build
```
Server will automatically serve the new build.

## Page Structure

### Route Map

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Dashboard` | Task list with blocking alerts |
| `/d/:id` | `DeliveryPage` | Single delivery view |
| `/settings` | `Settings` | Design token preview |

### Dashboard Layout

```
┌──────────────────────────────────────────────────────┐
│  Visual Delivery                          [Settings]  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─ Blocking Alert Bar ───────────────────────────┐  │
│  │ (only visible when blocking deliveries exist)   │  │
│  │                                                 │  │
│  │  "Agent is waiting for your response"           │  │
│  │  [Choose Deploy Target]  ← click to jump        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Delivery List ────────────────────────────────┐  │
│  │                                                 │  │
│  │  Filter: [All] [Passive] [Interactive] [Blocking] │
│  │                                                 │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │ ● Choose Deploy Target        blocking   │  │  │
│  │  │   awaiting feedback            2 min ago  │  │  │
│  │  ├──────────────────────────────────────────┤  │  │
│  │  │ ○ Review API Design          interactive  │  │  │
│  │  │   awaiting feedback           10 min ago  │  │  │
│  │  ├──────────────────────────────────────────┤  │  │
│  │  │ ○ Code Refactoring Report      passive    │  │  │
│  │  │   delivered                      1 hr ago  │  │  │
│  │  ├──────────────────────────────────────────┤  │  │
│  │  │ ✓ Database Migration Plan      completed  │  │  │
│  │  │   completed                      1 day ago │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Delivery Page Layout

```
┌──────────────────────────────────────────────────────┐
│  ← Back to list          "API Refactoring Report"     │
│                          passive · delivered · 1hr ago │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─ Content Area ─────────────────────────────────┐  │
│  │                                                 │  │
│  │  (Rendered markdown/html content)               │  │
│  │                                                 │  │
│  │  Users can select text to annotate              │  │
│  │  [Annotation popover appears on text selection]  │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Feedback Section (interactive/blocking only) ─┐  │
│  │                                                 │  │
│  │  (Rendered from feedback_schema)                │  │
│  │  [Form fields / Select options / Confirm buttons]│  │
│  │                                                 │  │
│  │  [Submit Feedback]                              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Annotations Sidebar ──────────────────────────┐  │
│  │                                                 │  │
│  │  User's comment on line 45-78           2m ago  │  │
│  │  "This should use PATCH, not PUT"               │  │
│  │                                                 │  │
│  │  General comment                        5m ago  │  │
│  │  "Good approach overall"                        │  │
│  │                                                 │  │
│  │  [Add Comment]                                  │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Component Library

### Core Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `Dashboard` | `pages/Dashboard.jsx` | — | Home page with alert bar + delivery list |
| `DeliveryPage` | `pages/DeliveryPage.jsx` | `id` | Single delivery view |
| `DeliveryCard` | `components/DeliveryCard.jsx` | `delivery` | List item in dashboard |
| `BlockingAlert` | `components/BlockingAlert.jsx` | `deliveries[]` | Top alert bar for blocking items |
| `ContentRenderer` | `components/ContentRenderer.jsx` | `content` | Renders markdown or HTML |
| `CodeBlock` | `components/CodeBlock.jsx` | `code, language` | Syntax-highlighted code |
| `AnnotationLayer` | `components/AnnotationLayer.jsx` | `annotations, onAdd` | Text selection + annotation overlay |
| `AnnotationSidebar` | `components/AnnotationSidebar.jsx` | `annotations` | List of annotations |

### Feedback Components (rendered from schema)

| Component | Schema type | Props |
|-----------|------------|-------|
| `FeedbackConfirm` | `confirm` | `prompt, confirmLabel, cancelLabel, onSubmit` |
| `FeedbackSelect` | `select` | `prompt, options, multiple, onSubmit` |
| `FeedbackForm` | `form` | `fields[], onSubmit` |
| `FeedbackRating` | `rating` | `prompt, max, onSubmit` |
| `FeedbackRenderer` | (router) | `schema, onSubmit` → delegates to specific component |

### Shared Components

| Component | Description |
|-----------|-------------|
| `Badge` | Status/mode badge (color-coded via design tokens) |
| `TimeAgo` | Relative time display |
| `Button` | Themed button |
| `Input` | Themed input field |
| `Textarea` | Themed textarea |

## Design System Integration

### Design Token Loading

The frontend loads design tokens on startup and applies them as CSS variables.
All components use CSS variables — never hardcoded values.

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

### CSS Variable Application

```javascript
// lib/theme.js
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

function applyTokens(tokens) {
  const flat = flattenTokens(tokens);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(flat)) {
    root.style.setProperty(`--vds-${key}`, value);
  }
}
```

### Component Styling

All components use CSS variables from the design token system:

```css
/* Example: DeliveryCard.module.css */
.card {
  background: var(--vds-colors-surface);
  border: 1px solid var(--vds-colors-border);
  border-radius: var(--vds-spacing-border-radius);
  padding: var(--vds-spacing-card-padding);
  font-family: var(--vds-typography-font-family);
}

.card:hover {
  border-color: var(--vds-colors-primary);
}

.badge-blocking {
  background: var(--vds-colors-blocking-bg);
  border-color: var(--vds-colors-blocking-border);
  color: var(--vds-colors-danger);
}
```

### CSS Variable Defaults

The `styles/variables.css` file provides fallback defaults in case tokens
haven't loaded yet:

```css
:root {
  /* Fallback defaults — overridden by design tokens on load */
  --vds-colors-primary: #2563EB;
  --vds-colors-background: #FFFFFF;
  --vds-colors-text: #1E293B;
  --vds-typography-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --vds-spacing-border-radius: 8px;
  /* ... etc */
}
```

## WebSocket Client

```javascript
// hooks/useWebSocket.js
function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  let attempts = 0;

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`ws://${location.host}/ws`);
      ws.onopen = () => {
        setConnected(true);
        attempts = 0;
      };
      ws.onclose = () => {
        setConnected(false);
        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        attempts++;
        setTimeout(connect, delay);
      };
      ws.onmessage = (e) => {
        const { event, data } = JSON.parse(e.data);
        // dispatch to appropriate handler
        eventBus.emit(event, data);
      };
      wsRef.current = ws;
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  return { connected };
}
```

## Annotation Interaction

### Text Selection Flow

1. User selects text in the content area
2. A floating "Add Annotation" button appears near the selection
3. User clicks → annotation input popover appears
4. User types comment → clicks Submit
5. Frontend sends `POST /api/deliveries/:id/annotate` with text range
6. Annotation appears in the sidebar
7. Highlighted text range gets a colored underline

### Implementation Notes

- Use `window.getSelection()` to capture text range
- Store start/end as character offsets relative to the rendered content
- Render highlights using `<mark>` elements with click handlers
- Sidebar annotations are linked to their highlights via shared annotation ID

## Responsive Design

The UI should work on:
- Desktop (primary): full layout with sidebar
- Tablet: stacked layout (content above, annotations below)
- Mobile: basic usability for quick feedback (blocking mode especially)

Breakpoints:
- `>= 1024px`: sidebar layout
- `768px - 1023px`: stacked layout
- `< 768px`: mobile-optimized

## Directory: templates/ui/

```
templates/ui/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx                    ← entry point
│   ├── App.jsx                     ← router setup, design token loader
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── DeliveryPage.jsx
│   │   └── Settings.jsx
│   ├── components/
│   │   ├── BlockingAlert.jsx
│   │   ├── DeliveryCard.jsx
│   │   ├── ContentRenderer.jsx
│   │   ├── CodeBlock.jsx
│   │   ├── AnnotationLayer.jsx
│   │   ├── AnnotationSidebar.jsx
│   │   ├── feedback/
│   │   │   ├── FeedbackRenderer.jsx
│   │   │   ├── FeedbackConfirm.jsx
│   │   │   ├── FeedbackSelect.jsx
│   │   │   ├── FeedbackForm.jsx
│   │   │   └── FeedbackRating.jsx
│   │   └── shared/
│   │       ├── Badge.jsx
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Textarea.jsx
│   │       └── TimeAgo.jsx
│   ├── hooks/
│   │   ├── useWebSocket.js
│   │   ├── useDesignTokens.js      ← design token loader + hot-reload
│   │   └── useDeliveries.js
│   ├── styles/
│   │   ├── global.css
│   │   └── variables.css           ← CSS variable fallback defaults
│   └── lib/
│       ├── api.js                  ← fetch wrappers
│       ├── theme.js                ← token flattening + CSS variable injection
│       └── eventBus.js             ← simple event emitter for WebSocket events
```

At runtime, this is copied to `{DATA_DIR}/ui/`, dependencies are installed,
and the project is built to `{DATA_DIR}/ui/dist/`. The server serves the
built files as static assets.
