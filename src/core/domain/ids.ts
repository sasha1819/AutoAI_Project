import { z } from "zod";

// Branding happens only by parsing, so an id is validated wherever it enters (DB row, id generator, IPC).
const idString = z.string().max(128).regex(/^\S+$/, "id must be non-empty with no whitespace");

export const ProjectId = idString.brand<"ProjectId">();
export type ProjectId = z.infer<typeof ProjectId>;

export const RequirementId = idString.brand<"RequirementId">();
export type RequirementId = z.infer<typeof RequirementId>;

export const FindingId = idString.brand<"FindingId">();
export type FindingId = z.infer<typeof FindingId>;

export const TestCaseId = idString.brand<"TestCaseId">();
export type TestCaseId = z.infer<typeof TestCaseId>;

export const RunId = idString.brand<"RunId">();
export type RunId = z.infer<typeof RunId>;

export const StepId = idString.brand<"StepId">();
export type StepId = z.infer<typeof StepId>;

export const DiagnosisId = idString.brand<"DiagnosisId">();
export type DiagnosisId = z.infer<typeof DiagnosisId>;
