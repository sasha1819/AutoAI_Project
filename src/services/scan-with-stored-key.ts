import type { ApiKey } from "../core/domain/api-key.ts";
import type { DomainError } from "../core/domain/domain-error.ts";
import { err, type Result } from "../core/domain/result.ts";
import type { ScanProgress } from "../core/domain/scan-progress.ts";
import type { AiProvider } from "../core/ports/ai-provider.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import type { SecretStore, SecretStoreErrorCode } from "../core/ports/secret-store.ts";
import { type ScanProjectError, type ScanResult, scanProject } from "./scan-project.ts";

type Deps = {
  readonly secretStore: SecretStore;
  readonly repoReader: RepoReader;
  readonly aiProviderFor: (key: ApiKey) => AiProvider;
};

export type ScanInput = {
  readonly repoRoot: string;
  readonly prdFolder: string | null;
  readonly onProgress?: (progress: ScanProgress) => void;
};
export type ScanWithStoredKeyError =
  ScanProjectError | DomainError<"NO_KEY" | "SCAN_BUSY" | SecretStoreErrorCode>;

/**
 * The app's scans (ADR 0007): scanProject with the key from the SecretStore, so the screen never handles the key,
 * and one scan at a time — a second request while one runs gets SCAN_BUSY instead of a second paid scan.
 */
export function createScanRunner(deps: Deps): {
  readonly scan: (input: ScanInput) => Promise<Result<ScanResult, ScanWithStoredKeyError>>;
} {
  let running = false;
  return {
    async scan(input) {
      if (running) return err({ code: "SCAN_BUSY", message: "A scan is already running." });
      running = true;
      try {
        const loaded = await deps.secretStore.load();
        if (!loaded.ok) return loaded;
        if (loaded.value === null)
          return err({ code: "NO_KEY", message: "Connect your AI provider first." });
        return await scanProject(
          { repoReader: deps.repoReader, aiProvider: deps.aiProviderFor(loaded.value) },
          input,
        );
      } finally {
        running = false;
      }
    },
  };
}
