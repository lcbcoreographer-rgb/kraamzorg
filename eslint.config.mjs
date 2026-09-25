import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gerado ou de outra sessão, fora do escopo do lint:
    "n8n/dist/**",
    "playwright-report/**",
    "playwright-report-offline/**",
    "test-results/**",
    "test-results-offline/**",
    "coverage/**",
    "docs/prototipo/**",
  ]),
]);

export default eslintConfig;
