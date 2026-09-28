---
description: Scaffold a new use case the standard way (core rule + service + fake-port test)
argument-hint: <verb-noun, e.g. diagnose-failure>
---

Create use case "$ARGUMENTS" following the reference slice exactly.
1. Read `docs/ARCHITECTURE.md` sections 1-3 and the closest existing service.
2. List (max 6 lines) the rules it needs -> `core/rules`, the parsing -> `core/parsing`, the ports it uses, the error codes it can return.
3. Write tests first: rule tables in core, then a service test with in-memory fake ports covering the happy path and every error code.
4. Implement core, then the service. No adapter/UI work unless asked.
5. Run `verifier` and `architecture-reviewer`. Report briefly.
