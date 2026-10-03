import { parseExtractionResponse } from "../../core/parsing/extraction.ts";
import { buildExtractionPrompt } from "../../core/prompts/extraction.ts";
import { describe, expect, it } from "vitest";
import { buildMatchingPrompt } from "../../core/prompts/matching.ts";
import { parseMatchingResponse } from "../../core/parsing/finding.ts";
import { createMockAiProvider, MOCK_KEY_PREFIX } from "./mock-ai-provider.ts";

// Built at runtime: no key-looking literal in the repo.
const mockKey = `${MOCK_KEY_PREFIX}${["dev", "key"].join("-")}`;

describe("createMockAiProvider", () => {
  it("accepts a key in the mock format, and nothing else (rejected the normal way)", async () => {
    expect(await createMockAiProvider({ apiKey: mockKey }).verifyAccess()).toStrictEqual({
      ok: true,
      value: undefined,
    });
    for (const apiKey of ["anything-else", MOCK_KEY_PREFIX, ` ${mockKey}`]) {
      const result = await createMockAiProvider({ apiKey }).verifyAccess();
      expect(result.ok ? null : result.error.code).toBe("AI_AUTH_FAILED");
    }
  });

  it("answers a real matching prompt with findings the real parser accepts, all low-confidence and labelled mock", async () => {
    const requirements = [
      { tag: "Area 1.1", area: "Area", text: "One thing.", source: { file: "a.md", line: 1 } },
      { tag: "Area 1.2", area: "Area", text: "Another thing.", source: { file: "a.md", line: 2 } },
    ];
    const prompt = buildMatchingPrompt({
      requirements,
      files: [],
      omittedFiles: [],
      repoFiles: [],
    });
    const reply = await createMockAiProvider({ apiKey: mockKey }).complete({
      system: prompt.system,
      user: prompt.user,
      jsonSchema: prompt.answerSchema,
    });
    if (!reply.ok) throw new Error(reply.error.message);
    const parsed = parseMatchingResponse(reply.value.text, prompt);
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(parsed.value.map((f) => [f.requirement.tag, f.reviewStatus])).toStrictEqual([
      ["Area 1.1", "needs_review"],
      ["Area 1.2", "needs_review"],
    ]);
    expect(parsed.value.every((f) => f.explanation.startsWith("Mock AI"))).toBe(true);
  });

  it("anything else it cannot answer yet", async () => {
    const reply = await createMockAiProvider({ apiKey: mockKey }).complete({
      system: "s",
      user: "u",
    });
    expect(reply.ok ? null : reply.error.code).toBe("AI_UNAVAILABLE");
  });

  it("answers an extraction prompt with one quoted item to compare and one to review, both verifiable", async () => {
    const prompt = buildExtractionPrompt({
      path: "vision.md",
      text: "Vision\n\nShoppers can apply a discount code at checkout.\nOrders over fifty euros ship for free.",
    });
    const ai = createMockAiProvider({ apiKey: mockKey });
    const reply = await ai.complete({
      system: prompt.system,
      user: prompt.user,
      jsonSchema: prompt.answerSchema,
    });
    if (!reply.ok) throw new Error(reply.error.message);
    const parsed = parseExtractionResponse(reply.value.text, prompt);
    expect(
      parsed.ok && [
        parsed.value.requirements.length,
        parsed.value.needsReview.length,
        parsed.value.dropped,
      ],
    ).toStrictEqual([1, 1, 0]);
  });
});
