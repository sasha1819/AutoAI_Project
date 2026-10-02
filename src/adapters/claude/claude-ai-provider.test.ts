import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_API_URL,
  createClaudeAiProvider,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
} from "./claude-ai-provider.ts";

// Recorded-shape Messages API responses served through the SDK's injectable fetch: no test reaches the network.
type Sent = { url: string; headers: Headers; body: Record<string, unknown> };

function fakeFetch(...replies: (Response | Error)[]) {
  const sent: Sent[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const body =
      typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    sent.push({ url, headers, body });
    const next = replies.shift();
    if (next === undefined) throw new Error("no more replies scripted");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { fetch, sent };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "request-id": "req_test", ...headers },
  });

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [
    { type: "thinking", thinking: "", signature: "sig" },
    { type: "text", text: '{"findings": []}' },
  ],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 2400,
    output_tokens: 610,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  ...overrides,
});
const apiError = (type: string) => ({
  type: "error",
  error: { type, message: `${type} happened` },
});
const request = { system: "SYSTEM", user: "USER", jsonSchema: { type: "object" } };
const KEY = "sk-ant-test-key-123";

describe("createClaudeAiProvider", () => {
  it("defaults to claude-sonnet-5 at high effort (ADR 0002)", () => {
    expect([DEFAULT_MODEL, DEFAULT_EFFORT, ANTHROPIC_API_URL]).toStrictEqual([
      "claude-sonnet-5",
      "high",
      "https://api.anthropic.com",
    ]);
  });

  it("sends one request straight to api.anthropic.com with the user's key, model, effort and schema", async () => {
    const { fetch, sent } = fakeFetch(json(200, message()));
    const ai = createClaudeAiProvider({ apiKey: KEY, fetch });
    const result = await ai.complete(request);

    expect(result).toStrictEqual({
      ok: true,
      value: {
        text: '{"findings": []}',
        model: "claude-sonnet-5",
        usage: { inputTokens: 2400, outputTokens: 610 },
      },
    });
    expect(sent).toHaveLength(1);
    const [req] = sent;
    expect(req?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(req?.headers.get("x-api-key")).toBe(KEY);
    expect(req?.headers.get("authorization")).toBeNull();
    expect(req?.body).toMatchObject({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: "SYSTEM",
      messages: [{ role: "user", content: "USER" }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: { type: "object" } },
      },
    });
  });

  it("uses the configured model and effort, and omits the format when no schema is asked for", async () => {
    const { fetch, sent } = fakeFetch(json(200, message({ model: "claude-opus-5" })));
    const ai = createClaudeAiProvider({
      apiKey: KEY,
      model: "claude-opus-5",
      effort: "low",
      fetch,
    });
    const result = await ai.complete({ system: "S", user: "U" });
    expect(result.ok && result.value.model).toBe("claude-opus-5");
    expect(sent[0]?.body).toMatchObject({
      model: "claude-opus-5",
      output_config: { effort: "low" },
    });
    expect((sent[0]?.body["output_config"] as Record<string, unknown>)["format"]).toBeUndefined();
  });

  it("ignores ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN from the environment", async () => {
    const saved = {
      url: process.env["ANTHROPIC_BASE_URL"],
      token: process.env["ANTHROPIC_AUTH_TOKEN"],
    };
    process.env["ANTHROPIC_BASE_URL"] = "https://proxy.example.com";
    process.env["ANTHROPIC_AUTH_TOKEN"] = "someone-elses-token";
    try {
      const { fetch, sent } = fakeFetch(json(200, message()));
      await createClaudeAiProvider({ apiKey: KEY, fetch }).complete(request);
      expect(sent[0]?.url).toBe("https://api.anthropic.com/v1/messages");
      expect(sent[0]?.headers.get("authorization")).toBeNull();
    } finally {
      for (const [name, value] of [
        ["ANTHROPIC_BASE_URL", saved.url],
        ["ANTHROPIC_AUTH_TOKEN", saved.token],
      ] as const) {
        if (value === undefined) Reflect.deleteProperty(process.env, name);
        else process.env[name] = value;
      }
    }
  });

  it("joins all text blocks and skips thinking blocks", async () => {
    const { fetch } = fakeFetch(
      json(
        200,
        message({
          content: [
            { type: "text", text: '{"a":' },
            { type: "thinking", thinking: "x", signature: "s" },
            { type: "text", text: "1}" },
          ],
        }),
      ),
    );
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch }).complete(request);
    expect(result.ok && result.value.text).toBe('{"a":1}');
  });

  it("retries a rate limit through the SDK and succeeds", async () => {
    const { fetch, sent } = fakeFetch(
      json(429, apiError("rate_limit_error"), { "retry-after-ms": "0" }),
      json(200, message()),
    );
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch }).complete(request);
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it.each([
    ["an invalid key (401)", json(401, apiError("authentication_error")), "AI_AUTH_FAILED"],
    ["a key without access (403)", json(403, apiError("permission_error")), "AI_AUTH_FAILED"],
    [
      "rate limiting that outlasts the retries (429)",
      json(429, apiError("rate_limit_error")),
      "AI_RATE_LIMITED",
    ],
    ["an unknown model (404)", json(404, apiError("not_found_error")), "AI_MODEL_NOT_FOUND"],
    ["a server error (500)", json(500, apiError("api_error")), "AI_UNAVAILABLE"],
    ["an overloaded API (529)", json(529, apiError("overloaded_error")), "AI_UNAVAILABLE"],
    ["a bad request (400)", json(400, apiError("invalid_request_error")), "AI_BAD_REQUEST"],
    ["a network failure", new TypeError("fetch failed"), "AI_UNAVAILABLE"],
    ["a refusal", json(200, message({ stop_reason: "refusal" })), "AI_REFUSED"],
    [
      "an answer cut off by max_tokens",
      json(200, message({ stop_reason: "max_tokens" })),
      "AI_OUTPUT_TRUNCATED",
    ],
    [
      "an answer cut off by the context window",
      json(200, message({ stop_reason: "model_context_window_exceeded" })),
      "AI_OUTPUT_TRUNCATED",
    ],
  ])("maps %s to %s without leaking the key", async (_name, reply, code) => {
    const { fetch } = fakeFetch(reply);
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch, maxRetries: 0 }).complete(
      request,
    );
    expect(result.ok ? null : result.error.code).toBe(code);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it.each([
    ["an empty key", ""],
    ["a blank key", "   "],
  ])("returns AI_AUTH_FAILED for %s without calling anything", async (_name, apiKey) => {
    const { fetch, sent } = fakeFetch(json(200, message()));
    const result = await createClaudeAiProvider({ apiKey, fetch }).complete(request);
    expect(result.ok ? null : result.error.code).toBe("AI_AUTH_FAILED");
    expect(sent).toHaveLength(0);
  });

  it.each([
    ["a request timeout (408)", () => Promise.resolve(json(408, apiError("timeout_error")))],
    ["a dropped connection", () => Promise.reject(new Error("socket hang up"))],
  ])("maps %s to AI_UNAVAILABLE", async (_name, reply) => {
    const fetch = () => reply();
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch, maxRetries: 0 }).complete(
      request,
    );
    expect(result.ok ? null : result.error.code).toBe("AI_UNAVAILABLE");
  });

  it("maps a request that times out to AI_UNAVAILABLE", async () => {
    const hang = (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const ai = createClaudeAiProvider({ apiKey: KEY, fetch: hang, maxRetries: 0, timeoutMs: 20 });
    const result = await ai.complete(request);
    expect(result.ok ? null : result.error.code).toBe("AI_UNAVAILABLE");
  });

  it("keeps messages free of CLI wording, since the desktop app uses the same adapter", async () => {
    const { fetch } = fakeFetch(json(401, apiError("authentication_error")));
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch, maxRetries: 0 }).complete(
      request,
    );
    expect(result.ok ? "" : result.error.message).not.toMatch(/ANTHROPIC_API_KEY|--model|--effort/);
  });

  it("names the model in the not-found message so the user knows what to change", async () => {
    const { fetch } = fakeFetch(json(404, apiError("not_found_error")));
    const result = await createClaudeAiProvider({
      apiKey: KEY,
      model: "claude-nope",
      fetch,
      maxRetries: 0,
    }).complete(request);
    expect(result.ok ? "" : result.error.message).toMatch(/claude-nope/);
  });
});

