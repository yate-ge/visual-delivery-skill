# Development Roadmap

## Phase Overview

| Phase | Scope | Goal |
|-------|-------|------|
| **Phase 1** | Foundation + Design System | Server + runtime-built frontend + passive delivery + design tokens |
| **Phase 2** | Interaction | Interactive delivery + feedback components + annotations |
| **Phase 3** | Blocking | Blocking delivery + await-feedback.js + real-time alerts |
| **Phase 4** | Polish | Remote access + responsive design + UX refinements |
| **Phase 5** | Skill Integration | SKILL.md + references + end-to-end testing |

---

## Phase 1: Foundation + Design System

**Goal:** Agent can initialize the work directory, start a server with design
system support, and deliver passive content that users can view.

### Tasks

1. **Skill directory structure**
   - Create `templates/server/package.json` with express, ws
   - Create `templates/ui/package.json` with React, Vite
   - Create `templates/design/design-spec.md` (from template)
   - Create `templates/design/tokens.json` (default tokens)

2. **Server core** (in `templates/server/`)
   - `index.js` — CLI args, Express bootstrap, static serving from `--ui-dir`
   - `lib/store.js` — JSON file read/write with per-delivery file locking
   - `lib/ids.js` — ID generation
   - `lib/ws.js` — WebSocket setup, broadcast helper
   - `routes/api.js` — API route handlers
   - `GET /health` endpoint
   - `POST /api/deliveries` — create delivery (passive mode, creates per-delivery dir)
   - `GET /api/deliveries` — list deliveries (from index.json)
   - `GET /api/deliveries/:id` — get single delivery (from per-delivery dir)
   - `GET /api/design-tokens` — serve design tokens
   - Design token file watcher → WebSocket broadcast

3. **Frontend shell** (in `templates/ui/`)
   - Vite + React project scaffold
   - `lib/theme.js` — token flattening + CSS variable injection
   - `lib/eventBus.js` — simple event emitter for WebSocket events
   - `hooks/useDesignTokens.js` — load tokens + hot-reload via WebSocket
   - `hooks/useWebSocket.js` — WebSocket connection with reconnect
   - `styles/variables.css` — CSS variable fallback defaults
   - `Dashboard` page — list deliveries
   - `DeliveryPage` page — render markdown content
   - `ContentRenderer` component — markdown rendering
   - Basic routing (/ and /d/:id)
   - All styles via CSS variables from design tokens

4. **scripts/start.js (full init flow, Node.js cross-platform)**
   - Template copying (server, ui, design → work dir)
   - Data directory initialization (data/deliveries/, index.json)
   - Dependency installation (`npm install` in work dir)
   - Frontend build (`npm run build` in work dir)
   - Server start with `--ui-dir` pointing to built frontend
   - PID file management (cross-platform process.kill)
   - UX output messages (`[visual-delivery]` prefix to stderr)
   - JSON output to stdout
   - First-run detection and design spec generation message

5. **scripts/stop.js (Node.js cross-platform)**
   - Kill server process via PID file
   - JSON + UX output

### Exit Criteria
- `node scripts/start.js` initializes work dir and starts server
- First run: templates copied, deps installed, frontend built, design spec generated
- `curl POST /api/deliveries` creates a passive delivery (per-delivery dir created)
- Browser at `localhost:3847` shows the delivery list styled with design tokens
- Editing `tokens.json` → UI updates in real-time via WebSocket
- `node scripts/stop.js` stops the server
- Subsequent `start.js` runs skip init (fast start)
- Works on Windows, macOS, and Linux

---

## Phase 2: Interaction

**Goal:** Users can submit feedback and add annotations on deliveries.

### Tasks

1. **Feedback system**
   - `POST /api/deliveries/:id/feedback` endpoint (with per-delivery file locking)
   - `FeedbackRenderer` component (routes schema to specific component)
   - `FeedbackConfirm` component
   - `FeedbackSelect` component
   - `FeedbackForm` component
   - `FeedbackRating` component
   - Interactive delivery creation (mode: "interactive" with feedback_schema)

