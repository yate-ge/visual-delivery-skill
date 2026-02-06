# Visual Delivery Skill - Development Documentation

## Overview

Visual Delivery Skill is an agent skill that deploys a local web service for
task result delivery. Agents use it to present results visually, collect user
feedback, and support human-in-the-loop workflows.

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | System architecture, component diagram, data flow |
| [skill-spec.md](./skill-spec.md) | SKILL.md specification, trigger rules, instructions format |
| [data-model.md](./data-model.md) | JSON data structures, file layout, path conventions |
| [api-spec.md](./api-spec.md) | REST API endpoints, WebSocket protocol |
| [server-design.md](./server-design.md) | Server implementation, lifecycle, tunnel management |
| [frontend-design.md](./frontend-design.md) | UI components, theme system, customization |
| [scripts-spec.md](./scripts-spec.md) | Shell scripts specification, inputs/outputs |
| [roadmap.md](./roadmap.md) | Development phases and milestones |
| [skill-best-practices.md](./skill-best-practices.md) | Authoring best practices reference |

## Key Design Decisions

1. **Skill + Instructions, not MCP** — Agent uses existing tools (Bash, Read, Write, curl) guided by SKILL.md instructions. No MCP server dependency.
2. **Skill directory is read-only** — All runtime data goes to `{CWD}/.visual-delivery/`.
3. **JSON file storage** — No database. Lightweight, human-readable, agent-readable.
4. **Instructions over scripts** — Scripts only for deterministic behavior (server start, blocking poll). Everything else is agent instructions.
5. **cloudflared for remote access** — Zero-signup tunnel via Cloudflare Quick Tunnel.
6. **Customizable UI** — Default theme + component library, user-overridable per project.
7. **Concise SKILL.md** — Body under 500 lines. Detailed specs in `references/` (one level deep).

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
