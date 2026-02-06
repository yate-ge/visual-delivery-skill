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

### Instruction Structure

```
## Visual Delivery

[One sentence: what this skill does]

### Paths
[Define SKILL_DIR and DATA_DIR — two lines]

### Step 1: Ensure service is running
- Input: none
- Run: [health check command]
- Output: [JSON]
- If not running: [start command]

### Step 2: Deliver results
[Mode selection guidance + three sub-sections with curl examples]

### Step 3: Read feedback and annotations
[File paths to read]

### References
**Feedback schema types**: See [references/feedback-schema.md](references/feedback-schema.md)
**UI components and theming**: See [references/ui-components.md](references/ui-components.md)
**API endpoints**: See [references/api.md](references/api.md)
```

### Progressive Disclosure Rules

From best practices:

- **Keep references ONE level deep** — SKILL.md → references/api.md (good). SKILL.md → references/api.md → references/details.md (bad, too deep)
- **Reference files > 100 lines** must include a table of contents at the top
- **Name files descriptively** — `feedback-schema.md`, not `doc2.md`
- **Prefer execution over reading** — "Run `start.sh`" not "See `start.sh` for the logic"

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
