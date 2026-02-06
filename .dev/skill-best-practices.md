# Skill Authoring Best Practices

> Reference: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

## Core Principles

### 1. Concise is Key

The context window is shared. SKILL.md competes with system prompt, conversation history, other Skills, and the user's request.

**Default assumption**: Claude is already very smart. Only add context Claude doesn't already have.

Challenge each piece of information:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

Keep SKILL.md body **under 500 lines**. Split into separate files if approaching this limit.

### 2. Set Appropriate Degrees of Freedom

Match specificity to the task's fragility and variability:

- **High freedom** (text-based instructions): Multiple approaches are valid, decisions depend on context
- **Medium freedom** (pseudocode/scripts with parameters): A preferred pattern exists, some variation acceptable
- **Low freedom** (specific scripts, few parameters): Operations are fragile, consistency critical, specific sequence required

**Analogy**: Narrow bridge with cliffs → low freedom (exact instructions). Open field → high freedom (general direction).

### 3. Test with All Models

What works for Opus might need more detail for Haiku. Aim for instructions that work across models.

## Skill Structure

### Naming Conventions

Use **gerund form** (verb + -ing): lowercase letters, numbers, hyphens only.

- Good: `processing-pdfs`, `analyzing-spreadsheets`, `delivering-visually`
- Avoid: `helper`, `utils`, `tools` (too vague)

### Writing Effective Descriptions

- **Always write in third person** (description is injected into system prompt)
- Be specific and include key terms
- Include both WHAT the Skill does and WHEN to use it
- Max 1024 characters

```yaml
# Good
description: Extract text and tables from PDF files, fill forms, merge documents.
  Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Bad
description: Helps with documents
```

### Progressive Disclosure

SKILL.md is a table of contents. Claude reads it first, then loads additional files only as needed.

**Pattern 1: High-level guide with references**
```markdown
## Quick start
[Essential instructions here]

## Advanced features
**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
```

**Pattern 2: Domain-specific organization**
```
skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**Critical rule: Keep references ONE level deep from SKILL.md.**
- Bad: SKILL.md → advanced.md → details.md (too deep)
- Good: SKILL.md → advanced.md, SKILL.md → reference.md (all direct)

### Structure Longer Files with Table of Contents

For reference files >100 lines, include a TOC at the top so Claude can see the full scope even when previewing.

## Workflows and Feedback Loops

### Use Workflows for Complex Tasks

Break complex operations into clear sequential steps. Provide a checklist:

```markdown
Task Progress:
- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Execute
- [ ] Step 5: Verify output
```

### Implement Feedback Loops

**Pattern**: Run validator → fix errors → repeat

Validation loops catch errors early. Make validation scripts verbose with specific error messages.

## Content Guidelines

### Avoid Time-Sensitive Information

Don't include info that will become outdated. Use an "old patterns" section for deprecated approaches.

### Use Consistent Terminology

Choose one term and use it throughout:
- Good: Always "delivery", always "feedback", always "annotation"
- Bad: Mix "delivery/result/output", "feedback/response/input"

## Common Patterns

### Template Pattern

Provide templates for output format. Match strictness level to needs.

### Examples Pattern

Input/output pairs help Claude understand desired style better than descriptions alone.

### Conditional Workflow Pattern

Guide Claude through decision points:
```markdown
**Creating new content?** → Follow "Creation workflow"
**Editing existing content?** → Follow "Editing workflow"
```

## Advanced: Skills with Executable Code

### Solve, Don't Punt

Handle error conditions in scripts rather than letting Claude figure them out.

### Provide Utility Scripts

Pre-made scripts are more reliable than generated code, save tokens, save time, ensure consistency.

Make clear whether Claude should:
- **Execute the script**: "Run `analyze_form.py` to extract fields"
- **Read as reference**: "See `analyze_form.py` for the algorithm"

### Package Dependencies

List required packages explicitly. Don't assume installation.

### Create Verifiable Intermediate Outputs

**Plan-validate-execute pattern**: Create plan file → validate with script → execute → verify.

Catches errors early, machine-verifiable, reversible, clear debugging.

## Anti-Patterns to Avoid

- Windows-style paths (always use forward slashes)
- Offering too many options (provide a default with escape hatch)
- Deeply nested references
- Vague descriptions
- Inconsistent terminology
- Time-sensitive information
- Assuming tools/packages are installed
- Magic numbers without justification

## Checklist for Effective Skills

### Core Quality
- [ ] Description is specific and includes key terms
- [ ] Description includes both what and when
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate files
- [ ] No time-sensitive information
- [ ] Consistent terminology
- [ ] Concrete examples
- [ ] File references one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps

### Code and Scripts
- [ ] Scripts solve problems, don't punt to Claude
- [ ] Error handling is explicit and helpful
- [ ] No voodoo constants (all values justified)
- [ ] Required packages listed and verified
- [ ] No Windows-style paths
- [ ] Validation/verification for critical operations
- [ ] Feedback loops for quality-critical tasks

### Testing
- [ ] At least three evaluations created
- [ ] Tested with real usage scenarios
- [ ] Team feedback incorporated

## Applying to Visual Delivery Skill

Key takeaways for our skill:

1. **SKILL.md should be concise** — Don't explain what a web server is. Focus on the steps and I/O.
2. **Use progressive disclosure** — SKILL.md has quick start, `references/` has detailed specs.
3. **Scripts solve, don't punt** — `start.sh` handles all edge cases (environment detection, deps, port conflicts). `await-feedback.sh` handles timeout, jq fallback, error states.
4. **Consistent terminology** — Always: "delivery" (not result/output), "feedback" (not response/input), "annotation" (not comment/note), "blocking" (not waiting/polling).
5. **Feedback loop** — After delivering, the agent can read annotations to iterate.
6. **One-level references** — SKILL.md → references/api.md, SKILL.md → references/feedback-schema.md (never nested).
7. **Third-person description** — "Delivers task results visually..." not "I can deliver..." or "You can use this to...".
8. **Gerund naming** — Consider renaming to `delivering-visually` or keep `visual-delivery` (noun phrase is acceptable).
