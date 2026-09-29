AutoAI MVP — Product & Technical PRD
Sep 27, 2026 · @sasha
This PRD scopes a solo-buildable AutoAI MVP: a web-only desktop app that scans a repo and its PRDs, finds spec-vs-code mismatches, generates and runs Playwright tests, and explains failures with AI — deferring mobile/desktop targets, the visual flow builder, billing, and the advanced testing pillars (security, accessibility, explore mode, scheduling) to post-MVP.

1. MVP scope
   One platform (web), one core loop: scan a repo and its PRDs, find spec-vs-code mismatches, generate and run Playwright tests, explain failures. No mobile/desktop targets, no visual flow builder, no billing system, no team features in v1.
   Area
   In MVP
   Deferred to post-MVP
   Test target
   Web (Chromium via Playwright)
   Mobile (Appium/Maestro), desktop, cross-browser
   Test authoring
   AI-generated from PRD + repo scan; simple step list view
   Visual drag-and-drop flow canvas
   Core differentiator
   Spec vs. code findings (PRD vs. repo mismatches)
   PR impact comments, Release Readiness score
   Reliability
   Basic retry-on-fail + flaky flag
   Full flaky-test workflow, confidence popovers and decision log in the UI (the confidence check/threshold itself IS in MVP)
   Extra test types
   None
   Security, accessibility, explore mode
   Scheduling
   Manual run only
   Scheduled/CI-triggered runs
   Accounts & billing
   None (manual distribution to first users)
   Full plan/credits system, Stripe/Paddle
   AI model
   BYOK (user's own Claude API key)
   AutoAI-managed credits, private/self-hosted models
   Storage
   Local (SQLite) + test files as plain Playwright code in the user's repo
   Cloud workspace for team dashboards
   Success criterion for MVP: a solo QA engineer can point AutoAI at a real repo + PRD folder, get a short list of genuine spec/code mismatches and a handful of working generated tests, run them, and understand any failure without leaving the app.
2. Architecture
   The scan engine is the only component that talks to both the local repo and the Claude API, and it's the piece with the real product risk — build and validate it before the UI. The UI never touches Claude directly; it calls the scan engine and the test runner, and reads results from the local store. Tests are written to disk as plain Playwright files inside the user's own repo, so they commit and diff like any other code — AutoAI's local store only holds run history and cached findings, never the tests themselves.
   Data flow, step by step:
3. UI tells the scan engine which repo path and PRD folder to use.
4. Scan engine reads the repo locally (file tree, key routes/components, relevant source) and parses the PRDs.
5. Scan engine sends the extracted repo context + PRD text to the Claude API (the user's own key) and asks for: (a) a requirement list, (b) spec-vs-code mismatches, (c) suggested test cases as Playwright code.
6. Scan engine writes generated .spec.ts files into the repo and caches findings/requirements in the local store.
7. UI reads the local store to render Setup's "wow" summary and the Spec vs. Code findings list.
8. When the user runs a test, the UI hands the test runner a file path; the runner drives Chromium via Playwright and streams step-by-step results back to the UI in real time.
9. On failure, the runner sends the failure context (step, error, screenshot) to Claude for a plain-language diagnosis, shown in the results view.
10. Flow 1 — Onboarding
    Screens: Welcome → Connect AI → Add project (repo + PRD scan), ending on the "wow" summary.
    Step
    Screen
    What it does
    Logic
    1
    Welcome
    Static intro, "Get started" button
    No logic
    2
    Connect AI
    User pastes a Claude API key
    Validate the key with a lightweight test call; store it locally (OS keychain, not plain text); block Continue until valid
    3
    Add project
    User points to a local repo folder and drags in PRD files (or connects Google Docs/Notion — stretch, MVP = local files only)
    "Scan repository" triggers the scan engine (Architecture, step 1–2); show a live status list (env detected, Playwright installed?)
    4
    Scan running
    Progress state
    Scan engine streams progress events (files read, PRDs parsed, requirements extracted) to the UI
    5
    Wow summary
    "Found 41 requirements, 34 testable, 3 mismatches" + suggested first test cases
    Reads the scan engine's output from the local store; two exits: "Review mismatches" → Spec vs. Code screen, "Generate first tests" → Test workspace with 3 tests pre-selected
    Edge cases to design for: repo has no detectable PRDs (skip mismatches, still generate tests from code alone); PRDs reference features not found in the repo (flag as "requirement not yet implemented", don't treat as a mismatch); invalid/expired API key (clear inline error, no silent retry loop).
11. Flow 2 — Scan engine
    This is the component with the real product risk, so it's worth building and testing it stand-alone (CLI, no UI) before touching Electron.
    4.1 Repo parser — not full static analysis. For MVP, extract just enough for the LLM to reason about: file tree, package.json/framework detection (React, Next.js, Express, etc.), route definitions, and the source of files that look relevant to a requirement (matched by filename/keyword heuristics, e.g. discount → cart/discounts.ts). Send relevant file contents, not the whole repo, to stay inside context limits and control API cost.
    4.2 PRD parser — accepts markdown/plain text/docx. Splits into requirement units (heading + body, or explicit numbered items like "Cart 2.4"). No AI needed for this step, it's plain parsing.
    4.3 Matching logic (the core differentiator) — for each requirement: (a) ask Claude to identify which code paths implement it, using the repo summary; (b) ask Claude to compare what the code does against the requirement text; (c) classify as Match / Mismatch / Not implemented, with a severity (High/Medium/Low) and a one-line explanation citing the file. Store each result as a finding record.
    4.4 Test generation — for requirements classified as Match or where a test is feasible, ask Claude to output a Playwright test (TypeScript) that exercises that requirement through the UI. Write it to /tests/autoai/<slug>.spec.ts in the user's repo. Lint/typecheck the generated file before showing it as "ready" — a generated test that doesn't compile is worse than no test.
    Reliability guardrail: every AI classification carries a confidence value; below a threshold (e.g. 70%), mark the finding "needs review" instead of asserting it as fact — this is what keeps the tool honest and avoids false positives, per your requirement that decisions aren't blindly LLM-driven.
12. Flow 3 — Test workspace
    MVP simplifies your designed "visual flow" canvas to a step list view (still present in the design as an alternate tab, so it's not a new screen to design — just the primary one for v1).
    Step
    UI element
    What it does
    Logic
    1
    Test case sidebar
    Lists all .spec.ts files under /tests/autoai/, grouped by requirement area (Cart, Checkout, …)
    Reads the local store's cached test metadata; a file watcher keeps it in sync if the user edits a test manually
    2
    "+ Describe a new test case"
    Free-text box, e.g. "apply an expired discount code"
    Sends the description + relevant repo context to Claude, generates a new .spec.ts file the same way as onboarding's batch generation
    3
    Step list (main panel)
    Shows the test's steps in plain language, derived from the Playwright code
    Parse the .spec.ts file's Playwright calls (page.click, page.fill, assertions) into readable step descriptions — deterministic parsing, not an AI call, so it stays fast and exact
    4
    Run button
    Runs the selected test
    Hands the file to the test runner (Flow 4)
    5
    Code tab
    Read-only view of the actual Playwright file
    Direct file read, syntax highlighted; "Export" just copies/reveals the file, since it already lives in the repo
    Connection to Flow 2: every test case here traces back to a requirement id from the scan (shown as a small tag). Tests with no requirement tag are user-authored or freeform — both are fine, but keep the distinction visible so coverage numbers stay honest.
13. Flow 4 — Run results & AI diagnosis
    Step
    What happens
    Logic
14. Run starts
    Test runner spawns Playwright against the target URL
    Each Playwright action emits a step event (name, status, duration) streamed to the UI live, matching your designed run log
15. Step fails
    Runner captures a screenshot + the DOM state + the error at the point of failure
    Deterministic — no AI yet, just data capture
16. Retry (reliability guardrail)
    Runner automatically retries the whole failed test once, under the same conditions (Playwright reruns tests, not individual steps, since a test's state can't cleanly reset mid-run)
    If the retry passes → mark the test flaky, not failed, and log both outcomes; if it fails again → real failure
17. AI diagnosis
    On a confirmed failure, send the failure context (step description, error, screenshot, relevant source snippet) to Claude
    Ask for: plain-language explanation of what went wrong, and (when applicable) a suggested fix to the test itself — same shape as your "Update this step" design
18. Report
    Pass/fail/flaky counts roll up into a simple Reports view
    For MVP: totals + the requirement coverage number from Flow 2 ("34/41 requirements testable"). Defer the full charts/history/export from your design
    Why the retry-before-AI order matters: it's what prevents false positives from becoming the product's first impression — a flaky network blip should never get reported to the user as "a bug," and Claude should only ever explain failures that survived a retry.
19. Settings — AI & models
    MVP is BYOK only — no credits system, no AutoAI-managed billing, matching the scope cut in Section 1.
    • User pastes a Claude API key on the Connect screen (onboarding) or in Settings → AI & models.
    • Key is stored locally via the OS keychain (keytar or Electron's safeStorage), never sent anywhere but directly from the user's machine to api.anthropic.com.
    • A small status row shows "Connected" with the last-used model, and a "Test connection" button that makes one cheap call to confirm the key works.
    • No credit tracking needed for MVP; usage and cost are the user's own concern via their Anthropic account. A simple local counter ("~120 AI calls this session") is a nice-to-have for the user's own cost awareness, not a gate.
    • Private/self-hosted model support (the Enterprise privacy story from the design) is explicitly deferred — it needs a pluggable model-provider interface that isn't worth building until there's a paying customer who needs it.
20. Data model
    All of this lives in a local SQLite file per project — no server, no accounts, for MVP.
    Entity
    Key fields
    Relates to
    Project
    id, repo path, PRD folder path, created_at
    has many Requirements, TestCases, Runs
    Requirement
    id, project_id, area (Cart/Checkout/…), req_tag ("Cart 2.4"), text, source_prd_file
    belongs to Project; has one Finding; has many TestCases
    Finding
    id, requirement_id, type (Match/Mismatch/NotImplemented), severity, prd_text, code_text, source_file, confidence
    belongs to Requirement
    TestCase
    id, project_id, requirement_id (nullable), file_path, title, target (web, fixed for MVP)
    belongs to Project, optionally to Requirement; has many Runs
    Run
    id, test_case_id, status (not_run/passed/failed/flaky), started_at, duration
    belongs to TestCase; has many Steps
    Step
    id, run_id, description, status, duration, screenshot_path, error_text
    belongs to Run
    Diagnosis
    id, step_id, explanation, suggested_fix
    belongs to a failed Step
    This is intentionally small. Everything in your fuller design (schedules, team members, billing, security/accessibility findings) adds its own tables later without touching this core — Project, Requirement, Finding, TestCase, Run stay the spine of the product.
21. Tech stack & build notes
    Layer
    Choice
    Why
    Desktop shell
    Electron
    Largest ecosystem and most tutorials/answers — best for a solo build over Tauri's smaller Rust community
    UI
    React + Tailwind
    Matches the design system already built; fast to implement against your existing screens
    Automation engine
    Playwright (Node)
    Industry standard, generates readable TS, has trace viewer/codegen you can reuse
    Local DB
    SQLite (via better-sqlite3)
    Zero-config, file-based, matches the local-first/privacy story
    AI
    Claude API, direct HTTPS calls with the user's key
    No orchestration framework needed at this scale — structured prompts + tool use is enough
    Secrets
    Electron safeStorage or keytar
    OS-level key storage, not a config file
    Recommended build order (no calendar, just dependency order):
22. Scan engine as a standalone Node CLI — point it at a test repo + PRD folder, get requirements + findings + generated tests as console/file output. Validate this works on 2–3 real-ish repos before touching UI; it's the one part with real uncertainty.
23. Wrap the scan engine's output in a minimal Electron shell: Setup screen + the wow summary + Spec vs. Code list.
24. Add the test workspace (step list) + Run button wired to Playwright, with the run log streaming live.
25. Add failure diagnosis (the AI call on a confirmed failure).
26. Add the simple Reports rollup.
27. Everything else from your fuller design, prioritized by what your first 3–5 real users ask for.
28. Deferred for post-MVP
    All designed and worth building — just not before the core loop is proven with real users.
    [ ] Visual drag-and-drop flow canvas (replaces the step list as the primary editor)
    [ ] Mobile (Appium/Maestro) and desktop test targets
    [ ] PR impact screen + GitHub PR bot comment
    [ ] Release Readiness score
    [ ] Full flaky-test workflow (dedicated detail screen, quarantine, root-cause pattern detection)
    [ ] AI decision log / confidence popovers in the UI — the confidence check/threshold itself IS in MVP (see Section 4's reliability guardrail; implemented in core/rules/confidence.ts). Only the visible popover UI showing that log to the user is deferred.
    [ ] Security testing tab (access control, exposed data, headers, input validation)
    [ ] Accessibility testing tab (axe-core scan per run)
    [ ] Explore mode (autonomous crawling)
    [ ] Scheduled/CI-triggered runs
    [ ] Full Reports (charts, history, export)
    [ ] Accounts, plans, credits, Stripe/Paddle billing
    [ ] Private/self-hosted model support, pluggable AI providers
    [ ] Team features (shared workspace, invites, roles)
    Revisit this list after the first 3–5 real users have used the MVP — let their actual requests reorder it rather than guessing.
