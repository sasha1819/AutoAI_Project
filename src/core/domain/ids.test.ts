import { describe, expect, expectTypeOf, it } from "vitest";
import { DiagnosisId, FindingId, ProjectId, RequirementId, RunId, StepId, TestCaseId } from "./ids";

const schemas = { ProjectId, RequirementId, FindingId, TestCaseId, RunId, StepId, DiagnosisId };

describe.each(Object.entries(schemas))("%s", (_name, schema) => {
  it.each(["a", "42", "req_01HZX3", "3f1c2a9e-8b7d-4c6e-9f0a-1b2c3d4e5f60", "x".repeat(128)])(
    "accepts %j",
    (raw) => {
      expect(schema.safeParse(raw)).toStrictEqual({ success: true, data: raw });
    },
  );

  it.each(["", " ", " a", "a ", "a b", "a\nb", "x".repeat(129), 42, null, undefined, {}])(
    "rejects %j",
    (raw) => {
      expect(schema.safeParse(raw).success).toBe(false);
    },
  );
});

describe("branding", () => {
  const requirementId = RequirementId.parse("req-1");
  const runId = RunId.parse("run-1");

  it("keeps the runtime value a plain string", () => {
    expect(requirementId).toBe("req-1");
    expectTypeOf(requirementId).toExtend<string>();
  });

  it("does not let one id stand in for another (compile time)", () => {
    // @ts-expect-error a RunId is not a RequirementId
    const wrong: RequirementId = runId;
    // @ts-expect-error a plain string must be parsed first
    const unparsed: RunId = "run-2";
    expect([wrong, unparsed]).toHaveLength(2);
  });
});