2. **Annotation system**
   - `POST /api/deliveries/:id/annotate` endpoint (with per-delivery file locking)
   - `AnnotationLayer` component (text selection → annotation creation)
   - `AnnotationSidebar` component (list annotations)
   - Highlight rendering on content

3. **WebSocket events**
   - Broadcast `new_delivery` on creation
   - Broadcast `feedback_received` on submission
   - Frontend `useDeliveries` hook with real-time updates

4. **Dashboard enhancements**
   - Mode filter (All / Passive / Interactive / Blocking)
   - Status badges (styled via design tokens)
   - Delivery card shows mode and status

### Exit Criteria
- Create interactive delivery with feedback_schema
- Browser renders appropriate feedback UI based on schema type
- User can submit feedback → data appears in `data/deliveries/{id}/feedback.json`
- User can annotate content → data appears in `data/deliveries/{id}/annotations.json`
- Agent can read per-delivery feedback/annotation files
- New deliveries appear in browser without refresh (WebSocket)

---

## Phase 3: Blocking

**Goal:** Agent can create blocking deliveries and wait for user response.

### Tasks

1. **Session management**
   - Session creation on blocking delivery (creates `session.json` in delivery dir)
   - `GET /api/sessions/:id` endpoint
   - Session status updates on feedback submission

2. **scripts/await-feedback.js (Node.js cross-platform)**
   - Full implementation per scripts-spec.md
   - Creates blocking delivery via fetch()
   - Poll loop with configurable timeout (default: 5 minutes)
   - JSON output (responded / timeout / error)
   - UX output to stderr
   - **Timeout is NOT an error** — delivery stays open, agent reminds user
   - No external dependencies (uses built-in fetch, JSON.parse)

3. **Blocking UI**
   - `BlockingAlert` component — prominent top bar (styled via design tokens)
   - Visual urgency indicators (color, animation from tokens)
   - Dashboard sorts blocking items to top
   - Delivery page shows "Agent is waiting" indicator

4. **Timeout handling**
   - Server-side: mark session as timeout after expiry
   - Frontend: show timeout state (delivery stays available)
   - await-feedback.js: clean exit 0 on timeout with reminder message

### Exit Criteria
- `node scripts/await-feedback.js --title "..." --schema '{...}'` blocks
- User responds in browser → script returns feedback JSON
- Timeout → script returns timeout JSON (exit 0, not error)
- Browser shows blocking alert with urgency
- Multiple blocking deliveries are prioritized in dashboard
- After timeout, user can still respond → feedback is recorded

---

## Phase 4: Polish

**Goal:** Remote access, responsive design, UX refinements.

### Tasks

1. **Remote access (cloudflared)**
   - Environment detection in start.js
   - cloudflared check with install guidance:
     - If not found: log install instructions, continue without tunnel
     - If found: set up tunnel, output remote URL
   - Tunnel URL output and persistence
   - Tunnel process management in stop.js
   - `--remote` / `--no-remote` flags

2. **Responsive design**
   - Mobile-friendly feedback forms (critical for blocking mode)
   - Tablet layout (stacked)
   - Desktop layout (sidebar)
   - All breakpoints use design token values

3. **UX refinements**
   - Loading states
   - Error states
   - Empty states
   - Smooth transitions / animations for new deliveries
   - Sound/notification for blocking requests (optional)

4. **Settings page**
   - Design token preview
   - Current token values displayed
   - Link to design-spec.md and tokens.json paths

### Exit Criteria
- `node scripts/start.js --remote` creates cloudflared tunnel, outputs public URL
- `node scripts/start.js` in remote env without cloudflared → logs install instructions, continues
- Responsive layout works on mobile/tablet/desktop
- Clean UX for all states

---

