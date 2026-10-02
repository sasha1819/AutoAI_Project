import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiKey } from "../../core/domain/api-key.ts";
import { secretStoreContract } from "../../services/testing/secret-store-contract.ts";
import { createSafeStorageSecretStore, type SafeStorageLike } from "./safe-storage-secret-store.ts";

// A stand-in for the OS encryption: reversible, and visibly not plain text.
const fakeSafeStorage = (over: Partial<SafeStorageLike> = {}): SafeStorageLike => ({
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`ENC(${Buffer.from(s).toString("base64")})`),
  decryptString: (b) => {
    const m = /^ENC\((.*)\)$/.exec(b.toString());
    if (m?.[1] === undefined) throw new Error("not encrypted by this store");
    return Buffer.from(m[1], "base64").toString();
  },
  ...over,
});
const tempFile = () => join(mkdtempSync(join(tmpdir(), "autoai-secret-")), "nested", "ai-key.bin");

describe("createSafeStorageSecretStore", () => {
  describe("keeps the SecretStore contract", () => {
    const contract = secretStoreContract(() =>
      createSafeStorageSecretStore({ safeStorage: fakeSafeStorage(), file: tempFile() }),
    );
    for (const [name, check] of contract) it(name, check);
  });

  it("writes only encrypted bytes, readable by the user only", async () => {
    const file = tempFile();
    await createSafeStorageSecretStore({ safeStorage: fakeSafeStorage(), file }).save(
      ApiKey.parse("sk-secret-123"),
    );
    expect(readFileSync(file, "utf8")).not.toContain("sk-secret-123");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it.each([
    ["encryption is not available", fakeSafeStorage({ isEncryptionAvailable: () => false })],
    [
      "Linux has no real keyring (basic_text)",
      fakeSafeStorage({ getSelectedStorageBackend: () => "basic_text" }),
    ],
  ])("refuses to save when %s, and writes nothing", async (_name, safeStorage) => {
    const file = tempFile();
    const result = await createSafeStorageSecretStore({ safeStorage, file }).save(
      ApiKey.parse("sk-x"),
    );
    expect(result.ok ? null : result.error.code).toBe("SECRET_STORE_UNAVAILABLE");
    expect(() => statSync(file)).toThrow();
  });

  it("a saved file that can no longer be decrypted on this machine (no keychain now) is UNAVAILABLE", async () => {
    const file = tempFile();
    await createSafeStorageSecretStore({ safeStorage: fakeSafeStorage(), file }).save(
      ApiKey.parse("sk-x"),
    );
    const later = createSafeStorageSecretStore({
      safeStorage: fakeSafeStorage({ isEncryptionAvailable: () => false }),
      file,
    });
    const result = await later.load();
    expect(result.ok ? null : result.error.code).toBe("SECRET_STORE_UNAVAILABLE");
  });

  it("a file it cannot decrypt is a failure, not a key", async () => {
    const file = tempFile();
    await createSafeStorageSecretStore({ safeStorage: fakeSafeStorage(), file }).save(
      ApiKey.parse("sk-x"),
    );
    writeFileSync(file, "garbage");
    const result = await createSafeStorageSecretStore({
      safeStorage: fakeSafeStorage(),
      file,
    }).load();
    expect(result.ok ? null : result.error.code).toBe("SECRET_STORE_FAILED");
  });
});
