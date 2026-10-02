import { ApiKey } from "../../core/domain/api-key.ts";
import type { SecretStore } from "../../core/ports/secret-store.ts";

/**
 * What every SecretStore must do (ADR 0007), as named checks that throw on failure. A test file runs each one in
 * its own `it` against the in-memory fake or the safeStorage adapter. (No test-library import: services/testing
 * may use only core.)
 */
export function secretStoreContract(
  make: () => SecretStore | Promise<SecretStore>,
): readonly (readonly [string, () => Promise<void>])[] {
  const key = ApiKey.parse("sk-contract-key-1");
  const other = ApiKey.parse("sk-contract-key-2");
  const same = (actual: unknown, expected: unknown, what: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  };
  return [
    [
      "loads nothing before anything is saved",
      async () => {
        same(await (await make()).load(), { ok: true, value: null }, "load");
      },
    ],
    [
      "loads exactly the key it saved, and the last one when saved twice",
      async () => {
        const store = await make();
        await store.save(key);
        same(await store.load(), { ok: true, value: key }, "first load");
        await store.save(other);
        same(await store.load(), { ok: true, value: other }, "second load");
      },
    ],
    [
      "forgets the key on clear, and clearing twice is fine",
      async () => {
        const store = await make();
        await store.save(key);
        same((await store.clear()).ok, true, "first clear");
        same((await store.clear()).ok, true, "second clear");
        same(await store.load(), { ok: true, value: null }, "load after clear");
      },
    ],
  ];
}
