/**
 * Fontes locais (P10, a partir de docs/design/DESIGN.md, seção 4).
 * Arquivos .woff2 copiados de docs/prototipo/assets/fonts (licença SIL OFL 1.1),
 * subconjunto "latin": cobre todo acento do português (U+00C0 a U+00FF), então
 * o subconjunto "latin-ext" não entra aqui.
 *
 * As variáveis geradas (--font-jost, --font-inter, --font-mono) são consumidas
 * pelo @theme de globals.css. Nenhuma outra tela importa fonte diretamente.
 */
import localFont from "next/font/local";

export const jost = localFont({
  src: [
    { path: "./fonts/jost-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jost-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-jost",
  display: "swap",
});

export const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});
