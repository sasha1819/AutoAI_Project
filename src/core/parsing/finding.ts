import { z } from "zod";
import { Confidence, Evidence, type Finding, FindingType, Severity } from "../domain/finding.ts";
import type { Requirement } from "../domain/requirement.ts";
import { ok, type Result } from "../domain/result.ts";
import { type MatchingPrompt, requirementRef } from "../prompts/matching.ts";
import { reviewFinding } from "../rules/confidence.ts";
import { verifyEvidence } from "../rules/evidence.ts";
import { extractJson, type InvalidAiOutput, invalid } from "./json.ts";
import { findingSeverity } from "../rules/severity.ts";

export type ParseFindingsError = InvalidAiOutput;

// Strict where a wrong value would change the verdict (which requirement, type, confidence). Lenient where the
// review rule already downgrades a bad value: broken evidence counts as missing, an odd severity as none.
const AiFinding = z.object({
  requirement: z.string(),
  type: FindingType,
  severity: z.unknown().optional(),
  explanation: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1)),
  evidence: z.unknown().optional(),
  confidence: Confidence,
});
const AiAnswer = z.object({ findings: z.array(AiFinding) });
type AiFinding = z.infer<typeof AiFinding>;

/**
 * Validates Claude's answer to a matching prompt and turns it into reviewed Findings, one per requirement, in
 * requirement order, checked against exactly what that prompt showed. Anything malformed is INVALID_AI_OUTPUT;
 * nothing unvalidated leaves this function.
 */
export function parseMatchingResponse(
  raw: string,
  prompt: Pick<MatchingPrompt, "requirements" | "files">,
): Result<readonly Finding[], ParseFindingsError> {
  const json = extractJson(raw);
  if (!json.ok) return json;
  const parsed = AiAnswer.safeParse(json.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return invalid(`the answer does not match the finding shape (${issues})`);
  }

  const known = new Set(prompt.requirements.map((_, i) => requirementRef(i)));
  const byRef = new Map<string, AiFinding>();
  for (const answer of parsed.data.findings) {
    if (!known.has(answer.requirement)) return invalid(`unknown requirement ${answer.requirement}`);
    if (byRef.has(answer.requirement))
      return invalid(`more than one finding for ${answer.requirement}`);
    byRef.set(answer.requirement, answer);
  }

  const files = new Map(prompt.files.map((f) => [f.path, f.text]));
  const findings: Finding[] = [];
  for (const [i, requirement] of prompt.requirements.entries()) {
    const answer = byRef.get(requirementRef(i));
    if (!answer) return invalid(`no finding for ${requirementRef(i)} (${requirement.tag})`);
    findings.push(toFinding(requirement, answer, files));
  }
  return ok(findings);
}

function toFinding(
  requirement: Requirement,
  answer: AiFinding,
  files: ReadonlyMap<string, string>,
): Finding {
  const parsedEvidence = Evidence.safeParse(answer.evidence);
  const evidence = parsedEvidence.success ? parsedEvidence.data : null;
  const claimed = Severity.safeParse(answer.severity);
  const decision = reviewFinding({
    type: answer.type,
    confidence: answer.confidence,
    evidence,
    evidenceVerified: evidence !== null && verifyEvidence(evidence, files),
  });
  return {
    requirement,
    type: answer.type,
    severity: findingSeverity(answer.type, claimed.success ? claimed.data : null),
    explanation: answer.explanation,
    evidence,
    confidence: answer.confidence,
    reviewStatus: decision.reviewStatus,
    reviewReasons: decision.reasons,
  };
}
