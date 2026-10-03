import { join } from "node:path";
import { createClaudeAiProvider } from "../../adapters/claude/claude-ai-provider.ts";
import { createFsRepoReader } from "../../adapters/fs/fs-repo-reader.ts";
import {
  createSafeStorageSecretStore,
  type SafeStorageLike,
} from "../../adapters/keychain/safe-storage-secret-store.ts";
import { createMemorySecretStore } from "../../adapters/mock/memory-secret-store.ts";
import { createMockAiProvider } from "../../adapters/mock/mock-ai-provider.ts";
import { aiKeyStatus, checkAiKey, saveAiKey } from "../../services/connect-ai.ts";
import { createScanRunner } from "../../services/scan-with-stored-key.ts";
import { summarizePrds } from "../../services/summarize-prds.ts";
import type { AppServices } from "./handlers.ts";
import { createPickedFolders, NOT_PICKED } from "./picked-folders.ts";

/**
 * The app's composition root (like src/cli/compose.ts): the only place it creates adapters and hands them to
 * services. Electron's own objects come in as arguments, so this file stays testable.
 */
export function composeApp(env: {
  readonly userDataDir: string;
  readonly safeStorage: SafeStorageLike;
  readonly pickFolder: AppServices["pickFolder"];
  /** Electron's shell.openExternal: opens a URL in the user's default browser. */
  readonly openExternal: (url: string) => Promise<void>;
  /**
   * Development without a real key (main decides: AUTOAI_MOCK_AI=1 and not packaged). The mock AI and a memory-only
   * SecretStore replace the real ones, so a mock key never reaches the OS keychain or a real one.
   */
  readonly mockAi: boolean;
  /** Tests only: serves the AI provider's network calls (the app uses the real network). */
  readonly fetch?: typeof globalThis.fetch;
}): AppServices {
  const mockAi = env.mockAi;
  const secretStore = mockAi
    ? createMemorySecretStore()
    : createSafeStorageSecretStore({
        safeStorage: env.safeStorage,
        file: join(env.userDataDir, "secrets", "ai-key.bin"),
      });
  const repoReader = createFsRepoReader();
  const aiProviderFor = (apiKey: string) =>
    mockAi
      ? createMockAiProvider({ apiKey })
      : createClaudeAiProvider({
          apiKey,
          ...(env.fetch === undefined ? {} : { fetch: env.fetch, maxRetries: 0 }),
        });
  const scanRunner = createScanRunner({ secretStore, repoReader, aiProviderFor });
  // Main reads only the folders the user picked in the dialog (ADR 0007), whatever path a screen sends.
  const picked = createPickedFolders();
  return {
    aiStatus: () => aiKeyStatus({ secretStore }),
    saveAiKey: (key) => saveAiKey({ secretStore, aiProviderFor }, { key }),
    checkAiKey: () => checkAiKey({ secretStore, aiProviderFor }),
    mockAi,
    pickFolder: async (purpose) => {
      const path = await env.pickFolder(purpose);
      if (path !== null) picked.remember(purpose, path);
      return path;
    },
    readPrds: async (prdFolder) =>
      picked.allows("prds", prdFolder) ? summarizePrds({ repoReader }, { prdFolder }) : NOT_PICKED,
    openLink: async (url) => {
      try {
        await env.openExternal(url);
        return { ok: true, value: undefined };
      } catch (e) {
        return {
          ok: false,
          error: { code: "LINK_NOT_OPENED", message: e instanceof Error ? e.message : String(e) },
        };
      }
    },
    scan: async (input) => (picked.allowsScan(input) ? scanRunner.scan(input) : NOT_PICKED),
  };
}
