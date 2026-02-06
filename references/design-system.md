# Design System Reference

## Table of Contents

- [Files](#files)
- [Token Format](#token-format)
- [CSS Variable Mapping](#css-variable-mapping)
- [Customization Workflows](#customization-workflows)
- [Hot-Reload](#hot-reload)

---

## Files

| File | Location | Purpose |
|------|----------|---------|
| `design-spec.md` | `{DATA_DIR}/design/design-spec.md` | Human-readable design specification |
| `tokens.json` | `{DATA_DIR}/design/tokens.json` | Machine-readable design tokens (drives CSS) |

---

## Token Format

```json
{
  "colors": {
    "primary": "#2563EB",
    "primary-hover": "#1D4ED8",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "text": "#1E293B",
    "text-secondary": "#64748B",
    "border": "#E2E8F0",
    "success": "#16A34A",
    "warning": "#F59E0B",
    "danger": "#DC2626",
    "blocking-bg": "#FEF2F2",
    "blocking-border": "#FCA5A5",
    "interactive-bg": "#FFF7ED",
    "interactive-border": "#FDBA74"
  },
  "typography": {
    "font-family": "system font stack",
    "font-family-mono": "monospace stack",
    "font-size-base": "15px",
    "line-height": "1.6"
  },
  "spacing": {
    "page-padding": "24px",
    "card-padding": "16px",
    "border-radius": "8px"
  },
  "components": {
    "blocking-alert": { "animation": "pulse" },
    "code-block": { "theme": "github", "line-numbers": true }
  }
}
```

Required sections: `colors`, `typography`, `spacing`. `components` is optional.

---

## CSS Variable Mapping

Tokens map to CSS custom properties with `--vds-` prefix:

| Token Path | CSS Variable |
|-----------|-------------|
| `colors.primary` | `--vds-colors-primary` |
| `colors.background` | `--vds-colors-background` |
| `typography.font-family` | `--vds-typography-font-family` |
| `spacing.border-radius` | `--vds-spacing-border-radius` |

---

## Customization Workflows

**Quick change** (edit tokens.json directly):
1. Read `{DATA_DIR}/design/tokens.json`
2. Modify values
3. Write back — UI updates instantly via WebSocket

**Design-driven change** (edit design-spec.md, agent applies):
1. Read `{DATA_DIR}/design/design-spec.md` for design intent
2. Update `{DATA_DIR}/design/tokens.json` to match
3. UI updates instantly

---

## Hot-Reload

When `tokens.json` is saved:
1. Server detects change (fs.watch, 200ms debounce)
2. Server validates JSON structure
3. Server broadcasts `design_updated` event via WebSocket
4. Frontend updates CSS variables on `:root`
5. All components re-render instantly (no page reload)

Invalid JSON is silently ignored (last valid tokens kept).
