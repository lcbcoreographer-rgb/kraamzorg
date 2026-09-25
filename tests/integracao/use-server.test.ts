// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Um arquivo "use server" só pode exportar funções assíncronas. Com
 * qualquer outro valor exportado (o objeto de estado inicial do
 * useActionState, por exemplo), o Next recusa o módulo inteiro em tempo de
 * execução e todos os botões da tela quebram com erro 500, sem o
 * typecheck, o lint nem os testes de unidade perceberem. As verificações
 * de P16, P18 e P27 acharam esse erro em cinco módulos; este teste varre o
 * app inteiro para ele não voltar.
 */
const RAIZ = join(__dirname, "..", "..");
const SRC = join(RAIZ, "src");

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)
      ? [caminho]
      : [];
  });
}

const USE_SERVER = arquivos(SRC).filter((caminho) =>
  /^\s*(\/\/[^\n]*\n\s*)*["']use server["']/.test(
    readFileSync(caminho, "utf8"),
  ),
);

// Exportações permitidas: função assíncrona, tipo e interface.
const PERMITIDA = /^export\s+(async\s+function|type|interface)\b/;

describe('arquivos "use server" exportam só funções assíncronas', () => {
  it("acha os arquivos de ação", () => {
    expect(USE_SERVER.length).toBeGreaterThan(0);
  });

  it.each(USE_SERVER.map((caminho) => relative(RAIZ, caminho)))(
    "%s",
    (caminho) => {
      const linhas = readFileSync(join(RAIZ, caminho), "utf8").split("\n");
      const proibidas = linhas
        .map((linha, indice) => ({ linha, numero: indice + 1 }))
        .filter(
          ({ linha }) => /^export\b/.test(linha) && !PERMITIDA.test(linha),
        )
        .map(({ linha, numero }) => `${numero}: ${linha}`);
      expect(proibidas).toEqual([]);
    },
  );
});
