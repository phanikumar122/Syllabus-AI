import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "output/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx,js}", "server/**/*.mjs"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        location: "readonly",
        matchMedia: "readonly",
        confirm: "readonly",
        crypto: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        structuredClone: "readonly",
        TextEncoder: "readonly",
        File: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        KeyboardEvent: "readonly",
        BeforeUnloadEvent: "readonly",
        ImportMeta: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
