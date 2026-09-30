import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import guarded from "./coverage-thresholds.json" with { type: "json" };

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          // fixtures/*.test.mjs sit outside fixtures/sample-repo so the scan engine never reads them.
          include: ["src/**/*.test.ts", "fixtures/*.test.mjs"],
          exclude: ["src/ui/**"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["src/ui/test-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Listing every source file (not only those a test imports) makes an untested file count as 0%.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.tsx"],
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
