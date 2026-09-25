import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` só existe para barrar em build (Next.js) um módulo
      // de servidor importado do cliente; sob Vitest sempre lançaria, sem
      // servir a nenhum propósito de teste (tests/vazio-server-only.ts).
      "server-only": path.resolve(__dirname, "tests/vazio-server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    // "**/node_modules/**" (não só "node_modules/**") para não varrer
    // node_modules aninhado, como o de n8n/referencia (n8n/build.test.mjs
    // roda por node --test, não por Vitest).
    exclude: ["**/node_modules/**", "tests/e2e/**", "tests/e2e-offline/**"],
  },
});
