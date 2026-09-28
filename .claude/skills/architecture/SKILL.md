---
name: architecture
description: The layering rules of AutoAI (pure core, services, ports and adapters, contracts, composition roots) and where every piece of code belongs. Use at the START of every task that adds or changes code in src/, before deciding file locations, when adding a use case, a port, an adapter, an IPC handler or a business rule — even for small changes.
---

# Architecture skill

Read `docs/ARCHITECTURE.md` first. It is the source of truth; this skill is the working checklist.

## Before writing code
1. Find the closest existing example (the reference slice, or a similar use case). Copy its shape. Do not invent a new pattern silently.
2. Say in one sentence where each new piece goes, using the table in ARCHITECTURE.md section 2.
3. If the change needs a new port, a new layer rule or a new dependency: stop and write an ADR (`docs/adr/`) proposal for the user to approve.

## Adding a business rule
- Put it in `core/rules/<rule>.ts` as a pure function. Write the table-driven test first (`<rule>.test.ts`), then the function.
- Inputs and outputs are plain data. Time, ids, randomness come in as arguments.

## Adding a use case (service)
- File `services/<verb-noun>.ts` exporting a function/class that receives ports through its constructor/arguments.
- It orchestrates: read via ports -> call core -> write via ports. It contains no rules of its own.
- Test with in-memory fakes of the ports. Return `Result`, with a typed error `code` for each expected failure.

## Adding an adapter
- Folder `adapters/<tech>/`, implements one port from `core/ports`. Translates tech errors into domain error codes.
- Validate external data with zod at the edge. Add a contract test that any implementation of the port must pass.

## Adding an IPC handler / CLI command
- Thin: validate input with the contract schema -> call one service -> map result. No rules, no loops over domain data.
- Wiring (creating adapters and passing them to services) happens only in `app/main/compose.ts` and `cli/compose.ts`.

## Smells to refuse
`utils.ts`, `helpers.ts`, `any`, a service that reads files itself, a rule inside a React component or IPC handler, an adapter importing another adapter,
`new ClaudeClient()` anywhere except a compose file, business logic in prompts' post-processing outside `core/parsing`.
