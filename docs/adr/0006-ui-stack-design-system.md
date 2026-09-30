# ADR 0006 — UI stack for the design system (M4)

Status: accepted (user, 2026-09-30)

## Context
M4 builds the design system before any screen (ARCHITECTURE §7): tokens, then primitives, then patterns, each with a Storybook story per state and a behaviour test. `src/ui` is empty and no UI dependency is installed. CLAUDE.md's stack names React, Tailwind and Storybook; this ADR pins how they are used, plus the few libraries the primitives need. Electron itself (main process, preload, packaging) is M5 and gets its own ADR.

## Decision

### 1. React 19 + TypeScript (`.tsx`), only in `src/ui`
- `tsconfig` gains `jsx: "react-jsx"` for `src/ui`. The core-only typecheck stays JSX-free and React-free.
- A new deps rule allows `react`, `react-dom` and the libraries below only in `src/ui` (and later the Electron renderer entry), with a deps-selftest case.

### 2. Tokens: CSS variables, with a Tailwind v4 theme on top
- `ui/design-system/tokens/theme.css` is the only file with raw values. It sets semantic raw variables (`--tk-*`: surfaces, text, accent, AI, status, borders), dark theme first under `:root, [data-theme="dark"]`. A light theme is later just a second block (the Settings mockup shows Dark/Light/System).
- Tailwind v4's `@theme` maps those variables to utility names (`bg-surface`, `text-status-warning`, `rounded-card`, `text-md`, a 4px spacing grid). Components use utilities only, never raw values. `tokens:check` refuses arbitrary values (`w-[13px]`, `bg-[#…]`) except token variables.
- Colours are taken from the screenshots by sampling pixels (exact values, recorded in the tokens file with the screen they came from), then given semantic names.

### 3. Accessible behaviour from Radix UI primitives (unstyled), for the hard widgets only
- Tooltip, Popover, Modal (Dialog), Select, Tabs, Switch and Checkbox wrap `@radix-ui/react-*`. They give focus trapping, keyboard support, ARIA roles and positioning; our components only style them.
- Button, IconButton, Input, Badge, Card, ProgressBar, Table, Spinner, EmptyState, CodeBlock, Toast and Icon are plain React.
- Only design-system code may import Radix; features must use our primitives (new deps rule + selftest case).
- Rejected: hand-rolling focus traps and popover positioning, which is easy to get subtly wrong for keyboard and screen-reader users. React Aria was also considered: it is equally good but heavier, and Radix matches the "unstyled, style it yourself" shape of the tokens.

### 4. Icons: `lucide-react`, behind one `Icon` primitive
- The mockups use Lucide-style line icons. `Icon` takes a name from a closed list (`name="play"`), so features never import icon packages directly (deps rule).

### 5. Fonts bundled locally, never fetched
- An Electron app loads no remote content (electron-app skill), so fonts come from `@fontsource/*` packages as local files: a sans (Inter, matching the mockups) and a mono for tags, ids and timings (JetBrains Mono).

### 6. Storybook 9 with the React + Vite builder
- `npm run storybook` (dev) and `npm run build-storybook`. Addons: a11y (axe checks on every story) and themes (dark/light switch later).
- Every component folder holds `X.tsx`, `X.stories.tsx` (one story per state), `X.test.tsx` and `index.ts`.
- A new check, `npm run stories:check`, fails when a component folder lacks its stories or test file. It is added to `verify`, ARCHITECTURE §8 and the verifier, with a self-test in the same style as `deps:selftest`.

### 7. Component tests: Vitest + Testing Library in jsdom
- `@testing-library/react`, `@testing-library/user-event` and `jsdom`, run by the existing Vitest.
- `src/ui/**/*.test.tsx` uses the jsdom environment; everything else stays in node.
- Tests check behaviour (click, disabled, keyboard, labels), not pixels.

### 8. Generic by construction
The mockups show a demo "shop-web" project. Components take their data by props, typed from `core/domain` (`Finding`, `Requirement`, `RunStatus`, `StepEvent`, `Diagnosis`, …) or plain strings. No component contains sample text. Stories use neutral fixture data that is visibly generic (e.g. "Area 1.2", "Example step"), and the design-system-reviewer checks for leaked demo content.

## Dependencies (exact pins, as with every other dependency)
Runtime: `react`, `react-dom`, `@radix-ui/react-{tooltip,popover,dialog,select,tabs,switch,checkbox}`, `lucide-react`, `@fontsource/inter`, `@fontsource/jetbrains-mono`.
Dev: `tailwindcss`, `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`, `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-themes`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@types/react`, `@types/react-dom`.
Tailwind v4 and Vite pull in native binaries (lightningcss, rolldown). This is the npm/cli#4828 case `lock:check` exists for, so the install uses the clean reinstall recorded in BUILD-LOG, and `lock:check` must stay green.

## Clarification (2026-09-30, at install)
- Storybook is 10.6, the current major. The ADR was written against 9; the React + Vite builder and the a11y and themes addons are the same.
- Token names as built (section 2 above uses them): raw values are `--tk-*` per theme; Tailwind names are `--color-status-{passed,failed,warning,running,neutral}` (+ `-surface`), `--color-accent*` for the primary action and `--color-ai-*` for AI, `--text-{xs..display}`, `--radius-{tag,control,card,full}`, and a 4px `--spacing` grid. "Flaky" uses `status-warning`, as ARCHITECTURE §7 pairs yellow with flaky/warning; StatusPill maps the domain value `flaky` to it.
- tokens:check refuses any arbitrary value that is not a token variable, arbitrary properties and stylesheets outside tokens, and has a self-test (`tokens:selftest`).

## Consequences
- The UI can be developed and reviewed in Storybook before Electron exists (M5).
- `verify` gains `stories:check`. The test run gains a jsdom environment for `src/ui`.
- A few MB of dev dependencies. No network access at runtime (fonts are local).
- Visual fidelity is checked by the design-system-reviewer against `docs/design/`, not by screenshot tests. Visual regression testing is out of scope for MVP.
