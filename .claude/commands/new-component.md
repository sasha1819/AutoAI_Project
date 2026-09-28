---
description: Create a design-system component the standard way (tokens, states, stories, tests)
argument-hint: <ComponentName and tier, e.g. StatusPill pattern>
---

Create "$ARGUMENTS" in the design system.
1. Read `docs/ARCHITECTURE.md` section 7 and the `design-system` skill. Search `ui/design-system` for anything similar; if one exists, extend it instead.
2. Look at the matching element in `docs/design/` and list its states.
3. Add any missing semantic tokens in `tokens/` first.
4. Create `<Name>/<Name>.tsx`, `<Name>.stories.tsx` (one story per state), `<Name>.test.tsx`, `index.ts`.
5. Run `verifier` and `design-system-reviewer`. Report briefly, including where else it should be reused.
