import { describe, expect, expectTypeOf, it } from "vitest";
import type { DomainError } from "./domain-error";
import { err, ok, type Result } from "./result";

type LookupError = DomainError<"NOT_FOUND" | "AMBIGUOUS">;

function lookup(key: string): Result<number, LookupError> {
  if (key === "one") return ok(1);
  if (key === "") return err({ code: "AMBIGUOUS", message: "empty key" });
  return err({ code: "NOT_FOUND", message: `no value for ${key}` });
}

describe("Result", () => {
  it.each([
    { key: "one", expected: { ok: true, value: 1 } },
    { key: "", expected: { ok: false, error: { code: "AMBIGUOUS", message: "empty key" } } },
    {
      key: "two",
      expected: { ok: false, error: { code: "NOT_FOUND", message: "no value for two" } },
    },
  ])("returns $expected.ok for key '$key'", ({ key, expected }) => {
    expect(lookup(key)).toStrictEqual(expected);
  });

  it("narrows to the value on success and to the typed error on failure", () => {
    const r = lookup("one");
    if (r.ok) {
      expectTypeOf(r.value).toEqualTypeOf<number>();
    } else {
      expectTypeOf(r.error.code).toEqualTypeOf<"NOT_FOUND" | "AMBIGUOUS">();
    }
  });

  it("keeps success values untouched, including falsy ones", () => {
    expect(ok(0)).toStrictEqual({ ok: true, value: 0 });
    expect(ok(undefined)).toStrictEqual({ ok: true, value: undefined });
  });

  it("rejects error codes outside the use case's closed union (compile time)", () => {
    // @ts-expect-error "TIMEOUT" is not one of LookupError's codes
    const bad: Result<number, LookupError> = err({ code: "TIMEOUT", message: "x" });
    expect(bad.ok).toBe(false);
  });

  it("only accepts DomainError-shaped errors (compile time)", () => {
    // @ts-expect-error a plain string is not a DomainError
    type Bad = Result<number, string>;
    expectTypeOf<Bad>().not.toBeNever();
  });
});
