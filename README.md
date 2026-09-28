# AutoAI Claude Code kit (v2 — architecture-enforced)

## Install (5 minutes)
1. Make your project folder (for example `autoai/`) and unzip this kit INTO it. You should see `CLAUDE.md`, `docs/`, `scripts/`, `.dependency-cruiser.cjs` and a hidden `.claude/` folder (Mac: Cmd+Shift+. in Finder).
2. Export the PRD doc as Markdown and save it as `docs/PRD.md` (replace the placeholder).
3. Save screenshots of your design screens into `docs/design/`.
4. `git init`, open in VS Code, open the terminal, run `claude`.
5. Do NOT run `/init` (it can overwrite CLAUDE.md).
6. Type `/build-next`. The first tasks (M0) build the foundation and prove the guardrails work.

## How quality is enforced (not just requested)
| Guard | What it stops | Runs in |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` + skills | tells Claude where code belongs | every task |
| `.dependency-cruiser.cjs` | logic leaking into UI/adapters, features importing each other, circular imports | `npm run deps:check` |
| `scripts/check-design-tokens.mjs` | raw colors/px/inline styles in screens | `npm run tokens:check` |
| TypeScript strict + ESLint + Vitest | unsafe types, untested logic | `npm run verify` |
| `architecture-reviewer` agent | logic in the wrong place, duplicated code, generic naming, missing tests | every loop |
| `design-system-reviewer` agent | design/logic mixing, missing states, accessibility, drift from design | UI tasks |
| `prd-reviewer` agent | scope creep (anything in `docs/LATER.md`) | every loop |
| `.claude/hooks/guard.js` | force push, hard reset, `rm -rf` on home/root | every shell command |

Both checks were tested here with planted violations: 8 of 8 illegal imports and all raw design values were caught, and a clean tree passed.
Note: dependency-cruiser needs TypeScript 5.x. With TypeScript 7 it silently analyses 0 files; the `verifier` agent treats "0 modules" as a failure.

## Commands
`/build-next` (the loop) · `/new-usecase <name>` · `/new-component <Name tier>` · `/scope-check <idea>`

## Growing into the full product
New feature area = new skill folder + new milestone in `BUILD-LOG.md` (move it out of `docs/LATER.md`). The layers do not change:
mobile testing = a new adapter; private model = a new `AiProvider` adapter; security tab = new core rules + service + design-system patterns.

## Honest limits
Skills, agents and rules raise the floor; they do not replace your review. Read the reference slice (first M1 task) carefully: everything after copies it.
`scan-evaluator` uses your Anthropic API key and costs money per run.
