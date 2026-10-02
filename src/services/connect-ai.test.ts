import { describe, expect, it } from "vitest";
import { ApiKey } from "../core/domain/api-key.ts";
import { err, ok } from "../core/domain/result.ts";
import { aiKeyStatus, checkAiKey, saveAiKey } from "./connect-ai.ts";
import { inMemorySecretStore } from "./testing/in-memory-secret-store.ts";
import { scriptedAccess } from "./testing/scripted-ai-provider.ts";

const KEY = ApiKey.parse("sk-test-key");
const broken = { code: "SECRET_STORE_UNAVAILABLE", message: "no keyring" } as const;

describe("aiKeyStatus", () => {
  it("says whether a key is saved, never the key", async () => {
    expect(await aiKeyStatus({ secretStore: inMemorySecretStore() })).toStrictEqual(
      ok({ configured: false }),
    );
    const result = await aiKeyStatus({ secretStore: inMemorySecretStore(KEY) });
    expect(result).toStrictEqual(ok({ configured: true }));
    expect(JSON.stringify(result)).not.toContain("sk-test-key");
  });
  it("passes a store failure on", async () => {
    expect(await aiKeyStatus({ secretStore: inMemorySecretStore(null, broken) })).toStrictEqual(
      err(broken),
    );
  });
});

describe("saveAiKey", () => {
  const accepts = () => scriptedAccess(ok(undefined));

  it("checks the typed key first and saves it (trimmed) only once it works", async () => {
    const secretStore = inMemorySecretStore();
    const checked: string[] = [];
    const result = await saveAiKey(
      {
        secretStore,
        aiProviderFor: (k) => {
          checked.push(k);
          return accepts();
        },
      },
      { key: "  sk-new  " },
    );
    expect(result).toStrictEqual(ok(undefined));
    expect(checked).toStrictEqual(["sk-new"]);
    expect(await secretStore.load()).toStrictEqual(ok("sk-new"));
  });

  it("a key the provider rejects is not saved: the old one stays", async () => {
    const secretStore = inMemorySecretStore(KEY);
    const rejected = { code: "AI_AUTH_FAILED", message: "rejected" } as const;
    const result = await saveAiKey(
      { secretStore, aiProviderFor: () => scriptedAccess(err(rejected)) },
      { key: "sk-wrong" },
    );
    expect(result).toStrictEqual(err(rejected));
    expect(await secretStore.load()).toStrictEqual(ok(KEY));
  });

  it.each(["", "   ", "two words"])(
    "refuses %j before asking the provider or touching the store",
    async (key) => {
      const secretStore = inMemorySecretStore(KEY);
      const result = await saveAiKey(
        {
          secretStore,
          aiProviderFor: () => {
            throw new Error("must not be asked");
          },
        },
        { key },
      );
      expect(result.ok ? null : result.error.code).toBe("KEY_INVALID");
      expect(await secretStore.load()).toStrictEqual(ok(KEY));
    },
  );
});

describe("checkAiKey", () => {
  it("asks the provider built for the saved key", async () => {
    const used: string[] = [];
    const result = await checkAiKey({
      secretStore: inMemorySecretStore(KEY),
      aiProviderFor: (k) => {
        used.push(k);
        return scriptedAccess(ok(undefined));
      },
    });
    expect(result).toStrictEqual(ok(undefined));
    expect(used).toStrictEqual(["sk-test-key"]);
  });
  it("passes a rejected key on", async () => {
    const rejected = { code: "AI_AUTH_FAILED", message: "rejected" } as const;
    const result = await checkAiKey({
      secretStore: inMemorySecretStore(KEY),
      aiProviderFor: () => scriptedAccess(err(rejected)),
    });
    expect(result).toStrictEqual(err(rejected));
  });
  it("NO_KEY when nothing is saved, without building a provider", async () => {
    const result = await checkAiKey({
      secretStore: inMemorySecretStore(),
      aiProviderFor: () => {
        throw new Error("must not be built");
      },
    });
    expect(result.ok ? null : result.error.code).toBe("NO_KEY");
  });
});