## Phase 5: Skill Integration & Evaluation

**Goal:** Complete SKILL.md, references, evaluation suite, and end-to-end validation.

Per best practices: build evaluations BEFORE writing extensive documentation.
Evaluations are the source of truth for measuring skill effectiveness.

### Tasks

1. **Build evaluations first**
   - Create 3+ evaluation scenarios that test real agent workflows
   - Establish baseline: run scenarios without SKILL.md loaded
   - Minimum evaluation scenarios:
     - Passive delivery (agent presents report)
     - Interactive delivery (agent requests code review)
     - Blocking delivery (agent needs deploy target decision)
     - Blocking timeout (agent handles timeout gracefully, reminds user)
     - Design customization (user edits spec, agent applies tokens)
     - Reading historical feedback (agent acts on prior annotations)
     - Remote access flow (cloud environment detection)

2. **SKILL.md finalization**
   - Write final SKILL.md with actual paths and API endpoints
   - **Body must be under 500 lines**
   - **Include UX notification instructions at every step**
   - Test trigger description against example prompts
   - Verify all instructions work as documented
   - Ensure consistent terminology throughout

3. **Reference documents (one level deep from SKILL.md)**
   - `references/api.md` — API endpoints, simplified for agent consumption
   - `references/feedback-schema.md` — all schema types with examples
   - `references/ui-components.md` — component catalog + design token usage
   - `references/design-system.md` — design spec + tokens customization guide
   - Each file > 100 lines must include a table of contents

4. **agents/openai.yaml**
   - Interface metadata (third-person short_description)
   - Dependency declarations (if any)

5. **Evaluate and iterate**
   - Run all evaluation scenarios with SKILL.md loaded
   - Compare against baseline
   - Observe how the agent navigates the skill:
     - Does it inform the user at every step?
     - Does it read files in the expected order?
     - Does it miss references?
     - Does it handle timeout gracefully?
     - Does it generate design spec on first run?
   - Iterate SKILL.md based on observations, not assumptions
   - Test with Claude (Haiku, Sonnet, Opus) and Codex if available

6. **Documentation**
   - User-facing README.md (installation, usage)
   - Quick start guide

### Exit Criteria
- All evaluation scenarios pass
- SKILL.md body is under 500 lines
- All reference docs are one level deep and include TOC if > 100 lines
- Consistent terminology throughout all files
- Agent following SKILL.md can complete all delivery workflows
- Agent informs user at every step (UX requirement verified)
- Design system customization works end-to-end
- Remote access works end-to-end

### Quality Checklist (from best practices)

Before release, verify:

**Core quality:**
- [ ] Description is third-person, specific, includes key terms
- [ ] Description includes both what and when (and when NOT)
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate reference files
- [ ] No time-sensitive information
- [ ] Consistent terminology (delivery/feedback/annotation/blocking)
- [ ] Examples are concrete, not abstract
- [ ] File references one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps with explicit inputs/outputs
- [ ] Agent informs user at every significant step

**Code and scripts:**
- [ ] Scripts are Node.js (cross-platform: Windows, macOS, Linux)
- [ ] Scripts solve problems, don't punt to the agent
- [ ] Error handling is explicit with actionable messages
- [ ] No voodoo constants (all values justified with comments)
- [ ] Required packages listed (Node.js >= 18, optional: cloudflared)
- [ ] No Windows-style paths (all forward slashes via path.join)
- [ ] Validation/verification for critical operations
- [ ] Per-delivery file locking for concurrent JSON writes
- [ ] UX output on stderr, JSON output on stdout

**Data model:**
- [ ] Per-delivery instance directories under data/deliveries/
- [ ] Lightweight index.json for dashboard listing
- [ ] Agent can read individual delivery files without parsing large arrays
- [ ] File locking scoped per-delivery (not global)

