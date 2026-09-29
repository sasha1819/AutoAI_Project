import { describe, expect, it } from "vitest";
import { Confidence, type Finding } from "../core/domain/finding.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import type { AiError } from "../core/ports/ai-provider.ts";
import { PLAYWRIGHT_NOTICE } from "../core/rules/generated-test.ts";
import { generateTests } from "./generate-tests.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";
import { inMemoryTestWriter } from "./testing/in-memory-test-writer.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";
import { scriptedSpecChecker } from "./testing/scripted-spec-checker.ts";

const req = (tag: string, text: string, line: number): Requirement => ({
  tag,
  area: tag.split(" ")[0] ?? tag,
  text,
  source: { file: "shop.md", line },
});
const cart11 = req("Cart 1.1", "Adding the same product raises its quantity.", 7);
const cart12 = req("Cart 1.2", "Discount codes are case-insensitive.", 9);
const account = req("Account 3.1", "Order history page.", 19);
const finding = (requirement: Requirement, over: Partial<Finding> = {}): Finding => ({
  requirement,
  type: "match",
  severity: null,
  explanation: `${requirement.tag} explained.`,
  evidence: null,
  confidence: Confidence.parse(0.9),
  reviewStatus: "confirmed",
  reviewReasons: [],
  ...over,
});
const notImplemented = finding(account, { type: "not_implemented", severity: "medium" });
const findings: Finding[] = [
  finding(cart11),
  finding(cart12, { type: "mismatch", severity: "medium" }),
  notImplemented,
  finding(req("Cart 1.3", "Empty cart message.", 11), {
    reviewStatus: "needs_review",
    reviewReasons: ["LOW_CONFIDENCE"],
  }),
];

const repo = {
  "package.json": JSON.stringify({ devDependencies: { "@playwright/test": "^1.63.0" } }),
  "index.html": '<label for="discount-code">Discount code</label><button>Add to cart</button>',
  "src/cart/cart.js": "export function addItem(cart, product) { line.quantity += 1; }",
  "src/cart/discounts.js":
    "const codes = new Map(); export function findDiscount(input) { return codes.get(input); }",
};
const NAME_11 = "cart-1-1-adding-the-same-product-raises.spec.ts";
const NAME_12 = "cart-1-2-discount-codes-are-case-insensitive.spec.ts";

const spec = (tag: string, body = '  await expect(page.getByRole("status")).toBeVisible();') =>
  [
    `// AutoAI requirement: ${tag}`,
    'import { expect, test } from "@playwright/test";',
    `test("${tag} works", async ({ page }) => {`,
    '  await page.goto("/");',
    body,
    "});",
  ].join("\n");
const answer = (tag: string, code = spec(tag)) => JSON.stringify({ title: `${tag} works`, code });

