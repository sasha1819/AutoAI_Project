import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ApiKey } from "../../core/domain/api-key.ts";
import { err, ok } from "../../core/domain/result.ts";
import type { SecretStore, SecretStoreError } from "../../core/ports/secret-store.ts";

/** The parts of Electron's `safeStorage` this adapter uses (passed in, so tests need no Electron). */
export type SafeStorageLike = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plain: string) => Buffer;
  readonly decryptString: (encrypted: Buffer) => string;
  /** Linux only: "basic_text" means no real keyring (the text would only be obfuscated). */
  readonly getSelectedStorageBackend?: () => string;
};

const unavailable: SecretStoreError = {
  code: "SECRET_STORE_UNAVAILABLE",
  message: "This computer cannot encrypt secrets (no system keychain), so the key was not saved.",
};
const failed = (what: string, e: unknown): SecretStoreError => ({
  code: "SECRET_STORE_FAILED",
  message: `Could not ${what} the saved key: ${e instanceof Error ? e.message : String(e)}`,
});

/**
 * SecretStore over Electron safeStorage (ADR 0007): the key is encrypted by the OS keychain and only the encrypted
 * bytes are written, to `file` (in the app's user-data folder), readable by the user only. Never stored in plain text.
 */
export function createSafeStorageSecretStore(deps: {
  readonly safeStorage: SafeStorageLike;
  readonly file: string;
}): SecretStore {
  const { safeStorage, file } = deps;
  const canEncrypt = () =>
    safeStorage.isEncryptionAvailable() &&
    safeStorage.getSelectedStorageBackend?.() !== "basic_text";

  return {
    async save(key) {
      if (!canEncrypt()) return err(unavailable);
      try {
        const encrypted = safeStorage.encryptString(key);
        await mkdir(dirname(file), { recursive: true });
        // Write then rename, so a crash never leaves half a file where the key was.
        const tmp = `${file}.tmp`;
        await writeFile(tmp, encrypted, { mode: 0o600 });
        await rename(tmp, file);
        return ok(undefined);
      } catch (e) {
        return err(failed("save", e));
      }
    },
    async load() {
      let encrypted: Buffer;
      try {
        encrypted = await readFile(file);
      } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "ENOENT") return ok(null);
        return err(failed("read", e));
      }
      if (!canEncrypt()) return err(unavailable);
      try {
        const parsed = ApiKey.safeParse(safeStorage.decryptString(encrypted));
        return parsed.success
          ? ok(parsed.data)
          : err(failed("read", new Error("it is not a valid key")));
      } catch (e) {
        return err(failed("decrypt", e));
      }
    },
    async clear() {
      try {
        await rm(file, { force: true });
        return ok(undefined);
      } catch (e) {
        return err(failed("remove", e));
      }
    },
  };
}
