import { defineConfig } from "@playwright/test";

/**
 * Configuração do roteiro de homologação da Isadora (P28,
 * `tests/agente/roteiro.spec.ts`). Sem navegador e sem servidor local: o
 * roteiro conversa com o webhook do fluxo 3 de homologação, com a rota de
 * captura do app de homologação e com o banco de homologação, todos por
 * variáveis de ambiente (`tests/agente/hml/ambiente.ts`). Sem elas, os casos
 * são pulados com a lista do que falta.
 *
 * Um worker só: a captura da UAZAPI é uma loja única do app, e cada caso
 * limpa a loja antes de começar.
 */
export default defineConfig({
  testDir: "./tests/agente",
  testMatch: "roteiro.spec.ts",
  globalSetup: "./tests/agente/hml/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/homologacao",
});
