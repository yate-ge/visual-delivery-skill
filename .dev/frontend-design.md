# Frontend Design

## Technology Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | React 18 | Component-based, rich ecosystem, good for interactive UIs |
| Build tool | Vite | Fast build, small output, dev-friendly |
| Styling | CSS Modules + CSS Variables | Theme via variables, scoped styles, no runtime CSS-in-JS |
| Markdown | react-markdown + remark-gfm | GFM support, code blocks, tables |
| Code highlighting | highlight.js | Lightweight, many language grammars |
| WebSocket | native WebSocket API | No library needed |

## Build Output

Frontend is pre-built and committed to `server/public/`. Users do not need to
run a build step. Developers rebuild with:

```bash
cd ui && npm run build && cp -r dist/* ../server/public/
```

## Page Structure

### Route Map

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Dashboard` | Task list with blocking alerts |
| `/d/:id` | `DeliveryPage` | Single delivery view |
| `/settings` | `Settings` | Theme preview, data export |

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
| `Badge` | Status/mode badge (color-coded) |
| `TimeAgo` | Relative time display |
| `Button` | Themed button |
| `Input` | Themed input field |
| `Textarea` | Themed textarea |

## Theme System

### CSS Variables (default.json → CSS)

The theme is defined as a JSON file and injected as CSS custom properties on `:root`.

```jsonc
// assets/theme/default.json
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

### User Customization

Users override by creating `{CWD}/.visual-delivery/custom/theme.json`:

```jsonc
// Only include what you want to override
{
  "colors": {
    "primary": "#7C3AED",
    "background": "#0F172A",
    "text": "#E2E8F0"
  },
  "typography": {
    "font-size-base": "14px"
  }
}
```

The server deep-merges custom into default and serves via `GET /api/theme`.

The frontend fetches theme on load and applies as CSS variables:

```javascript
async function applyTheme() {
  const theme = await fetch('/api/theme').then(r => r.json());
  const root = document.documentElement;
  for (const [key, value] of Object.entries(flattenTheme(theme))) {
    root.style.setProperty(`--vds-${key}`, value);
  }
}
```

Components reference variables:

```css
.button-primary {
  background: var(--vds-colors-primary);
  color: white;
  border-radius: var(--vds-spacing-border-radius);
}
```

## WebSocket Client

```javascript
// hooks/useWebSocket.js
function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`ws://${location.host}/ws`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 1000 * Math.min(attempts++, 10)); // backoff
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

## Directory: ui/

```
ui/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx                    ← entry point
│   ├── App.jsx                     ← router setup
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
│   │   ├── useTheme.js
│   │   └── useDeliveries.js
│   ├── styles/
│   │   ├── global.css
│   │   └── variables.css          ← CSS variable defaults (from theme)
│   └── lib/
│       ├── api.js                 ← fetch wrappers
│       └── theme.js               ← theme loading + CSS variable injection
└── custom/                        ← gitignored, symlinked to data dir at dev time
    └── theme.json
```
