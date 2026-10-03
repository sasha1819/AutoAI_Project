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
- [ ] Cancel a running scan: needs a `scan:cancel` channel and an abort through the AiProvider port (port change + ADR). MVP scans are bounded: calls scale with the area count, said before Scan ("Claude compares N requirements"), one scan at a time (SCAN_BUSY), stops on auth / rate-limit errors with no retry, and quitting the app ends it (decided 2026-10-03). Extraction (ADR 0008) keeps this true: its calls are said per file before Scan.
- [ ] Claude subscription login (needs Anthropic approval): Anthropic's Agent SDK docs say third-party developers may not offer claude.ai login or subscription rate limits unless previously approved. MVP is bring-your-own API key only (decided 2026-10-03).
- [ ] Drag PRD files or a folder into Add project (mockup 3's drop card; Electron `webUtils.getPathForFile`, and the dropped path must count as picked); MVP picks folders with the system dialog only (decided 2026-10-03)
- [ ] Bedrock / Vertex / Foundry providers via the AiProvider port (new adapters behind the same port; decided 2026-10-03)
- [ ] AutoAI-managed credits (decided 2026-10-03)
- [ ] .docx PRD input (PRD 4.2) — start with markdown/plain text; docx needs a parser dependency + ADR (decided 2026-09-28)
- [ ] Run Playwright setup projects (auth-dependent test flows). MVP runs only the user's Chromium project, so setup-project dependencies (e.g. a login step) don't run (ADR 0005, decided 2026-09-29).
- [ ] Send the failure screenshot to the diagnosis (PRD Flow 4 step 17 lists it). MVP sends the text page snapshot instead: the AiProvider port is text-only, so images need a port change + ADR, and a screenshot cannot be redacted like text (decided 2026-09-30).

When a new idea appears, `/scope-check` adds it here with a one-line reason.
- Modal `tone="alert"` (role alertdialog, description required) for urgent or destructive confirmations: Radix Dialog's Content accepts a role override, so no new dependency. Deferred from M4 (2026-10-02); today an unmissable step is `dismissible={false}` with role dialog.
