import { defineConfig } from "vitest/config";
import guarded from "./coverage-thresholds.json" with { type: "json" };

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The repo has no tests until the first core module lands; an empty run must not fail verify.
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      // Listing every source file (not only those a test imports) makes an untested file count as 0%.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: [["text", { skipFull: true }], "json-summary"],
      // A glob that matches no files passes silently; scripts/check-coverage-scope.mjs guards that.
      thresholds: Object.fromEntries(
        guarded.folders.map((folder) => [
          `${folder}/**`,
          { lines: guarded.lines, branches: guarded.branches },
        ]),
      ),
    },
  },
});