**Design system:**
- [ ] Design spec template is clear and user-friendly
- [ ] tokens.json drives all CSS variables
- [ ] Hot-reload works when tokens.json is edited
- [ ] Design spec → agent → tokens workflow works

**Testing:**
- [ ] At least 3 evaluation scenarios created and passing
- [ ] Tested with real agent usage scenarios
- [ ] Tested with multiple models if possible
- [ ] Blocking timeout behavior verified (reminds, doesn't error)
- [ ] Cross-platform tested (Windows, macOS, Linux)

---

## File Creation Order

For implementation, files should be created in this order to allow
incremental testing:

```
Phase 1:
  1. templates/design/tokens.json (default design tokens)
  2. templates/design/design-spec.md (design specification template)
  3. templates/server/package.json
  4. templates/server/lib/ids.js
  5. templates/server/lib/store.js (with per-delivery file locking)
  6. templates/server/lib/ws.js
  7. templates/server/routes/api.js (creates per-delivery dirs, manages index.json)
  8. templates/server/index.js (serves --ui-dir, watches tokens)
  9. scripts/start.js (Node.js, full init flow with UX output)
  10. scripts/stop.js (Node.js, cross-platform process management)
  11. templates/ui/package.json + vite.config.js
  12. templates/ui/src/lib/theme.js (token flattening)
  13. templates/ui/src/lib/eventBus.js
  14. templates/ui/src/hooks/useDesignTokens.js
  15. templates/ui/src/hooks/useWebSocket.js
  16. templates/ui/src/styles/variables.css
  17. templates/ui/src/main.jsx + App.jsx
  18. templates/ui/src/pages/Dashboard.jsx
  19. templates/ui/src/pages/DeliveryPage.jsx
  20. templates/ui/src/components/ContentRenderer.jsx
  → Test: start.js inits, builds, starts; create delivery; view in browser;
    verify per-delivery dir created; edit tokens.json → UI updates

Phase 2:
  21. Update templates/server/routes/api.js (feedback, annotate endpoints — per-delivery files)
  22. templates/ui/src/hooks/useDeliveries.js
  23. templates/ui/src/components/feedback/FeedbackRenderer.jsx
  24. templates/ui/src/components/feedback/FeedbackConfirm.jsx
  25. templates/ui/src/components/feedback/FeedbackSelect.jsx
  26. templates/ui/src/components/feedback/FeedbackForm.jsx
  27. templates/ui/src/components/feedback/FeedbackRating.jsx
  28. templates/ui/src/components/AnnotationLayer.jsx
  29. templates/ui/src/components/AnnotationSidebar.jsx
  → Test: interactive delivery, submit feedback, add annotations
  → Verify: feedback in data/deliveries/{id}/feedback.json
  → Note: rebuild frontend in work dir after template changes

Phase 3:
  30. Update templates/server/routes/api.js (sessions — per-delivery session.json)
  31. scripts/await-feedback.js (Node.js, with timeout reminder behavior)
  32. templates/ui/src/components/BlockingAlert.jsx
  33. Update Dashboard (blocking priority)
  → Test: blocking flow end-to-end, timeout behavior

Phase 4:
  34. Update scripts/start.js (cloudflared with install guidance)
  35. Update scripts/stop.js (tunnel cleanup)
  36. Responsive CSS across all components
  37. templates/ui/src/pages/Settings.jsx
  → Test: remote access, responsive layouts

Phase 5:
  38. Evaluation scenarios (test without skill first → baseline)
  39. SKILL.md (under 500 lines, UX notifications, third-person description)
  40. references/api.md (TOC if > 100 lines)
  41. references/feedback-schema.md (TOC if > 100 lines)
  42. references/ui-components.md (TOC if > 100 lines)
  43. references/design-system.md (TOC if > 100 lines)
  44. agents/openai.yaml
  → Evaluate: run all scenarios with skill loaded
  → Iterate: adjust SKILL.md based on observed agent behavior
  → Verify: quality checklist passes
```
