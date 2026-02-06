# Development Roadmap

## Phase Overview

| Phase | Scope | Goal |
|-------|-------|------|
| **Phase 1** | Foundation | Server + minimal frontend + passive delivery |
| **Phase 2** | Interaction | Interactive delivery + feedback components + annotations |
| **Phase 3** | Blocking | Blocking delivery + await-feedback.sh + real-time alerts |
| **Phase 4** | Polish | Theme system + customization + remote access |
| **Phase 5** | Skill Integration | SKILL.md + references + end-to-end testing |

---

## Phase 1: Foundation

**Goal:** Agent can start a server and deliver passive content that users can view.

### Tasks

1. **Project setup**
   - Initialize `server/package.json` with express, ws
   - Initialize `ui/package.json` with React, Vite
   - Root `package.json` with workspace scripts

2. **Server core**
   - `server/index.js` — CLI args, Express bootstrap, static serving
   - `server/lib/store.js` — JSON file read/write helpers with atomic write
   - `server/lib/ids.js` — ID generation
   - `GET /health` endpoint
   - `POST /api/deliveries` — create delivery (passive mode only)
   - `GET /api/deliveries` — list deliveries
   - `GET /api/deliveries/:id` — get single delivery

3. **Frontend shell**
   - Vite + React project scaffold
   - `Dashboard` page — list deliveries
   - `DeliveryPage` page — render markdown content
   - `ContentRenderer` component — markdown rendering
   - Basic routing (/ and /d/:id)
   - Minimal CSS (no theme system yet)

4. **scripts/start.sh (basic)**
   - Start server with `--data-dir` and `--port`
   - PID file management
   - Dependency installation
   - No tunnel yet

5. **scripts/stop.sh**
   - Kill server process via PID file

### Exit Criteria
- `bash scripts/start.sh` starts the server
- `curl POST /api/deliveries` creates a passive delivery
- Browser at `localhost:3847` shows the delivery list
- Clicking a delivery shows rendered markdown content
- `bash scripts/stop.sh` stops the server

---

## Phase 2: Interaction

**Goal:** Users can submit feedback and add annotations on deliveries.

### Tasks

1. **Feedback system**
   - `POST /api/deliveries/:id/feedback` endpoint
   - `FeedbackRenderer` component (routes schema to specific component)
   - `FeedbackConfirm` component
   - `FeedbackSelect` component
   - `FeedbackForm` component
   - `FeedbackRating` component
   - Interactive delivery creation (mode: "interactive" with feedback_schema)

2. **Annotation system**
   - `POST /api/deliveries/:id/annotate` endpoint
   - `AnnotationLayer` component (text selection → annotation creation)
   - `AnnotationSidebar` component (list annotations)
   - Highlight rendering on content

3. **WebSocket foundation**
   - `server/lib/ws.js` — WebSocket server setup
   - Broadcast `new_delivery` on creation
   - Broadcast `feedback_received` on submission
   - Frontend `useWebSocket` hook
   - Auto-reconnect with backoff

4. **Dashboard enhancements**
   - Mode filter (All / Passive / Interactive / Blocking)
   - Status badges
   - Delivery card shows mode and status

### Exit Criteria
- Create interactive delivery with feedback_schema
- Browser renders appropriate feedback UI based on schema type
- User can submit feedback → data appears in feedback-responses.json
- User can annotate content → data appears in annotations.json
- Agent can read feedback/annotation files
- New deliveries appear in browser without refresh (WebSocket)

---

## Phase 3: Blocking

**Goal:** Agent can create blocking deliveries and wait for user response.

### Tasks

1. **Session management**
   - Session creation on blocking delivery
   - `GET /api/sessions/:id` endpoint
   - Session status updates on feedback submission

2. **await-feedback.sh**
   - Full implementation per scripts-spec.md
   - Creates blocking delivery via API
   - Poll loop with configurable timeout
   - JSON output (responded / timeout / error)
   - jq availability check with fallback

3. **Blocking UI**
   - `BlockingAlert` component — prominent top bar
   - Visual urgency indicators (color, animation)
   - Dashboard sorts blocking items to top
   - Delivery page shows "Agent is waiting" indicator

4. **Timeout handling**
   - Server-side: mark session as timeout after expiry
   - Frontend: show timeout state
   - await-feedback.sh: clean exit on timeout

### Exit Criteria
- `bash scripts/await-feedback.sh --title "..." --schema '{...}'` blocks
- User responds in browser → script returns feedback JSON
- Timeout → script returns timeout JSON
- Browser shows blocking alert with urgency
- Multiple blocking deliveries are prioritized in dashboard

---

## Phase 4: Polish

**Goal:** Theme customization, remote access, responsive design.

### Tasks

1. **Theme system**
   - `assets/theme/default.json` — full default theme
   - `GET /api/theme` endpoint (merge default + custom)
   - CSS variable injection on frontend load
   - All components use CSS variables
   - `Settings` page with theme preview

2. **User customization**
   - Document theme override via `custom/theme.json`
   - Deep merge logic
   - Hot-reload: watch custom/theme.json for changes

