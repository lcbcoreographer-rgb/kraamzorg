import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // "server-only" lança erro de propósito fora da condição
      // react-server (Next.js). O Vitest roda em jsdom, sem essa condição;
      // troca pelo stub vazio só nos testes (vitest.stub-server-only.ts).
      "server-only": fileURLToPath(
        new URL("./vitest.stub-server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    // "**/node_modules/**" (não só "node_modules/**") para não varrer
    // node_modules aninhado, como o de n8n/referencia. Os testes do n8n
    // (n8n/**/*.test.mjs) usam node:test e rodam por `node --test`, não por
    // Vitest (CLAUDE.md, "Comandos").
    exclude: [
      "**/node_modules/**",
      "tests/e2e/**",
      "tests/e2e-offline/**",
      // Worktrees de outras sessões em paralelo.
      ".claude/**",
      // Testes do n8n são do node:test (node --test n8n/*.test.mjs, CLAUDE.md).
      "n8n/**",
    ],
  },
});
