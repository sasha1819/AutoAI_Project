import type { ApiKey } from "../../core/domain/api-key.ts";
import { ok } from "../../core/domain/result.ts";
import type { SecretStore } from "../../core/ports/secret-store.ts";

/**
 * Mock mode's SecretStore: memory only, gone when the app closes. It never touches the OS keychain, so a mock key
 * can never replace a real saved key (dev-only; wired only by the app's composition root).
 */
export function createMemorySecretStore(): SecretStore {
  let key: ApiKey | null = null;
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
