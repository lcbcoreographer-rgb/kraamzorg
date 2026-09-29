import { defineConfig } from "@playwright/test";

/**
 * Roda o `tests/agente/roteiro.spec.ts` (o mesmo do ambiente de homologação)
 * contra o servidor simulado local (`tests/agente/local/servidor-simulado.ts`):
 * webhook, captura da UAZAPI e modelo roteirizado, sobre o Postgres de
 * supabase/sem-docker. Prova o executor e as regras do roteiro; não prova a
 * Isadora. O aceite de 24 de 24 só vale no ambiente real.
 *
 *   KZ_HOMOLOG_PGPORT=54393 pnpm e2e:homologacao:simulada
 */
export default defineConfig({
  testDir: "./tests/agente",
  testMatch: "roteiro.spec.ts",
  globalSetup: "./tests/agente/local/global-setup-simulado.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/homologacao-simulada",
});
