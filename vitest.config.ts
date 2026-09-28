import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The repo has no tests until the first core module lands; an empty run must not fail verify.
    passWithNoTests: true,
  },
});
