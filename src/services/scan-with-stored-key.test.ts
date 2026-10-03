import { describe, expect, it } from "vitest";
import { ApiKey } from "../core/domain/api-key.ts";
import type { ScanProgress } from "../core/domain/scan-progress.ts";
import type { AiProvider } from "../core/ports/ai-provider.ts";
import { createScanRunner } from "./scan-with-stored-key.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";
import { inMemorySecretStore } from "./testing/in-memory-secret-store.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";

const repoReader = inMemoryRepoReader({
  repo: { "src/a.js": "export const a = 1;" },
  // Empty: no requirements and nothing for Claude to read, so these scans make no AI call.
  prds: { "x.md": "" },
});
const input = { repoRoot: "repo", prdFolder: "prds" };

describe("createScanRunner", () => {
  it("scans with a provider built for the saved key, passing progress through", async () => {
    const keys: string[] = [];
    const seen: ScanProgress[] = [];
    const runner = createScanRunner({
      secretStore: inMemorySecretStore(ApiKey.parse("sk-saved")),
      repoReader,
      aiProviderFor: (k) => {
        keys.push(k);
        return scriptedAiProvider();
      },
    });
    const result = await runner.scan({ ...input, onProgress: (p) => seen.push(p) });
    expect(result.ok).toBe(true);
    expect(keys).toStrictEqual(["sk-saved"]);
    expect(seen.at(-1)).toStrictEqual({ stage: "done" });
  });

  it("one scan at a time: SCAN_BUSY while one runs, and the next is allowed after it", async () => {
    let release: (() => void) | undefined;
    const slowStore = inMemorySecretStore(ApiKey.parse("sk-saved"));
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner = createScanRunner({
      secretStore: {
        ...slowStore,
        load: async () => {
          await gate;
          return slowStore.load();
        },
      },
      repoReader,
      aiProviderFor: (): AiProvider => scriptedAiProvider(),
    });
    const first = runner.scan(input);
    const second = await runner.scan(input);
    expect(second.ok ? null : second.error.code).toBe("SCAN_BUSY");
    release?.();
    expect((await first).ok).toBe(true);
    expect((await runner.scan(input)).ok).toBe(true);
  });

  it("NO_KEY when nothing is saved: no scan, no provider, and not left busy", async () => {
    const runner = createScanRunner({
      secretStore: inMemorySecretStore(),
      repoReader,
      aiProviderFor: () => {
        throw new Error("must not be built");
      },
    });
    const result = await runner.scan(input);
    expect(result.ok ? null : result.error.code).toBe("NO_KEY");
    const again = await runner.scan(input);
    expect(again.ok ? null : again.error.code).toBe("NO_KEY");
  });

  it("passes a store failure on", async () => {
    const runner = createScanRunner({
      secretStore: inMemorySecretStore(null, { code: "SECRET_STORE_FAILED", message: "disk" }),
      repoReader,
      aiProviderFor: () => scriptedAiProvider(),
    });
    const result = await runner.scan(input);
    expect(result.ok ? null : result.error.code).toBe("SECRET_STORE_FAILED");
  });
});
