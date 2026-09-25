import type { TestInfo } from "@playwright/test";

/**
 * Desde a integração do CRM, cada projeto do Playwright (celular e
 * computador) tem o próprio servidor e a própria loja em memória
 * (`playwright.config.ts`). Usar uma linha por projeto num teste que grava
 * dado (parâmetro, pacote, mensagem) continua valendo como cinto de
 * segurança: o teste não depende de rodar sozinho, e rodar com
 * `reuseExistingServer` contra um servidor só também funciona. Dado só
 * lido (sem escrita) não precisa disto.
 */
export function porProjeto<T>(info: TestInfo, celular: T, computador: T): T {
  return info.project.name === "celular" ? celular : computador;
}
