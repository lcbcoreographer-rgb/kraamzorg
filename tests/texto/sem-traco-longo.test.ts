import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CLAUDE.md, "Texto de interface": sem travessão e sem meia-risca em nenhum
 * texto de interface. A revisão final (P53) achou um sinal de menos
 * tipográfico (U+2212) no desconto do recibo da proposta: na tela ele tem a
 * mesma cara de uma meia-risca, e o formatador de moeda do projeto
 * (`src/lib/formatacao/moeda.ts`) já escreve o negativo com hífen.
 *
 * Este teste varre os componentes de tela (`src/**\/*.tsx`) e falha se
 * aparecer travessão (U+2014), meia-risca (U+2013) ou sinal de menos
 * (U+2212) fora de comentário. `ARQUIVOS_PERMITIDOS` lista quem usa o
 * caractere como código, e não como texto.
 */
const RAIZ_SRC = join(__dirname, "..", "..", "src");

const PROIBIDOS = /[\u2014\u2013\u2212]/;

const ARQUIVOS_PERMITIDOS: Record<string, string> = {
  // expressão regular que detecta travessão no texto digitado pela equipe
  "modules/configuracoes/componentes/formulario-mensagem.tsx":
    "regex de detecção",
};

function listarTsx(diretorio: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      saida.push(...listarTsx(caminho));
    } else if (caminho.endsWith(".tsx") && !caminho.includes(".test.")) {
      saida.push(caminho);
    }
  }
  return saida;
}

/**
 * Tira comentários de bloco e de linha, sem mexer em `://` de endereço. O
 * comentário de bloco vira só as quebras de linha dele, para o número da
 * linha do achado continuar certo.
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("texto de interface sem travessão, meia-risca ou sinal de menos", () => {
  const arquivos = listarTsx(RAIZ_SRC).filter(
    (a) => !(relative(RAIZ_SRC, a) in ARQUIVOS_PERMITIDOS),
  );

  it("encontrou componentes para checar", () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("nenhum componente escreve U+2014, U+2013 ou U+2212", () => {
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const linhas = semComentarios(readFileSync(arquivo, "utf-8")).split("\n");
      linhas.forEach((linha, i) => {
        if (PROIBIDOS.test(linha)) {
          achados.push(`${relative(RAIZ_SRC, arquivo)}:${i + 1}`);
        }
      });
    }
    expect(achados).toEqual([]);
  });
});
