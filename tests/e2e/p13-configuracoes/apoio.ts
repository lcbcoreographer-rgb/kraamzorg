import type { TestInfo } from "@playwright/test";

/**
 * O servidor de teste é um só processo, com a loja em memória do modo
 * demonstração compartilhada entre os dois projetos do Playwright (celular
 * e computador, `playwright.config.ts`), que podem rodar em paralelo. Para
 * um teste que grava dado (parâmetro, pacote, mensagem), usar uma linha por
 * projeto evita que os dois pisem no mesmo registro ao mesmo tempo. Dado só
 * lido (sem escrita) não precisa disto.
 */
export function porProjeto<T>(info: TestInfo, celular: T, computador: T): T {
  return info.project.name === "celular" ? celular : computador;
}
