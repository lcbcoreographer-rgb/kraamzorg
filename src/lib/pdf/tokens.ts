/**
 * Cores do documento PDF: os nove primitivos de `src/app/globals.css`
 * (CLAUDE.md, "Design"; PRD 20.2), copiados aqui em hexadecimal porque
 * `@react-pdf/renderer` não lê CSS nem `color-mix()` do navegador. Nenhum
 * valor novo: se um destes mudar em `globals.css`, muda aqui também (mesmo
 * acordo já feito para `docs/prototipo/assets/tokens.css`, ver o comentário
 * no topo de `globals.css`).
 */
export const CORES = {
  marinho: "#0f1f36",
  dourado: "#bc9c5d",
  areia: "#e8dac5",
  creme: "#fcf8ed",
  branco: "#ffffff",
  sucesso: "#4b7358",
  aviso: "#b5822a",
  alerta: "#9e4438",
  sensivel: "#63557a",
} as const;

/**
 * Derivados usados no PDF (`color-mix(in srgb, var(--marinho) X%, var(--creme))`
 * de `globals.css`, calculados aqui porque `@react-pdf/renderer` não roda
 * `color-mix()`; conferido por `tokens.test.ts` contra a mesma fórmula).
 */
/** `--marinho-72`: texto de apoio (rótulo de seção). */
export const MARINHO_72 = "#515c69";
/** `--marinho-62`: texto de apoio secundário (rodapé, legenda). */
export const MARINHO_62 = "#69717c";
/** `--marinho-14`: linha divisória fina entre seções. */
export const MARINHO_14 = "#dbdad3";
