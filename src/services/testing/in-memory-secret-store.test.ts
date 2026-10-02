import { describe, it } from "vitest";
import { inMemorySecretStore } from "./in-memory-secret-store.ts";
import { secretStoreContract } from "./secret-store-contract.ts";

describe("inMemorySecretStore keeps the SecretStore contract", () => {
  for (const [name, check] of secretStoreContract(() => inMemorySecretStore())) it(name, check);
});
