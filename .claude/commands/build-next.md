---
description: Run one full build loop (plan, test-first for logic, build, verify, review, commit) on the next unticked task
argument-hint: [optional: task text to work on instead]
---

Run ONE build loop. Do not start a second task. Quality over speed.

1. **Context.** Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `BUILD-LOG.md`. Task = $ARGUMENTS if given, else the first unticked `- [ ]`.
2. **Scope gate.** Check `docs/PRD.md` (Sections 1, 10) and `docs/LATER.md`. Out of MVP => stop and tell me.
3. **Find before you build.** Load the matching skills (`architecture` always; `design-system` for src/ui; `scan-engine`, `reliability-rules`, `playwright-generation`, `electron-app`, `code-standards` as relevant). Search the codebase for existing functions, ports, components and the reference slice you must follow.
4. **Plan (max 10 lines).** For each new piece: which layer/folder, which existing thing it reuses, how you will test it. If a new port, layer rule, dependency or pattern is needed, STOP and write an ADR proposal for me instead of coding.
5. **Logic first.** For anything in `core`: write the tests first (table-driven), see them fail, then implement.
6. **UI second.** For src/ui: build/extend design-system components with stories first, then the screen.
7. **Verify.** Call `verifier`. If prompts/parsing/rules of the scan logic changed, also call `scan-evaluator`.
8. **Review.** Call `architecture-reviewer`; if src/ui changed also `design-system-reviewer`; then `prd-reviewer`.
9. **Fix loop.** If anything fails or has blockers, fix and repeat 7-8. Max 3 rounds, then stop and explain what blocks.
10. **Finish.** Tick the task in `BUILD-LOG.md`; add a line under "Decisions & notes" for real decisions; commit (Conventional Commit).
11. **Report in 6 lines:** what was done · where the logic lives · what was verified · reuse you found or created · next task · questions for me.
