import type { TestInfo } from "@playwright/test";

/**
 * Mesmo padrão de `tests/e2e/p13-configuracoes/apoio.ts` (lido como
 * referência, não importado: cada pasta de módulo tem a própria cópia). O
 * servidor de teste é um só processo com a loja em memória compartilhada
 * entre os projetos "celular" e "computador" (`playwright.config.ts`), que
 * podem rodar em paralelo; um teste que grava (freio, não contatar, data)
 * usa uma família diferente por projeto para não colidir.
 */
export function porProjeto<T>(info: TestInfo, celular: T, computador: T): T {
  return info.project.name === "celular" ? celular : computador;
}
