import { describe, expect, it } from "vitest";
import { REDACTED, redactSecrets } from "./redaction.ts";

const R = REDACTED;
// Fake tokens are assembled at runtime so the source never holds a token-shaped literal: secret scanners (GitHub
// push protection) rightly refuse those, even fake ones. Each still has the exact shape the rule must catch.
const fake = (...parts: string[]) => parts.join("");
const STRIPE = fake("sk_", "test_", "FAKE0000", "FAKE0000", "FAKE0000");
const GITHUB = fake("ghp_", "FAKE".repeat(9));
const AWS = fake("AK", "IA", "FAKE", "FAKE", "FAKE", "FAKE");
const SLACK = fake("xo", "xb-", "0000000000", "-FAKEFAKEFA");
const GOOGLE = fake("AI", "za", "FAKE".repeat(8), "FAK");
const JWT = fake("ey", "JFAKEFAKEFAKE", ".", "eyJFAKEFAKEFAKE", ".", "FAKEFAKEFAKE");
const PEM = fake(
  "-----BEGIN RSA ",
  "PRIVATE KEY-----\nFAKEFAKE\n-----END RSA ",
  "PRIVATE KEY-----",
);

describe("redactSecrets: secrets never reach an AI prompt", () => {
  it.each<[string, string, string]>([
    // Known key and token formats, wherever they appear.
    ["an Anthropic key", "key is sk-ant-api03-AbCdEf123456", `key is ${R}`],
    ["an sk- key", "use sk-live-TOKENVALUE123 here", `use ${R} here`],
    ["a Stripe key", `stripe("${STRIPE}")`, `stripe("${R}")`],
    ["a GitHub token", GITHUB, R],
    ["an AWS access key id", AWS, R],
    ["a Slack token", SLACK, R],
    ["a Google API key", GOOGLE, R],
    ["a JWT", `Bearer ${JWT}`, `Bearer ${R}`],
    ["a private key block", PEM, R],
    // Headers: the name stays (it helps the diagnosis), the value goes.
    ["an Authorization header", "Authorization: Bearer abc.def", `Authorization: ${R}`],
    ["a Cookie header", "cookie: sid=123; theme=dark", `cookie: ${R}`],
    ["a Set-Cookie header", "set-cookie: session=xyz; HttpOnly", `set-cookie: ${R}`],
    ["an x-api-key header in code", '{ "x-api-key": "abc123" }', `{ "x-api-key": "${R}" }`],
    // URLs: credentials in the address and every query value (tokens hide in innocent names).
    ["URL credentials", "https://admin:hunter2@example.com/x", `https://${R}@example.com/x`],
    [
      "query values, absolute and relative",
      'goto("/reset?token=abc123&page=2") and https://x.io/cb?code=zz#top',
      `goto("/reset?token=${R}&page=${R}") and https://x.io/cb?code=${R}#top`,
    ],
    // Assignments to a secret-named key, in code, JSON or env style.
    ["a quoted secret in code", 'const password = "hunter2";', `const password = "${R}";`],
    ["a JSON secret", '{"apiKey": "k-123", "name": "Jane"}', `{"apiKey": "${R}", "name": "Jane"}`],
    ["an env-style secret", "DB_PASSWORD=hunter2 PORT=3000", `DB_PASSWORD=${R} PORT=3000`],
    // Values typed into secret fields, in the spec code.
    [
      "a password typed via getByLabel",
      'await page.getByLabel("Password").fill("hunter2-SECRET");',
      `await page.getByLabel("Password").fill("${R}");`,
    ],
    [
      "a token typed via getByRole options",
      "await page.getByRole('textbox', { name: 'API token' }).fill('abc');",
      `await page.getByRole('textbox', { name: 'API token' }).fill('${R}');`,
    ],
    [
      "a PIN typed via locator",
      'await page.locator("#passcode").pressSequentially("1234");',
      `await page.locator("#passcode").pressSequentially("${R}");`,
    ],
    // Values of secret fields in Playwright's page snapshot (a password field shows its value there).
    [
      "a password textbox in the page snapshot",
      '    - textbox "Password" [ref=e5]: hunter2-SECRET\n    - textbox "Email" [ref=e3]: jane@example.com',
      `    - textbox "Password" [ref=e5]: ${R}\n    - textbox "Email" [ref=e3]: jane@example.com`,
    ],
  ])("hides %s", (_name, input, output) => {
    expect(redactSecrets(input).text).toBe(output);
  });

  it("hides the expected and received values of a failed check on a secret field", () => {
    const error = [
      "Error: expect(locator).toHaveValue(expected) failed",
      "",
      "Locator:  getByLabel('Password')",
      'Expected: "hunter2"',
      'Received: "hunter3"',
    ].join("\n");
    expect(redactSecrets(error).text).toBe(
      [
        "Error: expect(locator).toHaveValue(expected) failed",
        "",
        "Locator:  getByLabel('Password')",
        `Expected: ${R}`,
        `Received: ${R}`,
      ].join("\n"),
    );
  });

  it.each([
    [
      "ordinary test code",
      'await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();',
    ],
    ["a check on a non-secret field", "Locator:  getByLabel('Email')\nExpected: \"a@b.co\""],
    ["an email (personal data, but needed to diagnose validation bugs)", "jane@example.com"],
    ["a reference to an env var (no value)", "const key = process.env.API_KEY;"],
    ["app text", "Discount SAVE10 applied. Total: 45.00"],
    ["words that only contain a secret word", 'const author = "Jane"; const tokenizer = split;'],
    ["a URL without a query", "https://example.com/cart#top"],
    ["an empty query value", 'fetch("/search?q=")'],
    ["a snapshot textbox that is not secret", '- textbox "Discount code": save10'],
  ])("leaves %s alone", (_name, text) => {
    expect(redactSecrets(text)).toStrictEqual({ text, count: 0 });
  });

  it("counts what it hid, and is stable when run twice", () => {
    const once = redactSecrets('password = "a" and https://x.io/?t=1&u=2');
    expect(once.count).toBe(3);
    expect(redactSecrets(once.text)).toStrictEqual({ text: once.text, count: 0 });
  });
});
