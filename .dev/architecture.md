# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Runtime                             │
│                                                                  │
│  SKILL.md (instructions)                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ "Run start.js → initializes work dir + starts server"      │  │
│  │ "POST /api/deliveries with content and mode"               │  │
│  │ "For blocking: run await-feedback.js"                      │  │
│  │ "Read .visual-delivery/data/deliveries/{id}/*.json"        │  │
│  │ "Inform user at every step with status messages"           │  │
│  └────────┬───────────────────────────────────────────────────┘  │
│           │ guides                                                │
│           ▼                                                      │
│  Agent (Claude / Codex / any LLM agent)                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Tools: Bash, Read, Write, curl                             │  │
│  │                                                            │  │
│  │  Bash: node scripts/start.js ────────┐                     │  │
│  │  Bash: curl POST /api/deliveries     │                     │  │
│  │  Bash: node scripts/await-feedback.js│                     │  │
│  │  Read: .visual-delivery/data/index.json                    │  │
│  │  Read: .visual-delivery/data/deliveries/{id}/*.json        │  │
│  │  Read: .visual-delivery/design/*     │ (design spec)       │  │
│  └──────────────────────────────────────┼─────────────────────┘  │
└─────────────────────────────────────────┼────────────────────────┘
                                          │
                             HTTP / WebSocket
                                          │
┌─────────────────────────────────────────┼────────────────────────┐
│                    Web Server (Node.js)                            │
│                      runs from {DATA_DIR}/server/                  │
│                                          │                         │
│  Express ◄───────────────────────────────┘                         │
│  ├── GET  /health                                                  │
│  ├── GET  /                          → SPA (runtime-built React)   │
│  ├── POST /api/deliveries            → create delivery             │
│  ├── GET  /api/deliveries            → list deliveries (index.json)│
│  ├── GET  /api/deliveries/:id        → get single delivery        │
│  ├── POST /api/deliveries/:id/annotate → add annotation           │
│  ├── POST /api/deliveries/:id/feedback → submit feedback          │
│  ├── GET  /api/sessions/:id          → poll session status        │
│  └── GET  /api/design-tokens         → serve design tokens        │
│                                                                    │
│  WebSocket Server                                                  │
│  ├── → browser: new_delivery, update_delivery                      │
│  ├── → browser: feedback_received (blocking mode)                  │
│  ├── → browser: design_updated (design tokens changed)             │
│  └── ← browser: (none, browser uses REST for submissions)          │
│                                                                    │
│  File Store (per-delivery locking) ────────────────────────        │
│  └── reads/writes {DATA_DIR}/data/deliveries/{id}/*.json           │
│  └── reads/writes {DATA_DIR}/data/index.json                       │
│                                                                    │
│  Design Token Watcher ─────────────────────────────────────        │
│  └── watches {DATA_DIR}/design/tokens.json for changes             │
└────────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
           localhost:3847        cloudflared tunnel
                │                (optional)
                │                       │
                ▼                       ▼
┌────────────────────────────────────────────────────┐
│                   Browser (User)                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ React SPA (runtime-built, served from          │  │
│  │            {DATA_DIR}/ui/dist/)                 │  │
│  │ ┌─────────────────────────────────────────┐   │  │
│  │ │ Home: Task Dashboard                    │   │  │
│  │ │  Blocking alerts (top priority)         │   │  │
│  │ │  Delivery list (all modes)              │   │  │
│  │ ├─────────────────────────────────────────┤   │  │
│  │ │ Delivery Page: /d/:id                   │   │  │
│  │ │  Content renderer (markdown/html)       │   │  │
│  │ │  Annotation layer                       │   │  │
│  │ │  Feedback form (interactive/blocking)    │   │  │
│  │ └─────────────────────────────────────────┘   │  │
│  │                                                │  │
│  │ Design System: tokens.json → CSS variables     │  │
│  │ Hot-reload on token changes via WebSocket      │  │
│  └───────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## Template / Instance Architecture

The skill follows a **template → instance** pattern. The skill directory is read-only
and contains source templates. All runtime files are generated in the work directory.

### Skill Directory (read-only, templates & guidelines)

```
visual-delivery-skill/                  ← SKILL_DIR
├── SKILL.md                            ← Agent instructions
├── templates/                          ← Source templates
│   ├── server/                         ← Node.js server source code
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── lib/
│   │   │   ├── store.js
│   │   │   ├── ids.js
│   │   │   └── ws.js
│   │   └── routes/
│   │       └── api.js
│   ├── ui/                             ← React frontend source code
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── App.jsx
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── styles/
│   │       └── lib/
│   └── design/                         ← Design system defaults
│       ├── design-spec.md              ← Design specification template
│       └── tokens.json                 ← Default design tokens
├── scripts/                            ← Node.js scripts (cross-platform)
│   ├── start.js                        ← Initialize + start server
│   ├── stop.js                         ← Stop server + tunnel
│   └── await-feedback.js              ← Blocking delivery poll
├── references/
│   ├── api.md
│   ├── feedback-schema.md
│   └── ui-components.md
└── agents/
    └── openai.yaml
```

### Work Directory (runtime, writable)

```
{CWD}/.visual-delivery/                ← DATA_DIR
├── server/                             ← Server instance (copied from template)
│   ├── package.json
│   ├── node_modules/                   ← Installed dependencies
│   ├── index.js
│   ├── lib/
│   └── routes/
├── ui/                                 ← Frontend instance (copied from template)
│   ├── package.json
│   ├── node_modules/                   ← Installed dependencies
│   ├── dist/                           ← Vite build output (server serves this)
│   └── src/
├── design/                             ← Design system instance (user-editable)
│   ├── design-spec.md                  ← Design specification (human-readable)
│   └── tokens.json                     ← Design tokens (machine-readable, drives CSS)
├── data/                               ← Runtime data (per-delivery instance)
│   ├── index.json                      ← Lightweight delivery index
│   └── deliveries/                     ← One directory per delivery
│       ├── d_xxx/
│       │   ├── delivery.json           ← Full delivery record
│       │   ├── annotations.json        ← Annotations for this delivery
│       │   ├── feedback.json           ← Feedback for this delivery
│       │   └── session.json            ← Only for blocking deliveries
│       └── ...
├── logs/
│   └── server.log
├── server.pid
└── tunnel.pid                          ← (optional, when tunnel is active)
```

### Template Copy Rules

| Source (skill dir) | Destination (work dir) | When copied |
|-------------------|----------------------|-------------|
| `templates/server/` | `{DATA_DIR}/server/` | First `start.js` run (if not exists) |
| `templates/ui/` | `{DATA_DIR}/ui/` | First `start.js` run (if not exists) |
| `templates/design/` | `{DATA_DIR}/design/` | First `start.js` run (if not exists) |

Templates are only copied on first initialization. Subsequent runs reuse the
existing work directory. This allows users to customize files (especially
`design/tokens.json` and `design/design-spec.md`) without them being overwritten.

## Component Responsibilities

### SKILL.md (Instructions Layer)
- Defines when and how the agent uses the delivery system
- Provides imperative steps with explicit inputs/outputs
- **Instructs agent to inform user at every step** (UX requirement)
- References scripts only for deterministic operations
- References `references/` docs for schema and component specs

### Scripts (Deterministic Layer)
Only 3 Node.js scripts, each handling logic too complex or critical for ad-hoc agent commands:

| Script | Why it's a script |
|--------|-------------------|
| `start.js` | Template copying, dependency install, frontend build, environment detection, process management, tunnel setup — multi-step deterministic logic with UX output |
| `stop.js` | Process cleanup (server + tunnel) — must be reliable |
| `await-feedback.js` | Polling loop with timeout — must run as single blocking process |

All scripts are Node.js for cross-platform compatibility (Windows, macOS, Linux).

### Server (External Tooling Layer)
- Node.js Express application, runs from `{DATA_DIR}/server/`
- Serves the runtime-built frontend from `{DATA_DIR}/ui/dist/`
- Provides REST API for CRUD operations on deliveries/annotations/feedback
- Provides WebSocket for real-time push to browser (including design token changes)
- Reads/writes per-delivery JSON files **with file locking**
- Maintains `data/index.json` for lightweight delivery listing
- Watches `{DATA_DIR}/design/tokens.json` for changes and notifies frontend

### Frontend (Presentation Layer)
- React SPA built at runtime in `{DATA_DIR}/ui/`
- Served by Express from `{DATA_DIR}/ui/dist/`
- Connects to WebSocket for real-time updates
- Renders deliveries based on mode (passive/interactive/blocking)
- **Design system**: loads design tokens → applies as CSS variables
- Hot-reloads when design tokens change (via WebSocket `design_updated` event)
- Sends feedback and annotations back to server via REST API

### Design System (Customization Layer)
- `design-spec.md` — human-readable design specification, user and agent can edit
- `tokens.json` — machine-readable design tokens, drives all CSS variables
- Server watches tokens.json for changes → broadcasts to frontend via WebSocket
- Frontend applies token changes without page reload
- See [design-system.md](./design-system.md) for full specification

### JSON Store (Data Layer)
- Per-delivery instance directories in `{DATA_DIR}/data/deliveries/{id}/`
- Lightweight index at `{DATA_DIR}/data/index.json` for listing
- Server reads/writes **with per-delivery file locking** to prevent concurrent conflicts
- Agent reads per-delivery files directly (via Read tool)
- No database, no migrations, no schema versioning

## Initialization Flow

`start.js` handles full initialization on first run:

```
┌─────────────────────────────────────────────────────────┐
│  node scripts/start.js                                   │
│                                                          │
│  1. Parse arguments                                      │
│  2. Check if already running → output already_running    │
│                                                          │
│  3. Initialize work directory:                           │
│     ┌────────────────────────────────────────────────┐  │
│     │ [visual-delivery] Initializing...              │  │
│     │                                                │  │
│     │ Copy templates/server/ → .visual-delivery/     │  │
│     │ Copy templates/ui/     → .visual-delivery/     │  │
│     │ Copy templates/design/ → .visual-delivery/     │  │
│     │ Create data/deliveries/ directory              │  │
│     │ Create data/index.json as []                   │  │
│     └────────────────────────────────────────────────┘  │
│                                                          │
│  4. Install dependencies:                                │
│     ┌────────────────────────────────────────────────┐  │
│     │ [visual-delivery] Installing server deps...    │  │
│     │ npm install in {DATA_DIR}/server/              │  │
│     │                                                │  │
│     │ [visual-delivery] Installing frontend deps...  │  │
│     │ npm install in {DATA_DIR}/ui/                  │  │
│     └────────────────────────────────────────────────┘  │
│                                                          │
│  5. Build frontend:                                      │
│     ┌────────────────────────────────────────────────┐  │
│     │ [visual-delivery] Building frontend...         │  │
│     │ npm run build in {DATA_DIR}/ui/                │  │
│     └────────────────────────────────────────────────┘  │
│                                                          │
│  6. Start server:                                        │
│     ┌────────────────────────────────────────────────┐  │
│     │ [visual-delivery] Starting server...           │  │
│     │ node {DATA_DIR}/server/index.js                │  │
│     │ Wait for health check                          │  │
│     └────────────────────────────────────────────────┘  │
│                                                          │
│  7. Handle remote access (cloudflared):                  │
│     ┌────────────────────────────────────────────────┐  │
│     │ If cloudflared needed but not installed:        │  │
│     │   Prompt user to install                       │  │
│     │   Continue without tunnel (not an error)       │  │
│     └────────────────────────────────────────────────┘  │
│                                                          │
│  8. Output result:                                       │
│     ┌────────────────────────────────────────────────┐  │
│     │ [visual-delivery] Ready!                       │  │
│     │ [visual-delivery] Local:  http://localhost:3847│  │
│     │ [visual-delivery] Design: .visual-delivery/    │  │
│     │                   design/design-spec.md        │  │
│     │   Edit design-spec.md to customize the UI.     │  │
│     └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow by Delivery Mode

### Passive Delivery
```
Agent                    Server                   Browser
  │                        │                        │
  │── POST /api/deliveries─▶                        │
  │   {mode:"passive",...}  │                        │
  │◄── {id, url} ──────────│                        │
  │                         │── ws: new_delivery ───▶│
  │  Tell user: "View at    │                        │── user views
  │   http://localhost:3847 │                        │
  │   /d/{id}"              │                        │
```

### Interactive Delivery
```
Agent                    Server                   Browser
  │                        │                        │
  │── POST /api/deliveries─▶                        │
  │   {mode:"interactive",  │                        │
  │    feedback_schema:{}}   │                        │
  │◄── {id, url} ──────────│                        │
  │                         │── ws: new_delivery ───▶│
  │  Tell user: "Review at  │                        │── user views
  │   {url}, feedback       │                        │── user interacts
  │   welcome anytime"      │◄─ POST /feedback ──────│
  │                         │   writes per-delivery  │
  │                         │   JSON (locked)        │
  │  ... later ...          │                        │
  │── Read data/deliveries/ ───────────────────────▶│
  │   {id}/feedback.json   │                        │
  │  (agent reads feedback) │                        │
```

### Blocking Delivery
```
Agent                    Server                   Browser
  │                        │                        │
  │── await-feedback.js ──▶│                        │
  │  Tell user: "Waiting    │                        │
  │   for your input at     │── ws: new_delivery ───▶│
  │   {url}"                │   (blocking alert)     │── user sees alert
  │   ┌─ poll loop ─┐      │                        │
  │   │ GET /session │      │                        │
  │   │ status?      │      │                        │── user responds
  │   │ "waiting"    │      │◄─ POST /feedback ──────│
  │   │ sleep 2      │      │   writes per-delivery  │
  │   │ GET /session │      │   JSON (locked)        │
  │   │ "responded"! │      │                        │
  │   └──────────────┘      │                        │
  │◄── feedback JSON ──────│                        │
  │                         │                        │
  │  On timeout (5min):     │                        │
  │  Tell user: "No response│                        │
  │   received. Please check│                        │
  │   {url} when ready."    │                        │
```

### Design Token Update Flow
```
User edits tokens.json
  │
  ▼
Server (file watcher) detects change
  │
  ├── Validates tokens.json format
  ├── Broadcasts ws: design_updated {tokens}
  │
  ▼
Browser receives design_updated
  │
  ├── Updates CSS variables on :root
  └── UI re-renders with new styles (no page reload)
```

## Network & Port Convention

| Service | Default Port | Configurable |
|---------|-------------|--------------|
| HTTP server | 3847 | via `--port` in start.js |
| WebSocket | same port (upgrade) | — |
| cloudflared tunnel | auto-assigned | — |

Port 3847 chosen to avoid conflicts with common dev ports (3000, 5173, 8080, etc).

## Security Considerations

- Server binds to `127.0.0.1` by default (local only)
- Remote access only via explicit user consent + cloudflared tunnel
- No authentication on local server (trusted local environment)
- cloudflared tunnel provides HTTPS encryption for remote access
- No sensitive data stored (task results only)
- Per-delivery file locking prevents data corruption from concurrent access

## Agent UX Requirements

The agent MUST inform the user at key moments:

| Event | Message Pattern |
|-------|----------------|
| First initialization | "Setting up Visual Delivery service for the first time..." |
| Server starting | "Starting Visual Delivery server..." |
| Server ready | "Visual Delivery ready at {url}" |
| Design spec generated | "Design specification created at {path}. Edit to customize the UI." |
| Passive delivery created | "View the delivery at {url}" |
| Interactive delivery created | "Review and provide feedback at {url}" |
| Blocking delivery created | "Waiting for your input at {url}" |
| Blocking timeout | "No response received within 5 minutes. Please visit {url} when ready." |
| cloudflared not found | "Remote access requires cloudflared. Install with: brew install cloudflared" |
| Server already running | "Visual Delivery is already running at {url}" |
