import "server-only";

/**
 * Fontes do documento PDF (CLAUDE.md, "Design": Jost nos títulos, Inter no
 * corpo, IBM Plex Mono nos dados). Os arquivos em `fontes-arquivos/` são o
 * mesmo Jost/Inter/IBM Plex Mono de `src/app/fonts`, só reempacotados de
 * woff2 para TTF puro por `scripts/gerar-fontes-pdf.py` (mesmo glifo, mesma
 * métrica): `fontkit@2.0.4` (usado por baixo do @react-pdf/renderer)
 * reconstrói errado a tabela `glyf`/`loca` de um woff2 quando o PDF usa
 * mais de oito glifos distintos de uma fonte e derruba a geração
 * ("RangeError: Offset is outside the bounds of the DataView", bug de
 * terceiro; ver o cabeçalho do script). O TTF simples não passa por essa
 * reconstrução.
 *
 * `@react-pdf/renderer` roda no servidor: registra as fontes por caminho de
 * arquivo, uma vez por processo (`Font.register` é idempotente por
 * família, mas evitamos registrar de novo a cada PDF).
 */
import path from "node:path";
import { Font } from "@react-pdf/renderer";

const DIRETORIO_FONTES = path.join(
  process.cwd(),
  "src/lib/pdf/fontes-arquivos",
);

export const FAMILIA_TITULO = "Jost";
export const FAMILIA_CORPO = "Inter";
export const FAMILIA_DADO = "IBM Plex Mono";

let registrado = false;

/** Chame antes de renderizar qualquer documento (`gerar.ts` chama sozinho). Idempotente. */
export function registrarFontesDocumento(): void {
  if (registrado) return;

  Font.register({
    family: FAMILIA_TITULO,
    fonts: [
      {
        src: path.join(DIRETORIO_FONTES, "jost-latin-400-normal.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(DIRETORIO_FONTES, "jost-latin-500-normal.ttf"),
        fontWeight: 500,
      },
    ],
  });

  Font.register({
    family: FAMILIA_CORPO,
    fonts: [
      {
        src: path.join(DIRETORIO_FONTES, "inter-latin-400-normal.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(DIRETORIO_FONTES, "inter-latin-500-normal.ttf"),
        fontWeight: 500,
      },
      {
        src: path.join(DIRETORIO_FONTES, "inter-latin-600-normal.ttf"),
        fontWeight: 600,
      },
    ],
  });

  Font.register({
    family: FAMILIA_DADO,
    fonts: [
      {
        src: path.join(DIRETORIO_FONTES, "ibm-plex-mono-latin-400-normal.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(DIRETORIO_FONTES, "ibm-plex-mono-latin-500-normal.ttf"),
        fontWeight: 500,
      },
    ],
  });

  // Hifenização automática do react-pdf quebra palavra médica composta de
  // um jeito estranho (por exemplo "puerpé-rio"); o documento é curto e
  // formal, melhor sem.
  Font.registerHyphenationCallback((palavra) => [palavra]);

  registrado = true;
}
