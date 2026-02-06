# Visual Delivery Skill - Development Documentation

## Overview

Visual Delivery Skill is an agent skill that deploys a local web service for
task result delivery. Agents use it to present results visually, collect user
feedback, and support human-in-the-loop workflows.

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | System architecture, template/instance model, data flow |
| [skill-spec.md](./skill-spec.md) | SKILL.md specification, trigger rules, UX requirements |
| [data-model.md](./data-model.md) | JSON data structures, file layout, path conventions |
| [api-spec.md](./api-spec.md) | REST API endpoints, WebSocket protocol |
| [server-design.md](./server-design.md) | Server implementation, file locking, design token watcher |
| [frontend-design.md](./frontend-design.md) | UI components, runtime build, design system integration |
| [design-system.md](./design-system.md) | Design spec, tokens, CSS variables, hot-reload, customization |
| [scripts-spec.md](./scripts-spec.md) | Shell scripts specification, UX output, init flow |
| [roadmap.md](./roadmap.md) | Development phases and milestones |
| [skill-best-practices.md](./skill-best-practices.md) | Authoring best practices reference |

## Key Design Decisions

1. **Skill + Instructions, not MCP** — Agent uses existing tools (Bash, Read, Write, curl) guided by SKILL.md instructions. No MCP server dependency.
2. **Template → Instance model** — Skill directory is read-only with templates. All runtime files (server, frontend, design, data) are generated in `{CWD}/.visual-delivery/`.
3. **Runtime frontend build** — Frontend is built at runtime in the work directory (not pre-built). First `start.js` run copies templates, installs deps, and builds.
4. **Design system** — Design spec (human-readable) + design tokens (machine-readable) in work directory. User edits spec or tokens → UI updates via CSS variables + WebSocket hot-reload.
5. **Per-delivery data model** — Data organized per delivery instance (`data/deliveries/{id}/`). Lightweight `index.json` for listing. Agent reads only the files it needs. Less lock contention.
6. **JSON file storage with per-delivery locking** — No database. Per-delivery file locking prevents concurrent write conflicts. Atomic writes prevent partial reads.
7. **Agent UX notifications** — Agent MUST inform user at every significant step (init, delivery, timeout, etc.). Scripts output progress to stderr.
8. **Instructions over scripts** — Scripts only for deterministic behavior (init + server start, blocking poll). Everything else is agent instructions.
9. **Node.js scripts (cross-platform)** — All scripts are Node.js (not bash) for Windows, macOS, and Linux compatibility. Uses built-in `fetch()`, `fs.cpSync()`, `process.kill()`.
10. **cloudflared for remote access** — Zero-signup tunnel. If not installed, logs install guidance and continues without tunnel (not an error).
11. **Blocking timeout is not an error** — After 5 minutes, agent reminds user. Delivery stays open for later response. No retry, no re-creation.
12. **Concise SKILL.md** — Body under 500 lines. Detailed specs in `references/` (one level deep).

## Terminology Conventions

Use these terms consistently across all documents, code, and UI:

| Canonical Term | Meaning | Do NOT use |
|----------------|---------|------------|
| **delivery** | A task result published to the web service | result, output, report, task |
| **feedback** | User's structured response to a delivery | response, input, answer, reply |
| **annotation** | User's comment attached to delivery content | comment, note, remark |
| **blocking** | Mode where agent waits for feedback | waiting, polling, synchronous |
| **interactive** | Mode where feedback is collected asynchronously | async, non-blocking feedback |
| **passive** | Mode with display only, no feedback | static, read-only, view-only |
| **session** | A blocking wait context (created per blocking delivery) | request, ticket, poll |
| **design spec** | Human-readable design specification document | style guide, theme config |
| **design tokens** | Machine-readable design values (tokens.json) | theme, variables, config |
| **work directory** | `{CWD}/.visual-delivery/` — all runtime files | data dir, output dir |
| **skill directory** | Read-only directory with templates and scripts | source dir, install dir |
