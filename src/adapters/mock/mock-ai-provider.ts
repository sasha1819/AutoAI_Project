import { err, ok } from "../../core/domain/result.ts";
import { AI_KEY_REJECTED_MESSAGE, type AiProvider } from "../../core/ports/ai-provider.ts";

/**
 * The prefix of a key mock mode accepts. Assembled at runtime, never written out as a key, so nothing in the repo
 * looks like a credential to secret scanners.
 */
export const MOCK_KEY_PREFIX = ["mock", ""].join("-");

const MODEL = "mock-ai";
const NOTE = "Mock AI: no real analysis was done (AUTOAI_MOCK_AI=1, development only).";

/**
 * A stand-in AiProvider for development without a real key (dev-only; wired only by the app's composition root).
 * A key passes the check when it starts with MOCK_KEY_PREFIX; any other key is rejected exactly as a real one.
 * It answers a scan's matching prompt with low-confidence "match" findings, so every one is marked needs_review and
 * says it is mock. It answers an extraction prompt (ADR 0008) by quoting the PRD's first two long lines: the first
 * confidently (compared), the second not (needs review), so both paths can be tried. Anything else it cannot answer.
 */
export function createMockAiProvider(options: { readonly apiKey: string }): AiProvider {
  const accepted =
    options.apiKey.startsWith(MOCK_KEY_PREFIX) && options.apiKey.length > MOCK_KEY_PREFIX.length;
  const rejected = err({
    code: "AI_AUTH_FAILED" as const,
    message: AI_KEY_REJECTED_MESSAGE,
  });
  return {
    verifyAccess: () => Promise.resolve(accepted ? ok(undefined) : rejected),
    complete: (request) => {
      if (!accepted) return Promise.resolve(rejected);
      const properties = request.jsonSchema?.["properties"];
      const asks = (key: string) =>
        typeof properties === "object" && properties !== null && key in properties;
      if (asks("requirements")) return Promise.resolve(ok(answer(mockExtraction(request.user))));
      if (!asks("findings")) {
        return Promise.resolve(
          err({
            code: "AI_UNAVAILABLE" as const,
            message: "Mock AI mode can't answer this kind of request yet.",
          }),
        );
      }
      const ids = [...request.user.matchAll(/<requirement id="(R\d+)"/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      );
      const findings = ids.map((requirement) => ({
        requirement,
        type: "match",
        severity: null,
        explanation: NOTE,
        evidence: null,
        confidence: 0.5,
      }));
      return Promise.resolve(ok(answer({ findings })));
    },
  };
}

function answer(body: unknown) {
  return { text: JSON.stringify(body), model: MODEL, usage: { inputTokens: 0, outputTokens: 0 } };
}

// The PRD's numbered lines as the extraction prompt shows them ("   3 | text"); long ones make useful quotes.
function mockExtraction(user: string) {
  const lines = [...user.matchAll(/^\s*(\d+) \| (.{20,})$/gm)].slice(0, 2);
  return {
    requirements: lines.map((m, i) => {
      const line = Number(m[1]);
      const snippet = (m[2] ?? "").trim();
      return {
        area: "Mock",
        text: `Mock AI found: ${snippet}`,
        quote: { lines: [line, line], snippet },
        confidence: i === 0 ? 0.8 : 0.5,
      };
    }),
  };
}
