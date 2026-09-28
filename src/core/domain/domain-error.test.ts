import { describe, expect, expectTypeOf, it } from "vitest";
import type { DomainError, ErrorCode } from "./domain-error";

describe("DomainError", () => {
  it("accepts SCREAMING_SNAKE codes", () => {
    const e: DomainError<"AI_RATE_LIMITED"> = { code: "AI_RATE_LIMITED", message: "slow down" };
    expect(e.code).toBe("AI_RATE_LIMITED");
    expectTypeOf<"REPO_NOT_FOUND">().toExtend<ErrorCode>();
  });

  it("rejects codes that are not upper case (compile time)", () => {
    // @ts-expect-error lowercase codes do not compile
    const e: DomainError = { code: "not_found", message: "x" };
    expect(e.message).toBe("x");
  });

  it("is read-only", () => {
    const e: DomainError<"INVALID_AI_OUTPUT"> = { code: "INVALID_AI_OUTPUT", message: "bad json" };
    // @ts-expect-error fields cannot be reassigned
    e.message = "changed";
    expectTypeOf(e).toEqualTypeOf<DomainError<"INVALID_AI_OUTPUT">>();
  });
});
