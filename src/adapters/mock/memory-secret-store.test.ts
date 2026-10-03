import { describe, it } from "vitest";
import { secretStoreContract } from "../../services/testing/secret-store-contract.ts";
import { createMemorySecretStore } from "./memory-secret-store.ts";

describe("createMemorySecretStore keeps the SecretStore contract", () => {
  for (const [name, check] of secretStoreContract(() => createMemorySecretStore())) it(name, check);
});