describe("verifyAccess", () => {
  const models = {
    data: [
      {
        type: "model",
        id: "claude-sonnet-5",
        display_name: "Claude Sonnet 5",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    has_more: false,
    first_id: "claude-sonnet-5",
    last_id: "claude-sonnet-5",
  };

  it("lists one model with the user's key: proves access and spends no tokens", async () => {
    const { fetch, sent } = fakeFetch(json(200, models));
    const result = await createClaudeAiProvider({ apiKey: KEY, fetch }).verifyAccess();
    expect(result).toEqual({ ok: true, value: undefined });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`${ANTHROPIC_API_URL}/v1/models?limit=1`);
    expect(sent[0]?.headers.get("x-api-key")).toBe(KEY);
  });

  it("a rejected key is AI_AUTH_FAILED", async () => {
    const { fetch } = fakeFetch(json(401, apiError("authentication_error")));
    const result = await createClaudeAiProvider({
      apiKey: KEY,
      fetch,
      maxRetries: 0,
    }).verifyAccess();
    expect(result.ok ? null : result.error.code).toBe("AI_AUTH_FAILED");
  });

  it("no network is AI_UNAVAILABLE", async () => {
    const { fetch } = fakeFetch(new TypeError("fetch failed"));
    const result = await createClaudeAiProvider({
      apiKey: KEY,
      fetch,
      maxRetries: 0,
    }).verifyAccess();
    expect(result.ok ? null : result.error.code).toBe("AI_UNAVAILABLE");
  });

  it("no key at all fails without a request", async () => {
    const result = await createClaudeAiProvider({ apiKey: "  " }).verifyAccess();
    expect(result.ok ? null : result.error.code).toBe("AI_AUTH_FAILED");
  });
});