3. **Remote access (cloudflared)**
   - Environment detection in start.sh
   - cloudflared tunnel setup (via npx cloudflared)
   - Tunnel URL output and persistence
   - Tunnel process management in stop.sh
   - `--remote` / `--no-remote` flags

4. **Responsive design**
   - Mobile-friendly feedback forms (critical for blocking mode)
   - Tablet layout (stacked)
   - Desktop layout (sidebar)

5. **UX refinements**
   - Loading states
   - Error states
   - Empty states
   - Smooth transitions / animations for new deliveries
   - Sound/notification for blocking requests (optional)

### Exit Criteria
- Custom theme.json changes appearance
- `start.sh --remote` creates cloudflared tunnel, outputs public URL
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
   - Evaluation structure:
     ```json
     {
       "skills": ["visual-delivery"],
       "query": "Generate a test report and show it to me visually",
       "expected_behavior": [
         "Starts the visual delivery server",
         "Creates a passive delivery with formatted content",
         "Provides the URL for viewing"
       ]
     }
     ```
   - Minimum evaluation scenarios:
     - Passive delivery (agent presents report)
     - Interactive delivery (agent requests code review)
     - Blocking delivery (agent needs deploy target decision)
     - Reading historical feedback (agent acts on prior annotations)
     - Remote access flow (cloud environment detection)

2. **SKILL.md finalization**
   - Write final SKILL.md with actual paths and API endpoints
   - **Body must be under 500 lines**
   - Test trigger description against example prompts
   - Verify all instructions work as documented
   - Ensure consistent terminology throughout

3. **Reference documents (one level deep from SKILL.md)**
   - `references/api.md` — API endpoints, simplified for agent consumption
   - `references/feedback-schema.md` — all schema types with examples
   - `references/ui-components.md` — component catalog + theme customization
   - Each file > 100 lines must include a table of contents

4. **agents/openai.yaml**
   - Interface metadata (third-person short_description)
   - Dependency declarations (if any)

5. **Evaluate and iterate**
   - Run all evaluation scenarios with SKILL.md loaded
   - Compare against baseline
   - Observe how the agent navigates the skill:
     - Does it read files in the expected order?
     - Does it miss references?
     - Does it ignore any bundled files?
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
- Remote access works end-to-end
- Theme customization works end-to-end

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

**Code and scripts:**
- [ ] Scripts solve problems, don't punt to the agent
- [ ] Error handling is explicit with actionable messages
- [ ] No voodoo constants (all values justified with comments)
- [ ] Required packages listed (Node.js, curl, optional: jq, cloudflared)
- [ ] No Windows-style paths (all forward slashes)
- [ ] Validation/verification for critical operations
- [ ] jq fallback implemented in await-feedback.sh

**Testing:**
- [ ] At least 3 evaluation scenarios created and passing
- [ ] Tested with real agent usage scenarios
- [ ] Tested with multiple models if possible

---

## File Creation Order

For implementation, files should be created in this order to allow
incremental testing:

```
Phase 1:
  1. package.json (root)
  2. server/package.json
  3. server/lib/ids.js
  4. server/lib/store.js
  5. server/routes/api.js
  6. server/index.js
  7. scripts/start.sh
  8. scripts/stop.sh
  9. ui/package.json + vite.config.js
  10. ui/src/main.jsx + App.jsx
  11. ui/src/pages/Dashboard.jsx
  12. ui/src/pages/DeliveryPage.jsx
  13. ui/src/components/ContentRenderer.jsx
  → Test: start server, create delivery, view in browser

Phase 2:
  14. server/lib/ws.js
  15. Update server/routes/api.js (feedback, annotate endpoints)
  16. Update server/index.js (WebSocket)
  17. ui/src/hooks/useWebSocket.js
  18. ui/src/components/feedback/FeedbackRenderer.jsx
  19. ui/src/components/feedback/FeedbackConfirm.jsx
  20. ui/src/components/feedback/FeedbackSelect.jsx
  21. ui/src/components/feedback/FeedbackForm.jsx
  22. ui/src/components/feedback/FeedbackRating.jsx
  23. ui/src/components/AnnotationLayer.jsx
  24. ui/src/components/AnnotationSidebar.jsx
  → Test: interactive delivery, submit feedback, add annotations

Phase 3:
  25. Update server/routes/api.js (sessions endpoint)
  26. scripts/await-feedback.sh
  27. ui/src/components/BlockingAlert.jsx
  28. Update Dashboard (blocking priority)
  → Test: blocking flow end-to-end

Phase 4:
  29. assets/theme/default.json
  30. ui/src/lib/theme.js
  31. ui/src/hooks/useTheme.js
  32. Update start.sh (environment detection, cloudflared)
  33. Update stop.sh (tunnel cleanup)
  34. Responsive CSS
  → Test: theme customization, remote access

Phase 5:
  35. SKILL.md
  36. references/api.md
  37. references/feedback-schema.md
  38. references/ui-components.md
  39. agents/openai.yaml
  → Test: end-to-end with real agent
```
