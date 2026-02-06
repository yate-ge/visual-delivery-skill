# SKILL.md Specification

## Frontmatter

```yaml
---
name: visual-delivery
description: >
  Delivers task results visually through a web interface. Supports three modes:
  passive (display reports, diffs, summaries), interactive (collect feedback,
  reviews, approvals), and blocking (wait for user decisions before continuing).
  Activates when the agent needs to present structured results, request user
  review, or obtain a decision required to proceed. Does not activate for
  simple text responses or terminal-inline answers.
---
```

### Frontmatter Validation Rules

| Field | Constraint |
|-------|-----------|
| `name` | Max 64 chars, lowercase letters/numbers/hyphens only, no XML tags, no reserved words ("anthropic", "claude") |
| `description` | Max 1024 chars, non-empty, no XML tags, **must be third person** |

### Description Principles

- **Third person only** — description is injected into system prompt; mixed POV causes discovery problems
  - Good: "Delivers task results visually..."
  - Bad: "Use when you need to deliver..." / "I can deliver..."
- **Specific with key terms** — include both WHAT it does and WHEN to use it
- **Boundary-aware** — state when NOT to activate (prevents false triggers)

## Trigger Rules

**Should trigger (implicit):**
- Agent completed a complex task and wants to present structured results
- Agent needs user to review code changes, designs, or reports
- Agent needs a decision from the user to proceed (deploy target, config choice)
- Agent wants to collect structured feedback (ratings, form data)
- User explicitly asks to "see results" or "review" something

**Should NOT trigger:**
- Simple text answers ("what does this function do?")
- One-line status updates ("build succeeded")
- The user is actively chatting in terminal and expects inline responses
- No visual structure would add value over plain text

## Instructions Body

### Authoring Principles

1. **Concise** — SKILL.md body under 500 lines. Only add context the agent doesn't already have. Challenge each paragraph: "Does this justify its token cost?"
2. **Imperative steps** — each step starts with an action verb
3. **Explicit inputs/outputs** — every step declares what goes in and what comes out
4. **Progressive disclosure** — SKILL.md is the table of contents; detailed specs live in `references/` (one level deep only)
5. **Appropriate freedom** — high freedom for mode selection (agent decides based on context), low freedom for scripts (exact commands)
6. **Consistent terminology** — always "delivery", "feedback", "annotation", "blocking" (see README.md terminology table)
7. **UX-first** — agent MUST inform user at every significant step

### Instruction Structure

```
## Visual Delivery

[One sentence: what this skill does]

### Paths
[Define SKILL_DIR and DATA_DIR — two lines]

### Step 1: Ensure service is running
- Tell user: "Starting Visual Delivery service..."
- Run: node {SKILL_DIR}/scripts/start.js --data-dir {DATA_DIR}
- Parse JSON output
- If first_run: Tell user about design spec location
- Tell user: "Visual Delivery ready at {local_url}"

### Step 2: Deliver results
[Mode selection guidance]

#### Passive delivery
- Tell user: "Preparing visual delivery..."
- Run: curl POST /api/deliveries
- Tell user: "View the delivery at {url}"

#### Interactive delivery
- Tell user: "Creating interactive delivery for your review..."
- Run: curl POST /api/deliveries with feedback_schema
- Tell user: "Review and provide feedback at {url}"

#### Blocking delivery
- Tell user: "I need your input. Opening delivery for your response..."
- Run: node {SKILL_DIR}/scripts/await-feedback.js
- If responded: process feedback, tell user "Thanks for your feedback"
- If timeout: Tell user "No response received within 5 minutes.
  Please visit {url} when you're ready."
  Do NOT retry. Do NOT create a new blocking delivery.

### Step 3: Read feedback and annotations
[Per-delivery file paths: data/deliveries/{id}/feedback.json, annotations.json]
- Tell user what feedback was received and what action will be taken

### Step 4: Design customization (when requested)
- Read {DATA_DIR}/design/design-spec.md for design intent
- Update {DATA_DIR}/design/tokens.json to apply changes
- Tell user: "Design tokens updated. The UI will refresh automatically."

### References
**Feedback schema types**: See [references/feedback-schema.md](references/feedback-schema.md)
**UI components and theming**: See [references/ui-components.md](references/ui-components.md)
**API endpoints**: See [references/api.md](references/api.md)
**Design system**: See [references/design-system.md](references/design-system.md)
```

### Agent UX Requirements

The SKILL.md MUST instruct the agent to inform the user at every significant step.
This is critical for user experience — the user should never be left wondering
what the agent is doing.

**Required user notifications:**

| When | What to tell the user |
|------|----------------------|
| Before starting service | "Starting Visual Delivery service..." |
| Service ready | "Visual Delivery ready at {url}" |
| First initialization | "Design specification created at {path}. Edit to customize the UI." |
| Before creating delivery | "Preparing [mode] delivery..." |
| After creating delivery | "View/Review at {url}" |
| Blocking wait started | "Waiting for your input at {url}" |
| Blocking timeout | "No response within 5 minutes. Visit {url} when ready." |
| Feedback received | Summary of what was received |
| Design tokens updated | "Design updated. UI will refresh automatically." |
| Error occurred | Specific error message with next steps |

### Progressive Disclosure Rules

From best practices:

- **Keep references ONE level deep** — SKILL.md → references/api.md (good). SKILL.md → references/api.md → references/details.md (bad, too deep)
- **Reference files > 100 lines** must include a table of contents at the top
- **Name files descriptively** — `feedback-schema.md`, not `doc2.md`
- **Prefer execution over reading** — "Run `start.js`" not "See `start.js` for the logic"

### Path Variables

Instructions use these placeholders. The agent resolves them at runtime:

| Variable | Meaning | Example |
|----------|---------|---------|
| `{SKILL_DIR}` | Root of the installed skill directory (read-only) | `/path/to/visual-delivery-skill` |
| `{CWD}` | User's current working directory | `/Users/alice/my-project` |
| `{DATA_DIR}` | `{CWD}/.visual-delivery` (read-write) | `/Users/alice/my-project/.visual-delivery` |
| `{PORT}` | Server port | `3847` |

### Mode Selection Guidance

Include in SKILL.md to help the agent choose the right mode:

```markdown
Choose the delivery mode based on your need:

- You want to SHOW results → passive
  Examples: test report, code diff, generated documentation

- You want to COLLECT feedback but can continue working → interactive
  Examples: code review request, design review, satisfaction survey

- You CANNOT continue without user input → blocking
  Examples: deployment target selection, destructive action confirmation,
  ambiguous requirement clarification
```

### Degrees of Freedom

| Operation | Freedom | Why |
|-----------|---------|-----|
| Mode selection | High | Agent decides based on task context |
| Content formatting | High | Agent writes markdown/html freely |
| Feedback schema construction | Medium | Must follow schema spec, but agent chooses fields |
| Server start | Low | Exact script command, no variation |
| Blocking poll | Low | Exact script command, no variation |
| Reading feedback files | Medium | Agent reads JSON files, decides what to act on |
| Design token updates | Medium | Agent updates tokens based on design spec intent |
| User notifications | Low | Agent MUST inform user at every step (exact patterns) |

## Relation to agents/openai.yaml

The `agents/openai.yaml` file provides UI metadata for platforms that support it:

```yaml
interface:
  display_name: "Visual Delivery"
  short_description: "Delivers task results via web interface"
  brand_color: "#2563EB"
  default_prompt: ""

dependencies:
  tools: []  # No MCP tools — skill uses agent's built-in tools only
```

This file is optional and platform-specific. The skill functions without it.
