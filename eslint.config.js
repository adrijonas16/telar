import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/core/validate/vendor/**",
      // Vendored from the agentify-website skill, unchanged:
      "public/runtime/**",
      "public/bridge/**",
      "tools/agentify/**",
    ],
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: { globalThis: "readonly", console: "readonly" } },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/core/**/*.ts"],
    rules: {
      // The core must stay framework- and DOM-free so it can run in Node, workers and tests.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["lit", "lit/*", "**/ui/**", "**/persistence/**"],
              message: "core/ must not depend on UI or browser storage.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "document", "window", "localStorage"],
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
);
