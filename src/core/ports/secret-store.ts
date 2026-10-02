import type { ApiKey } from "../domain/api-key.ts";
import type { DomainError } from "../domain/domain-error.ts";
import type { Result } from "../domain/result.ts";

export type SecretStoreErrorCode =
  /** The OS cannot encrypt on this machine (e.g. no keyring): the key is never kept in plain text instead. */
  | "SECRET_STORE_UNAVAILABLE"
  /** Reading or writing the stored secret failed. */
  | "SECRET_STORE_FAILED";
export type SecretStoreError = DomainError<SecretStoreErrorCode>;

/** Keeps the user's AI API key, encrypted by the OS (ADR 0007). One key; nothing else. */
export type SecretStore = {
  readonly save: (key: ApiKey) => Promise<Result<undefined, SecretStoreError>>;
  /** The saved key, or null when none is saved. */
  readonly load: () => Promise<Result<ApiKey | null, SecretStoreError>>;
  readonly clear: () => Promise<Result<undefined, SecretStoreError>>;
};
