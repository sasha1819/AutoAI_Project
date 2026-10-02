// Placeholder findings for FindingCard's tests and stories, built through the real schema so they are valid.
import { Finding } from "../../../../core/domain/finding.ts";

export function exampleFinding(overrides: Record<string, unknown> = {}): Finding {
  return Finding.parse({
    requirement: {
      tag: "Area 1.2",
      area: "Area",
      text: "What the requirement says should happen, in a sentence or two.",
      source: { file: "example-prd.md", line: 12 },
    },
    type: "mismatch",
    severity: "high",
    explanation: "What the code does instead, as Claude read it.",
    evidence: { file: "src/example/file.ts", lines: [12, 18], snippet: "const example = true;" },
    confidence: 0.86,
    reviewStatus: "confirmed",
    reviewReasons: [],
    ...overrides,
  });
}
