import type { ApiKey } from "../../core/domain/api-key.ts";
import { err, ok } from "../../core/domain/result.ts";
import type { SecretStore, SecretStoreError } from "../../core/ports/secret-store.ts";

/** Test double for SecretStore: keeps the key in memory; `failWith` makes every call fail with that error. */
export function inMemorySecretStore(
  start: ApiKey | null = null,
  failWith?: SecretStoreError,
): SecretStore {
  let key = start;
  if (failWith !== undefined) {
    const fail = () => Promise.resolve(err(failWith));
    return { save: fail, load: fail, clear: fail };
  }
  return {
    save: (k) => {
      key = k;
      return Promise.resolve(ok(undefined));
    },
    load: () => Promise.resolve(ok(key)),
    clear: () => {
      key = null;
      return Promise.resolve(ok(undefined));
    },
  };
}
