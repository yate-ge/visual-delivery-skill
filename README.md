[English](./README.md) | [中文](./README.zh-CN.md)

# Visual Delivery Skill

An agent skill that turns task results into visual, interactive web pages — and lets users give feedback right on the page. Works with [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://github.com/openai/codex), [OpenClaw](https://github.com/anthropics/open-claw), and other agent frameworks that support the skill protocol.

## What It Does

Instead of dumping results as plain text in the chat, the agent **generates a web page** tailored for reviewing task results — dashboards, comparison tables, code reviews, data visualizations, or any layout that makes the output easy to read and act on.

You open the page in a browser, review the results visually, and **provide feedback directly on the page**: annotate text, click action buttons, or type comments. The agent reads your feedback and continues working — fix the code you flagged, revise the section you commented on, or explore the direction you chose.

This closes the loop between "agent does work" and "human reviews work", making collaboration faster and more precise than going back and forth in chat.

### Key Features

- **Generative UI** — Every delivery page is uniquely generated to match the task. No fixed templates; the agent designs the layout, content, and interactions from scratch.
- **Structured Feedback** — Annotate any text, click per-item action buttons (e.g., "Accept Fix", "Defer"), or type free-text comments. Feedback flows back to the agent automatically.
- **Design Tokens** — Customizable colors, typography, and spacing. Edit through the Settings page or just ask the agent to restyle.
- **Multi-Language** — Built-in English locale. For any other language, the agent generates the UI locale at startup.
- **Real-Time Updates** — Deliveries and feedback appear instantly via WebSocket.
- **Local-First** — Runs on `localhost:3847`. Optional remote access via [cloudflared](https://github.com/cloudflare/cloudflared) tunnel.

## Installation

Clone or copy this repo into the skills directory of your agent framework:

```bash
# Claude Code
cp -r visual-delivery-skill your-project/.claude/skills/

# Codex
cp -r visual-delivery-skill your-project/.codex/skills/
```

The agent will automatically discover and load the skill.

## Usage

Start a conversation with the agent and trigger the skill:

```
You: Start visual delivery
```

The agent will:

1. **Start the service** — launches a local server on port 3847
2. **Show the URL** — `http://localhost:3847`
3. **Ask about remote access** — local only, or start a tunnel for external access

Once running, task results that benefit from visual presentation are automatically delivered as interactive web pages.

### Trigger Modes

Control when the agent uses visual delivery (configurable in Settings):

| Mode | Behavior |
|------|----------|
| **Smart** (default) | Agent decides — visual for complex results, plain text for simple answers |
| **Auto** | Always deliver visually |
| **Manual** | Only when you explicitly ask |

### Feedback Workflow

1. The agent delivers a visual page with per-item feedback options
2. You review and provide feedback:
   - **Annotate** — select any text to add a comment
   - **Action buttons** — context-specific choices per item (e.g., "Accept Fix", "Defer", "Won't Fix")
   - **Free text** — "Other..." input for each item, plus a global comment box
3. Submit feedback from the sidebar
4. The agent processes feedback, updates the page, and continues working

## Architecture

```
visual-delivery-skill/
├── SKILL.md                  # Agent instructions (skill entry point)
├── scripts/
│   ├── start.js              # Launch server + build frontend
│   └── stop.js               # Graceful shutdown
├── references/               # Supplementary docs for SKILL.md
│   ├── api.md
│   ├── generative-ui-guide.md
│   ├── feedback-schema.md
│   └── design-system.md
└── templates/                # Copied to runtime dir on first start
    ├── server/               # Express + WebSocket backend
    ├── ui/                   # React + Vite frontend
    ├── locales/              # Built-in locale files
    └── design/               # Default design tokens
```

### Runtime

On first start, `start.js` copies `templates/` into the project's `.visual-delivery/` directory, installs dependencies, builds the frontend, and starts the server. This runtime directory is gitignored and regenerated as needed.

### How It Works

1. The agent analyzes the task result and designs a page layout
2. It generates a self-contained web page with inline styles and scripts
3. The page is published to the local server
4. The frontend renders it in a sandboxed iframe
5. A bridge script enables communication between the page and the feedback sidebar

The agent can use CDN libraries like Tailwind CSS, Chart.js, Mermaid, D3.js, and Highlight.js to build rich visualizations.

## Configuration

### Design Tokens

Customize the visual appearance through the Settings page, or just ask the agent:

> "Change the primary color to purple"

Tokens cover colors (primary, background, surface, text, border), typography (font family, sizes), and spacing.

### Platform Branding

Set a custom platform name, logo, slogan, and visual style through the Settings page.

## License

This project is licensed under the [MIT License](./LICENSE).
