# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent Runtime                         │
│                                                              │
│  SKILL.md (instructions)                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ "Check server health → if not running, start it"       │  │
│  │ "POST /api/deliveries with content and mode"           │  │
│  │ "For blocking: run await-feedback.sh"                  │  │
│  │ "Read .visual-delivery/data/*.json for history"        │  │
│  └────────┬───────────────────────────────────────────────┘  │
│           │ guides                                            │
│           ▼                                                   │
│  Agent (Claude / Codex / any LLM agent)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Tools: Bash, Read, Write, curl                         │  │
│  │                                                        │  │
│  │  Bash: scripts/start.sh ──────────┐                    │  │
│  │  Bash: curl POST /api/deliveries  │                    │  │
│  │  Bash: scripts/await-feedback.sh  │                    │  │
│  │  Read: .visual-delivery/data/*.json                    │  │
│  └───────────────────────────────────┼────────────────────┘  │
└──────────────────────────────────────┼────────────────────────┘
                                       │
                          HTTP / WebSocket
                                       │
┌──────────────────────────────────────┼────────────────────────┐
│                    Web Server (Node.js)                        │
│                                       │                        │
│  Express ◄────────────────────────────┘                        │
│  ├── GET  /health                                              │
│  ├── GET  /                          → SPA (React frontend)    │
│  ├── POST /api/deliveries            → create delivery         │
│  ├── GET  /api/deliveries            → list deliveries         │
│  ├── GET  /api/deliveries/:id        → get single delivery     │
│  ├── POST /api/deliveries/:id/annotate → add annotation        │
│  ├── POST /api/deliveries/:id/feedback → submit feedback       │
│  └── GET  /api/sessions/:id          → poll session status     │
│                                                                │
│  WebSocket Server                                              │
│  ├── → browser: new_delivery, update_delivery                  │
│  ├── → browser: feedback_request (blocking mode)               │
│  └── ← browser: (none, browser uses REST for submissions)      │
│                                                                │
│  JSON File Store ──────────────────────────────────────────    │
│  └── reads/writes {CWD}/.visual-delivery/data/*.json           │
└────────────────────────────────────────────────────────────────┘
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
│  │ React SPA                                     │  │
│  │ ┌─────────────────────────────────────────┐   │  │
│  │ │ Home: Task Dashboard                    │   │  │
│  │ │  🔴 Blocking alerts (top priority)      │   │  │
│  │ │  📋 Delivery list (all modes)           │   │  │
│  │ ├─────────────────────────────────────────┤   │  │
│  │ │ Delivery Page: /d/:id                   │   │  │
│  │ │  Content renderer (markdown/html)       │   │  │
│  │ │  Annotation layer                       │   │  │
│  │ │  Feedback form (interactive/blocking)    │   │  │
│  │ └─────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## Component Responsibilities

### SKILL.md (Instructions Layer)
- Defines when and how the agent uses the delivery system
- Provides imperative steps with explicit inputs/outputs
- References scripts only for deterministic operations
- References `references/` docs for schema and component specs

### Scripts (Deterministic Layer)
Only 3 scripts, each handling logic too complex or critical for ad-hoc agent commands:

| Script | Why it's a script |
|--------|-------------------|
| `start.sh` | Environment detection, dependency check, process management, tunnel setup — multi-step deterministic logic |
| `stop.sh` | Process cleanup (server + tunnel) — must be reliable |
| `await-feedback.sh` | Polling loop with timeout — must run as single blocking bash call |

### Server (External Tooling Layer)
- Node.js Express application, started by `start.sh`
- Serves the frontend SPA from pre-built static files
- Provides REST API for CRUD operations on deliveries/annotations/feedback
- Provides WebSocket for real-time push to browser
- Reads/writes JSON files in the data directory

### Frontend (Presentation Layer)
- React SPA served by the Express server
- Connects to WebSocket for real-time updates
- Renders deliveries based on mode (passive/interactive/blocking)
- Sends feedback and annotations back to server via REST API
- Supports theme customization via `custom/theme.json`

### JSON Store (Data Layer)
- Plain JSON files in `{CWD}/.visual-delivery/data/`
- Server reads/writes; agent reads directly (via Read tool)
- No database, no migrations, no schema versioning

## Data Flow by Delivery Mode

### Passive Delivery
```
Agent                    Server                   Browser
  │                        │                        │
  │── POST /api/deliveries─▶                        │
  │   {mode:"passive",...}  │                        │
  │◄── {id, url} ──────────│                        │
  │                         │── ws: new_delivery ───▶│
  │  (agent continues)      │                        │── user views
  │                         │                        │
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
  │  (agent continues)      │                        │── user views
  │                         │                        │── user interacts
  │                         │◄─ POST /feedback ──────│
  │                         │   writes JSON          │
  │  ... later ...          │                        │
  │── Read data/*.json ─────────────────────────────▶│
  │  (agent reads feedback) │                        │
```

### Blocking Delivery
```
Agent                    Server                   Browser
  │                        │                        │
  │── await-feedback.sh ──▶│                        │
  │   (creates delivery +   │                        │
  │    starts polling)      │── ws: new_delivery ───▶│
  │                         │   (blocking alert)     │── user sees alert
  │   ┌─ poll loop ─┐      │                        │
  │   │ GET /session │      │                        │
  │   │ status?      │      │                        │
  │   │ "waiting"    │      │                        │── user responds
  │   │ sleep 2      │      │◄─ POST /feedback ──────│
  │   │ GET /session │      │   writes JSON          │
  │   │ "responded"! │      │   updates session      │
  │   └──────────────┘      │                        │
  │◄── feedback JSON ──────│                        │
  │  (agent continues)      │                        │
```

## Network & Port Convention

| Service | Default Port | Configurable |
|---------|-------------|--------------|
| HTTP server | 3847 | via `--port` in start.sh |
| WebSocket | same port (upgrade) | — |
| cloudflared tunnel | auto-assigned | — |

Port 3847 chosen to avoid conflicts with common dev ports (3000, 5173, 8080, etc).

## Security Considerations

- Server binds to `127.0.0.1` by default (local only)
- Remote access only via explicit user consent + cloudflared tunnel
- No authentication on local server (trusted local environment)
- cloudflared tunnel provides HTTPS encryption for remote access
- No sensitive data stored (task results only)
