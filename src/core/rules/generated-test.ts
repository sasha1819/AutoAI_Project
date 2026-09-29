import type { Finding } from "../domain/finding.ts";
import type { Requirement } from "../domain/requirement.ts";
import type { PackageDependencies } from "../parsing/package-json.ts";

/** The only folder generated tests are written to (ADR 0004); the TestWriter port enforces it as well. */
export const GENERATED_TEST_DIR = "tests/autoai";
const MAX_NAME_CHARS = 60;
const TEXT_WORDS_IN_NAME = 5;

/**
 * Whether a finding gets a generated test (ADR 0004): only a confirmed match or mismatch. A mismatch test asserts
 * the spec and fails until the code is fixed; a missing feature has nothing to drive; unreviewed findings wait.
 */
export function shouldGenerateTest(finding: Finding): boolean {
  return (
    finding.reviewStatus === "confirmed" &&
    (finding.type === "match" || finding.type === "mismatch")
  );
}

/**
 * File names for the tests of these requirements, in order: "<area>-<tag>-<first words>.spec.ts", kebab-case,
 * at most 60 characters before the extension. A name used twice in one run gets the PRD line appended.
 */
export function generatedTestFileNames(requirements: readonly Requirement[]): readonly string[] {
  const used = new Set<string>();
  return requirements.map((r) => {
    let name = baseName(r);
    if (used.has(name)) name = `${name}-l${String(r.source.line)}`;
    for (let n = 2; used.has(name); n++)
      name = `${baseName(r)}-l${String(r.source.line)}-${String(n)}`;
    used.add(name);
    return `${name}.spec.ts`;
  });
}

function baseName(r: Requirement): string {
  const area = slug(r.area);
  const tag = slug(r.tag);
  const head = area !== "" && !tag.startsWith(area) ? `${area}-${tag}` : tag;
  const words = slug(r.text.split(/\s+/).slice(0, TEXT_WORDS_IN_NAME).join(" "));
  const name = shorten([head, words].filter((p) => p !== "").join("-"));
  return name === "" ? `requirement-l${String(r.source.line)}` : name;
}

// Accents are folded ("Café" -> "cafe"); other scripts drop out, which is why a name can fall back to the line.
function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shorten(name: string): string {
  if (name.length <= MAX_NAME_CHARS) return name;
  const cut = name.slice(0, MAX_NAME_CHARS);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

// Every way a module can be named: import/export ... from, bare import, dynamic import() and require(), with
// single, double or backtick quotes.
const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'`]([^"'`]+)["'`]/gm;

/**
 * The playwright-generation rules a test must follow before it may be written (ADR 0004). Returns the problems,
 * each phrased so it can be fed back to Claude; an empty list means accepted.
 */
export function checkGeneratedTest(code: string, tag: string): readonly string[] {
  const problems: string[] = [];
  const firstLine = code.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine !== header(tag)) problems.push(`First line must be "${header(tag)}"`);
  if (!code.includes("expect("))
    problems.push("No expect( assertion: assert the outcome the requirement asks for");
  if (/\bwaitForTimeout\s*\(/.test(code))
    problems.push("Uses waitForTimeout; use web-first assertions instead");
  if (/\.only\s*\(/.test(code)) problems.push("Uses .only, which would silence every other test");
  if (/\.(skip|fixme)\s*\(/.test(code))
    problems.push("Uses .skip or .fixme; a generated test must run");
  if (/https?:\/\//i.test(code))
    problems.push("Uses an absolute URL; use relative paths with the config's baseURL");
  const imports = [...code.matchAll(IMPORT_SPECIFIER)].map((m) => m[1] ?? "");
  for (const spec of imports) {
    if (spec !== "@playwright/test")
      problems.push(`Imports "${spec}"; only "@playwright/test" is allowed`);
  }
  if (!imports.includes("@playwright/test"))
    problems.push('Does not import from "@playwright/test"');
  return problems;
}

/** The requirement header every generated test starts with; it links the file back to its requirement. */
function header(tag: string): string {
  return `// AutoAI requirement: ${tag}`;
}

/**
 * The existing test for a requirement, if any: a file in tests/autoai whose first line names the same tag (file
 * names can change when PRD text changes; the header does not), or else a file with the planned name.
 */
export function existingTestPath(
  tag: string,
  fileName: string,
  existing: readonly { readonly path: string; readonly firstLine: string }[],
): string | null {
  const byHeader = existing.find((f) => f.firstLine.trim() === header(tag));
  if (byHeader) return byHeader.path;
  return existing.find((f) => f.path === `${GENERATED_TEST_DIR}/${fileName}`)?.path ?? null;
}

export const PLAYWRIGHT_NOTICE =
  "This repo has no @playwright/test dependency in package.json. To run these tests, add @playwright/test and a playwright.config with a baseURL.";

/** The notice shown when the target repo cannot run the generated tests yet (ADR 0004); null when it can. */
export function playwrightNotice(pkg: PackageDependencies | null): string | null {
  return pkg?.names.includes("@playwright/test") ? null : PLAYWRIGHT_NOTICE;
}
