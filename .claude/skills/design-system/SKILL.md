---
name: design-system
description: How to build AutoAI's UI so design and logic stay separate and components are reusable — tokens, primitives, patterns, features, states, accessibility, stories. Use for ANY work in src/ui, when creating or changing a component or screen, or when a color, spacing, icon or status display is needed.
---

# Design system skill

Read `docs/ARCHITECTURE.md` section 7. Design screenshots are in `docs/design/`.

## Order for every UI task
1. Look at the design screenshot for the screen. List the distinct visual elements you see.
2. For each element, search `ui/design-system/primitives` and `patterns` first. Reuse if it exists.
3. Missing element used in 2+ places (or clearly generic like a Button) => build it in the design system with a story for every state. Do this BEFORE the screen.
4. Build the screen in `ui/features/<name>/` from patterns/primitives only.

## Tiers (each uses only the ones above it)
`tokens` -> `primitives` -> `patterns` -> `features`

## Component rules
- Props are small and typed. Variants via a `variant`/`size`/`tone` prop, never by copy-pasting a component.
- Status/severity/confidence display exists once: `StatusPill`, `SeverityTag`, `ConfidenceMeter`. They take a DOMAIN value (`"flaky"`) and pick the token. Screens never choose colors.
- Every component defines: default, hover, focus-visible, disabled, loading (if it can load), error (if it can fail), empty (if it lists things).
- Keyboard + screen reader: labels, roles, visible focus. Icon-only buttons need an accessible name.
- Presentational components receive data and callbacks by props. Data fetching lives in ONE hook per feature (`useFindings`), calling the IPC contract.
- No raw colors, px values, or inline `style` in features (`npm run tokens:check`). Tokens are added in `tokens/` with a semantic name (`--color-status-flaky`, not `--yellow-500`).

## Files per component
```
Button/
  Button.tsx        component
  Button.stories.tsx  one story per state
  Button.test.tsx     behavior (click, disabled, keyboard)
  index.ts
```

## Never
Business rules in a component; a feature importing another feature; duplicating a component "just for this screen"; hard-coding text colors for statuses.
