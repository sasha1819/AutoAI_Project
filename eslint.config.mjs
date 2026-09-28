import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["node_modules/", "dist/", "coverage/", "fixtures/", ".claude/", ".remember/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Core is deterministic: time and randomness must come in through the Clock/Ids ports.
    files: ["src/core/**/*.ts"],
    ignores: ["src/core/**/*.test.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Pass time in (Clock port)." },
        { object: "Math", property: "random", message: "Pass randomness in (Ids port)." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Pass time in (Clock port).",
        },
        { selector: "CallExpression[callee.name='Date']", message: "Pass time in (Clock port)." },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", module: "writable" },
    },
  },
  prettier,
);
