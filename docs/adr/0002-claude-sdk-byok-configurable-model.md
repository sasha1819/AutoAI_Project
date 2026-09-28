# ADR 0002 — Claude access: official SDK, bring-your-own-key, configurable model

Status: accepted (user, 2026-09-28)

## Context
The scan engine now has a matching prompt and a parser (`core/prompts/matching.ts`, `core/parsing/finding.ts`) but nothing that calls Claude. The PRD fixes the frame: BYOK only, the user's key goes "directly from the user's machine to api.anthropic.com", no orchestration framework, no AutoAI-managed billing. ARCHITECTURE §3 already names the port (`AiProvider`) and the adapter folder (`adapters/claude`).

## Decision

1. **Dependency.** Add `@anthropic-ai/sdk` (exact pin, currently 0.129.0) as the only way AutoAI talks to Claude. It is imported only in `src/adapters/claude/`; a new deps rule (`only-claude-adapter-uses-anthropic-sdk`) fails the build if anything else imports it, with a `deps:selftest` case. No raw `fetch` to the API, no OpenAI-compatible shims.

2. **Bring your own key, straight to Anthropic.**
   - The adapter receives the API key as a constructor argument; it never looks for credentials itself. The CLI reads it from `ANTHROPIC_API_KEY`; the desktop app (M5) will read it from the OS keychain via Electron `safeStorage` and pass it the same way.
   - `baseURL` is pinned to `https://api.anthropic.com`, so an inherited `ANTHROPIC_BASE_URL` cannot silently route the user's code snippets somewhere else.
   - No AutoAI server, proxy or telemetry sits in between. The key is never logged, never written to disk by AutoAI, and never included in error messages.

3. **Model is configuration, with a cheaper default.**
   - Default `claude-sonnet-5` ($2 input / $10 output per million tokens). It supports what the adapter needs: structured outputs and adaptive thinking.
   - Override per run with `--model <id>` or `AUTOAI_MODEL`; later in Settings > AI & models (M6). Any model id is accepted; an unknown one fails with `AI_MODEL_NOT_FOUND` (not validated against a list, because new models ship).
   - `DEFAULT_MODEL` lives in `adapters/claude` (a technology default, not a business rule). The model actually used is reported with every result.
   - Cost at the default: a matching prompt is ~2.5k tokens for the fixture and at most ~18k tokens in the worst case (see BUILD-LOG), so roughly $0.01–$0.06 input per prompt, plus output of about 1–2k tokens (≈ $0.01–$0.02).

4. **Request shape.** One non-streaming `messages.create` per matching prompt: `system` + one user message from `buildMatchingPrompt`, `max_tokens` 16000.
   - Adaptive thinking, with effort configurable (default `high`, because judging spec-vs-code is exactly the reasoning the product sells). `--effort low|medium|high` lets a user trade accuracy for cost.
   - Structured outputs (`output_config.format`, JSON schema of the answer), so the reply is always well-formed JSON. `core/parsing/finding.ts` stays the gate that decides validity (confidence range, requirement ids, evidence).
   - Prompt caching is not used: the fixed system prompt (~500 tokens) is below the minimum cacheable size. Revisit if it grows.

5. **Failures become domain error codes** (ARCHITECTURE §5):
   - `AI_AUTH_FAILED` (401/403)
   - `AI_RATE_LIMITED` (429 after retries)
   - `AI_UNAVAILABLE` (5xx, overloaded, connection or timeout)
   - `AI_MODEL_NOT_FOUND` (404)
   - `AI_BAD_REQUEST` (other 4xx)
   - `AI_REFUSED` (`stop_reason: "refusal"`)
   - `AI_OUTPUT_TRUNCATED` (`stop_reason: "max_tokens"`)

   Retries and back-off are the SDK's (2 retries, honours `retry-after`); the adapter adds no loop of its own. The SDK's typed error classes are matched most-specific-first; messages are never string-matched.

6. **Token accounting.** Every call returns `usage` (input and output tokens) and the model. The scan service sums them and the CLI prints the total with an approximate cost.

7. **Testing never calls the live API.** Adapter tests inject recorded HTTP responses through the SDK's custom `fetch` option (to be confirmed against the installed package when building). The recordings go in `fixtures/recorded/claude/`. Real recordings are captured by a separate opt-in command that needs `ANTHROPIC_API_KEY` and is never part of `verify`. `scan-evaluator` stays the only routine live run: manual, and it costs money.

## Consequences
- One new runtime dependency. It goes through `lock:check`, and the npm lockfile bug is handled as before.
- Users control their spend: a cheap default, with more capable models one flag away.
- The desktop app's keychain flow plugs into the same constructor argument; nothing in core or services knows where the key came from.
- Changing providers later (LATER.md: pluggable or private models) means another `AiProvider` adapter, not a core change.
