# LATER (not in MVP) — do not build without asking

- [ ] Visual drag-and-drop flow canvas
- [ ] Mobile (Appium/Maestro) and desktop targets, cross-browser
- [ ] PR impact screen + GitHub PR comment bot
- [ ] Release Readiness score
- [ ] Full flaky-test workflow (detail screen, quarantine, root cause)
- [ ] AI decision log popovers in the UI (confidence check itself IS in MVP backend)
- [ ] Security testing tab
- [ ] Accessibility testing tab (axe-core)
- [ ] Explore mode
- [ ] Scheduled / CI-triggered runs
- [ ] Full Reports (charts, history, export)
- [ ] Accounts, plans, credits, Stripe/Paddle billing
- [ ] Private/self-hosted models, pluggable AI providers
- [ ] Team features
- [ ] PRD parser: smarter handling of unstructured prose PRDs (likely a future AI-assisted extraction step, not mechanical paragraph splitting). CONFIRMED, not hypothetical (2026-09-28): `docs/PRD.md` itself, a real doc-editor export with numbered lines and no `#` headings or "Area 1.2" tags, yields 0 requirements with the current parser. The fixtures include one requirement in that style so the accuracy test counts the gap.
- [ ] .docx PRD input (PRD 4.2) — start with markdown/plain text; docx needs a parser dependency + ADR (decided 2026-09-28)
- [ ] Run Playwright setup projects (auth-dependent test flows). MVP runs only the user's Chromium project, so setup-project dependencies (e.g. a login step) don't run (ADR 0005, decided 2026-09-29).

When a new idea appears, `/scope-check` adds it here with a one-line reason.
