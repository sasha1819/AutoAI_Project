import { join } from "node:path";
import { createClaudeAiProvider } from "../../adapters/claude/claude-ai-provider.ts";
import { createFsRepoReader } from "../../adapters/fs/fs-repo-reader.ts";
import {
  createSafeStorageSecretStore,
  type SafeStorageLike,
} from "../../adapters/keychain/safe-storage-secret-store.ts";
import { aiKeyStatus, checkAiKey, saveAiKey } from "../../services/connect-ai.ts";
import { createScanRunner } from "../../services/scan-with-stored-key.ts";
import type { AppServices } from "./handlers.ts";

/**
 * The app's composition root (like src/cli/compose.ts): the only place it creates adapters and hands them to
 * services. Electron's own objects come in as arguments, so this file stays testable.
 */
export function composeApp(env: {
  readonly userDataDir: string;
  readonly safeStorage: SafeStorageLike;
  readonly pickFolder: AppServices["pickFolder"];
  /** Tests only: serves the AI provider's network calls (the app uses the real network). */
  readonly fetch?: typeof globalThis.fetch;
}): AppServices {
  const secretStore = createSafeStorageSecretStore({
    safeStorage: env.safeStorage,
    file: join(env.userDataDir, "secrets", "ai-key.bin"),
  });
  const repoReader = createFsRepoReader();
  const aiProviderFor = (apiKey: string) =>
    createClaudeAiProvider({
      apiKey,
      ...(env.fetch === undefined ? {} : { fetch: env.fetch, maxRetries: 0 }),
    });
  const scanRunner = createScanRunner({ secretStore, repoReader, aiProviderFor });
  return {
    aiStatus: () => aiKeyStatus({ secretStore }),
    saveAiKey: (key) => saveAiKey({ secretStore, aiProviderFor }, { key }),
    checkAiKey: () => checkAiKey({ secretStore, aiProviderFor }),
    pickFolder: env.pickFolder,
    scan: (input) => scanRunner.scan(input),
  };
}
