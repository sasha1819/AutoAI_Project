---
name: playwright-generation
description: Rules for generating and editing Playwright tests in AutoAI (prompts that produce .spec.ts files, test naming, selectors, waits, compile checks). Use whenever writing test-generation prompts, parsing a .spec.ts into readable steps, or changing how generated tests look.
---

# Generated Playwright tests

## File and naming
- Output path in the user's repo: `tests/autoai/<area>-<slug>.spec.ts` (kebab-case).
- First line of every file: a comment with the requirement tag, e.g. `// AutoAI requirement: Cart 2.4`.
- One behaviour per test. Test title = plain language ("Discount codes cannot be combined").

## Writing rules (reliability)
- Locators: prefer `getByRole`, `getByLabel`, `getByText`, `getByTestId`. Avoid long CSS/XPath chains.
- Waits: use Playwright web-first assertions (`await expect(locator).toBeVisible()`). NEVER `waitForTimeout` with a fixed number.
- Scroll into view before clicking if needed (`locator.scrollIntoViewIfNeeded()`).
- No hard-coded absolute URLs: use `baseURL` from config.
- Assert the outcome required by the PRD, not just that a button exists.

## Checks before a test is "ready"
1. Run `npx tsc --noEmit` on the generated file. Fails => regenerate once with the error, else mark "needs_review".
2. File must contain at least one `expect(`.
3. No `waitForTimeout`, no `test.only`, no `.skip`.

## Step list view (UI)
The workspace shows readable steps. Derive them by parsing the file's Playwright calls
(`goto`, `click`, `fill`, `expect`) deterministically. Do NOT use an AI call for this.

## Where this lives
Prompt text: `core/prompts/generate-test.ts`. "Is this generated file acceptable?" checks (has expect, no waitForTimeout, no test.only): `core/rules/generated-test.ts` (pure, tested).
Compiling with tsc and writing files: `adapters/fs` + `adapters/playwright`. Orchestration: `services/generate-tests.ts`.
