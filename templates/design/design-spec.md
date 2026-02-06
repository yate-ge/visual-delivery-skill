# Visual Delivery - Design Specification

This document describes the visual design language for your Visual Delivery
interface. Edit this file to express your design preferences, then ask the
agent to update the design tokens accordingly.

You can also edit `tokens.json` directly for immediate changes.

## Brand

- **Name**: Visual Delivery
- **Personality**: Clean, professional, focused
- **Primary color**: Blue (#2563EB) — conveys trust and clarity

## Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary action | Blue | #2563EB |
| Primary hover | Dark blue | #1D4ED8 |
| Background | White | #FFFFFF |
| Surface (cards) | Light gray | #F8FAFC |
| Primary text | Dark slate | #1E293B |
| Secondary text | Slate | #64748B |
| Borders | Light slate | #E2E8F0 |
| Success | Green | #16A34A |
| Warning | Amber | #F59E0B |
| Danger / Blocking | Red | #DC2626 |
| Blocking background | Light red | #FEF2F2 |
| Blocking border | Light coral | #FCA5A5 |
| Interactive background | Light orange | #FFF7ED |
| Interactive border | Light amber | #FDBA74 |

## Typography

- **Body font**: System font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
  - Rationale: Native feel, fast loading, no web font dependency
- **Code font**: 'SF Mono', 'Fira Code', monospace
- **Base size**: 15px — slightly larger than default for readability
- **Line height**: 1.6 — generous for comfortable reading

## Spacing

- **Page padding**: 24px
- **Card padding**: 16px
- **Border radius**: 8px — slightly rounded, modern feel

## Component Guidelines

### Blocking Alert
- Background: danger color at low opacity
- Animation: gentle pulse to draw attention without being jarring
- Position: fixed top bar, above all content

### Code Blocks
- Theme: GitHub-style light theme
- Line numbers: enabled
- Font: monospace stack

### Delivery Cards
- Subtle border, elevated on hover
- Status badge: color-coded by mode
- Timestamp: relative format ("2 min ago")

## Accessibility

- Maintain WCAG 2.1 AA contrast ratios
- All interactive elements must have focus indicators
- Color is not the sole indicator of status (use icons + text)
