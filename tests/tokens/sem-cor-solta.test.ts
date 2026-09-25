import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRD 20.1 / P10 item 6: nenhuma tela inventa cor fora de globals.css.
 * Este teste varre todo `src/` (menos `src/app/globals.css`, a única fonte
 * de tokens) e falha se aparecer cor em hexadecimal, rgb()/rgba() ou
 * hsl()/hsla() solta em qualquer arquivo .ts, .tsx ou .css.
 */
const RAIZ_SRC = join(__dirname, "..", "..", "src");
const ARQUIVO_PERMITIDO = join(RAIZ_SRC, "app", "globals.css");
const EXTENSOES = [".ts", ".tsx", ".css"];

const PADRAO_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PADRAO_RGB = /\brgba?\(/gi;
const PADRAO_HSL = /\bhsla?\(/gi;

function listarArquivos(diretorio: string): string[] {
  const entradas = readdirSync(diretorio);
  const arquivos: string[] = [];

  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada);
    const info = statSync(caminho);

    if (info.isDirectory()) {
      arquivos.push(...listarArquivos(caminho));
      continue;
    }

    if (EXTENSOES.some((extensao) => caminho.endsWith(extensao))) {
      arquivos.push(caminho);
    }
  }

  return arquivos;
}

describe("nenhuma cor solta fora de globals.css", () => {
  const arquivos = listarArquivos(RAIZ_SRC).filter((arquivo) => arquivo !== ARQUIVO_PERMITIDO);

  it("encontrou arquivos para checar (a varredura não ficou vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(10);
  });

  it.each(arquivos.map((arquivo) => [relative(RAIZ_SRC, arquivo), arquivo] as const))(
    "%s não declara cor em hexadecimal, rgb() ou hsl()",
    (_nomeRelativo, caminho) => {
      const conteudo = readFileSync(caminho, "utf-8");

      const hex = conteudo.match(PADRAO_HEX) ?? [];
      const rgb = conteudo.match(PADRAO_RGB) ?? [];
      const hsl = conteudo.match(PADRAO_HSL) ?? [];
      const achados = [...hex, ...rgb, ...hsl];

      expect(achados).toEqual([]);
    },
  );
});
