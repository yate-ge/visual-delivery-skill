[English](./README.md) | [中文](./README.zh-CN.md)

# Visual Delivery Skill

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that delivers task results through rich, interactive web pages instead of plain text — and collects structured feedback directly from the UI.

## What It Does

When installed, the agent generates **complete HTML pages** (dashboards, charts, interactive tables, code reviews, comparison views...) and serves them through a local web interface. Users review the results visually and provide feedback via annotations, action buttons, or free-text comments — all without leaving the browser.

### Key Features

- **Generative UI** — The agent produces full HTML+CSS+JS pages tailored to each task. No predefined templates; every delivery is unique.
- **Structured Feedback** — Text annotation (select any text to comment), per-item action buttons, and free-text input. Feedback flows back to the agent for processing.
- **Design Token System** — Customizable colors, typography, and spacing via CSS variables (`--vds-*`). Edit tokens through the Settings page or ask the agent to restyle.
- **Multi-Language** — Built-in English locale. For any other language, the agent auto-generates the UI locale at startup.
- **Real-Time Updates** — WebSocket push from server to browser. Deliveries and feedback appear instantly.
- **Local-First** — Runs on `localhost:3847`. Optional public tunnel via [cloudflared](https://github.com/cloudflare/cloudflared) for remote access.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 18+
- (Optional) [cloudflared](https://github.com/cloudflare/cloudflared) for remote access

## Installation

Copy the skill directory into your project's Claude Code skills folder:

```
your-project/
└── .claude/
    └── skills/
        └── visual-delivery-skill/   ← this repo
            ├── SKILL.md
            ├── scripts/
            ├── templates/
            └── references/
```

That's it. Claude Code automatically discovers skills in `.claude/skills/`.

## Usage

Start a conversation with the agent and trigger the skill:

```
You: Start visual delivery
```

The agent will:

1. **Start the service** — launches a local Express + Vite server on port 3847
2. **Show the URL** — `http://localhost:3847`
3. **Ask about remote access** — local only, or start a cloudflared tunnel

Once running, any task result that benefits from visual presentation is automatically delivered as an interactive web page.

### Trigger Modes

Control when the agent uses visual delivery (configurable in Settings):

| Mode | Behavior |
|------|----------|
| **Smart** (default) | Agent decides — visual for complex results, plain text for simple answers |
| **Auto** | Always deliver visually |
| **Manual** | Only when you explicitly ask |

### Feedback Workflow

1. The agent delivers a visual page with per-item feedback buttons
2. You review and provide feedback:
   - **Annotate** — select any text to add a comment
   - **Action buttons** — context-specific choices (e.g., "Accept Fix", "Defer", "Won't Fix")
   - **Free text** — "Other..." input for each item, plus a global comment box
3. Submit feedback from the sidebar
4. The agent processes feedback, updates the delivery page, and resolves items

## Architecture

```
visual-delivery-skill/
├── SKILL.md                  # Agent instructions (skill entry point)
├── CLAUDE.md                 # Development guide
├── scripts/
│   ├── start.js              # Launch server + build frontend
│   └── stop.js               # Graceful shutdown
├── references/               # Supplementary docs for SKILL.md
│   ├── api.md                # REST API reference
│   ├── generative-ui-guide.md
│   ├── feedback-schema.md
│   └── design-system.md
└── templates/                # Copied to runtime dir on first start
    ├── server/               # Express + WebSocket backend
    │   ├── index.js
    │   ├── routes/api.js
    │   └── lib/              # store, ws, ids, time
    ├── ui/                   # React + Vite frontend
    │   └── src/
    │       ├── pages/        # Dashboard, DeliveryPage, Settings
    │       ├── components/   # GeneratedContentFrame, FeedbackSidebar, ...
    │       ├── hooks/        # useWebSocket, useDeliveries, useDesignTokens
    │       └── lib/          # bridge.js, api.js, i18n.js, theme.js
    ├── locales/              # Built-in locale files
    └── design/               # Default design tokens
```

### Runtime

On first start, `scripts/start.js` copies `templates/` to `{project}/.visual-delivery/`, installs dependencies, builds the frontend, and starts the server. This runtime directory is gitignored and regenerated as needed.

### How Generative UI Works

1. The agent analyzes the task result and designs a page layout
2. It generates a complete `<!DOCTYPE html>` page with inline CSS/JS
3. The page is posted to `POST /api/deliveries`
4. The frontend renders it in a sandboxed iframe
5. A **bridge script** is injected into the iframe, enabling:
   - Text selection → annotation feedback
   - `data-vd-feedback-*` button clicks → structured feedback
   - Iframe height auto-sync
   - Design token injection as CSS variables

Allowed CDN libraries include Tailwind CSS, Chart.js, Mermaid, D3.js, and Highlight.js.

## Configuration

### Design Tokens

Customize the visual appearance through the Settings page or the API:

```bash
# Read current tokens
curl http://localhost:3847/api/design-tokens

# Update via Settings page or ask the agent:
# "Change the primary color to purple"
```

Tokens include colors (primary, background, surface, text, border), typography (font family, sizes), and spacing.

### Platform Branding

Set a custom platform name, logo, slogan, and visual style through the Settings page or `PUT /api/settings`.

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/deliveries` | List all deliveries |
| `POST /api/deliveries` | Create a new delivery |
| `GET /api/deliveries/:id` | Get delivery details |
| `PUT /api/deliveries/:id/content` | Update delivery content |
| `GET /api/deliveries/:id/feedback` | Get feedback (lightweight) |
| `POST /api/deliveries/:id/feedback/resolve` | Mark feedback as handled |
| `GET /api/settings` | Read settings |
| `PUT /api/settings` | Update settings |
| `GET /api/design-tokens` | Read design tokens |
| `GET /api/locale` | Read UI locale strings |
| `PUT /api/locale` | Update UI locale strings |

Full API documentation: [references/api.md](references/api.md)

## Development

All source code lives in `templates/`. The runtime directory (`.visual-delivery/`) is generated — never edit it directly.

```bash
# Start the service (Chinese)
node scripts/start.js --data-dir /path/to/.visual-delivery --lang zh

# Start the service (English)
node scripts/start.js --data-dir /path/to/.visual-delivery --lang en

# Stop the service
node scripts/stop.js --data-dir /path/to/.visual-delivery

# Health check
curl -s http://localhost:3847/health
```

After modifying files in `templates/`, restart the service to sync changes to the runtime directory.

## License

This project is licensed under the [MIT License](./LICENSE).

You are free to use, modify, and distribute this software in both personal and commercial projects. See the [LICENSE](./LICENSE) file for full terms.
