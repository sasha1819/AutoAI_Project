# ADR 0003 — Run TypeScript with Node's built-in type stripping

Status: accepted (user, 2026-09-28)

Context: the CLI (M1) must execute `src/cli/*.ts`. `tsc` is typecheck-only (`noEmit`, `moduleResolution: Bundler`), so nothing runs TypeScript today. Node 24 (our runtime) strips types natively (`node src/cli/main.ts`, no flag, no warning) but, like any Node ESM, only resolves imports that include the file extension. Our three existing core files use extensionless imports.

Options:
1. Node type stripping. Imports end in `.ts` (`import { ok } from "./result.ts"`); tsconfig switches `module`/`moduleResolution` from `ESNext`/`Bundler` to `NodeNext` and adds `allowImportingTsExtensions` and `erasableSyntaxOnly` (no `enum`/`namespace`/parameter properties — we don't use them). `engines` becomes `>=22.18` (first Node with type stripping on by default) and `.nvmrc` pins the dev major (24). No new dependency, no build step; Vitest, dependency-cruiser and the future Electron bundler all accept `.ts` imports.
2. Add `tsx` as a dev dependency and keep extensionless imports. One more tool in the chain (and one more thing for npm/cli#4828 to break).
3. Emit JS with `tsc` (`module: NodeNext`, imports end in `.js`) and run `dist/`. Adds a build step before every CLI run.

Decision: option 1.

Consequences: every relative import in `src/` ends in `.ts`, enforced by `tsc` (verified: under `NodeNext` an extensionless import is TS2835 and an `enum` is TS1294), so the rule cannot drift. Supersedes the BUILD-LOG note that tsc uses `moduleResolution: Bundler`. Adds no dependencies. If a future tool rejects `.ts` specifiers, `tsc --rewriteRelativeImportExtensions` can emit `.js` without touching sources.
