import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceFiles = [
  "client/src/**/*.{ts,tsx}",
  "server/**/*.ts",
  "shared/**/*.ts",
  "drizzle/**/*.ts",
  "scripts/**/*.ts",
  "vite.config.ts",
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "client/src/components/ui/**",
      "client/src/pages/ComponentShowcase.tsx",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: sourceFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: sourceFiles.filter((file) => !file.startsWith("client/")),
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