function setup(
  ai: ReturnType<typeof scriptedAiProvider>,
  opts: {
    files?: Record<string, string>;
    existing?: string[];
    checker?: ReturnType<typeof scriptedSpecChecker>;
  } = {},
) {
  const writer = inMemoryTestWriter(opts.existing);
  const checker = opts.checker ?? scriptedSpecChecker();
  const deps = {
    repoReader: inMemoryRepoReader({ repo: { ...repo, ...opts.files } }),
    testWriter: writer,
    specChecker: checker,
    aiProvider: ai,
  };
  return { deps, writer, checker, run: () => generateTests(deps, { repoRoot: "repo", findings }) };
}
const outcome = (r: Awaited<ReturnType<typeof generateTests>>) => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("generateTests", () => {
  it("writes a checked test for each confirmed match and mismatch, and nothing for the rest", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.2"));
    const { writer, checker, run } = setup(ai);
    const result = outcome(await run());

    expect(result.tests.map((t) => [t.requirement.tag, t.status, t.path])).toStrictEqual([
      ["Cart 1.1", "written", `tests/autoai/${NAME_11}`],
      ["Cart 1.2", "written", `tests/autoai/${NAME_12}`],
    ]);
    expect(result.skippedFindings).toBe(2);
    expect([...writer.written.keys()]).toStrictEqual([
      `tests/autoai/${NAME_11}`,
      `tests/autoai/${NAME_12}`,
    ]);
    expect(checker.checked).toStrictEqual([spec("Cart 1.1"), spec("Cart 1.2")]);
    expect(ai.requests[1]?.user).toContain(
      '<finding type="mismatch">Cart 1.2 explained.</finding>',
    );
    expect(ai.requests[1]?.user).toContain('<file path="src/cart/discounts.js">');
    expect(ai.requests[0]?.jsonSchema).toMatchObject({ required: ["title", "code"] });
    expect(result.usage).toStrictEqual({ aiCalls: 2, inputTokens: 200, outputTokens: 40 });
    expect([result.notices, result.warnings, result.stoppedBy]).toStrictEqual([[], [], null]);
  });

  it("skips a requirement whose test file already exists, without an AI call (never overwrites)", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.2"));
    const { writer, run } = setup(ai, {
      files: { [`tests/autoai/${NAME_11}`]: "// edited by the user" },
    });
    const result = outcome(await run());
    expect(result.tests[0]).toMatchObject({ status: "exists", path: `tests/autoai/${NAME_11}` });
    expect(ai.requests).toHaveLength(1);
    expect(writer.written.has(`tests/autoai/${NAME_11}`)).toBe(false);
  });

  it("recognises an existing test by its requirement header, even under an older file name", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.2"));
    const { run } = setup(ai, {
      files: {
        "tests/autoai/cart-1-1-renamed.spec.ts": "// AutoAI requirement: Cart 1.1\n// edited",
      },
    });
    const result = outcome(await run());
    expect(result.tests[0]).toMatchObject({
      status: "exists",
      path: "tests/autoai/cart-1-1-renamed.spec.ts",
    });
    expect(ai.requests).toHaveLength(1);
  });

  it("reports exists when the file appears between the check and the write", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.2"));
    const { run } = setup(ai, { existing: [`tests/autoai/${NAME_12}`] });
    expect(outcome(await run()).tests[1]?.status).toBe("exists");
  });

  it("retries once with the rule problems fed back, then writes the fixed test", async () => {
    const noExpect = spec("Cart 1.1", "  await page.getByRole('button').click();");
    const ai = scriptedAiProvider(
      answer("Cart 1.1", noExpect),
      answer("Cart 1.1"),
      answer("Cart 1.2"),
    );
    const { run } = setup(ai);
    const result = outcome(await run());
    expect(result.tests[0]?.status).toBe("written");
    expect(ai.requests[1]?.user).toContain("<previous_attempt>");
    expect(ai.requests[1]?.user).toMatch(/<problems>\n- No expect\( assertion/);
  });

  it("retries once with the compiler errors fed back, then writes the fixed test", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.1"), answer("Cart 1.2"));
    const checker = scriptedSpecChecker([
      "5:9 Property 'getByLabelz' does not exist on type 'Page'.",
    ]);
    const { run } = setup(ai, { checker });
    expect(outcome(await run()).tests[0]?.status).toBe("written");
    expect(ai.requests[1]?.user).toContain(
      "- 5:9 Property 'getByLabelz' does not exist on type 'Page'.",
    );
  });

  it("marks needs_review and writes nothing when the second answer still fails", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.1"), answer("Cart 1.2"));
    const checker = scriptedSpecChecker(["5:9 first error"], ["5:9 still broken"]);
    const { writer, run } = setup(ai, { checker });
    const [first] = outcome(await run()).tests;
    expect(first).toMatchObject({
      status: "needs_review",
      code: spec("Cart 1.1"),
      problems: ["5:9 still broken"],
    });
    expect(first?.path).toBeUndefined();
    expect(writer.written.has(`tests/autoai/${NAME_11}`)).toBe(false);
  });

  it("treats an unparseable answer like any other invalid answer", async () => {
    const ai = scriptedAiProvider("no json", "still no json", answer("Cart 1.2"));
    const [first] = outcome(await setup(ai).run()).tests;
    expect(first?.status).toBe("needs_review");
    expect(first?.problems?.join()).toMatch(/no JSON object/);
  });

  it("stops at an AI error that affects everything, keeping what was written", async () => {
    const auth: AiError = { code: "AI_AUTH_FAILED", message: "rejected" };
    const ai = scriptedAiProvider(answer("Cart 1.1"), auth);
    const result = outcome(await setup(ai).run());
    expect(result.stoppedBy).toStrictEqual(auth);
    expect(result.tests.map((t) => t.status)).toStrictEqual(["written", "not_generated"]);
  });

  it("skips only the item on an AI error that affects one prompt", async () => {
    const ai = scriptedAiProvider({ code: "AI_REFUSED", message: "declined" }, answer("Cart 1.2"));
    const result = outcome(await setup(ai).run());
    expect(result.stoppedBy).toBeNull();
    expect(result.tests.map((t) => [t.status, t.problems])).toStrictEqual([
      ["not_generated", ["AI_REFUSED: declined"]],
      ["written", undefined],
    ]);
  });

  it("reports a write the writer refuses, keeping the code", async () => {
    const ai = scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.2"));
    const writer = inMemoryTestWriter([], {
      code: "PATH_NOT_ALLOWED",
      message: "tests is a symlink",
    });
    const deps = {
      repoReader: inMemoryRepoReader({ repo }),
      testWriter: writer,
      specChecker: scriptedSpecChecker(),
      aiProvider: ai,
    };
    const [first] = outcome(await generateTests(deps, { repoRoot: "repo", findings })).tests;
    expect(first).toMatchObject({
      status: "not_generated",
      problems: ["PATH_NOT_ALLOWED: tests is a symlink"],
      code: spec("Cart 1.1"),
    });
  });

  it.each([
    [
      "package.json without Playwright",
      { "package.json": JSON.stringify({ dependencies: { react: "19" } }) },
    ],
    ["no package.json", { "package.json": undefined }],
    ["an unreadable package.json", { "package.json": "{not json" }],
  ])("adds the Playwright notice for %s", async (_name, files) => {
    const repoFiles = Object.fromEntries(
      Object.entries({ ...repo, ...files }).filter(
        (e): e is [string, string] => e[1] !== undefined,
      ),
    );
    const deps = {
      repoReader: inMemoryRepoReader({ repo: repoFiles }),
      testWriter: inMemoryTestWriter(),
      specChecker: scriptedSpecChecker(),
      aiProvider: scriptedAiProvider(answer("Cart 1.1"), answer("Cart 1.2")),
    };
    expect(
      outcome(await generateTests(deps, { repoRoot: "repo", findings })).notices,
    ).toStrictEqual([PLAYWRIGHT_NOTICE]);
  });

  it("does nothing, and calls no AI, when no finding is eligible", async () => {
    const ai = scriptedAiProvider();
    const deps = {
      repoReader: inMemoryRepoReader({ repo }),
      testWriter: inMemoryTestWriter(),
      specChecker: scriptedSpecChecker(),
      aiProvider: ai,
    };
    const result = outcome(
      await generateTests(deps, { repoRoot: "repo", findings: [notImplemented] }),
    );
    expect([result.tests, result.skippedFindings, ai.requests.length]).toStrictEqual([[], 1, 0]);
  });

  it("fails when the repo folder is missing", async () => {
    const deps = {
      repoReader: inMemoryRepoReader({}),
      testWriter: inMemoryTestWriter(),
      specChecker: scriptedSpecChecker(),
      aiProvider: scriptedAiProvider(),
    };
    const result = await generateTests(deps, { repoRoot: "repo", findings });
    expect(result.ok ? null : result.error.code).toBe("PATH_NOT_FOUND");
  });
});
