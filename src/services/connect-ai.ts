import { ApiKey } from "../core/domain/api-key.ts";
import type { DomainError } from "../core/domain/domain-error.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { AiErrorCode, AiProvider } from "../core/ports/ai-provider.ts";
import type { SecretStore, SecretStoreErrorCode } from "../core/ports/secret-store.ts";

type Deps = {
  readonly secretStore: SecretStore;
  /** Builds the user's AI provider for a key (the composition root decides which). */
  readonly aiProviderFor: (key: ApiKey) => AiProvider;
};

/** Whether a key is saved. The key itself never leaves the main process (ADR 0007). */
export async function aiKeyStatus(
  deps: Pick<Deps, "secretStore">,
): Promise<Result<{ readonly configured: boolean }, DomainError<SecretStoreErrorCode>>> {
  const loaded = await deps.secretStore.load();
  return loaded.ok ? ok({ configured: loaded.value !== null }) : loaded;
}

export type SaveAiKeyError = DomainError<"KEY_INVALID" | AiErrorCode | SecretStoreErrorCode>;

/**
 * Saves a key the user typed, but only once the AI provider accepts it (PRD Flow 1: validate, then store), so a
 * saved key is a key that worked: "configured" never means a key that was never checked. The check spends no
 * tokens (verifyAccess).
 */
export async function saveAiKey(
  deps: Deps,
  input: { readonly key: string },
): Promise<Result<undefined, SaveAiKeyError>> {
  const parsed = ApiKey.safeParse(input.key);
  if (!parsed.success) {
    return err({
      code: "KEY_INVALID",
      message: parsed.error.issues[0]?.message ?? "not an API key",
    });
  }
  const works = await deps.aiProviderFor(parsed.data).verifyAccess();
  if (!works.ok) return works;
  return deps.secretStore.save(parsed.data);
}

export type CheckAiKeyError = DomainError<"NO_KEY" | AiErrorCode | SecretStoreErrorCode>;

/** Asks the AI provider whether the saved key still works (e.g. revoked since it was saved), without spending tokens. */
export async function checkAiKey(deps: Deps): Promise<Result<undefined, CheckAiKeyError>> {
  const loaded = await deps.secretStore.load();
  if (!loaded.ok) return loaded;
  if (loaded.value === null) return err({ code: "NO_KEY", message: "No API key is saved yet." });
  return deps.aiProviderFor(loaded.value).verifyAccess();
}
