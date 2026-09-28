import type { DomainError } from "./domain-error";

export type Result<T, E extends DomainError = DomainError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a success value. */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/** Wraps an expected failure. */
export function err<E extends DomainError>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
