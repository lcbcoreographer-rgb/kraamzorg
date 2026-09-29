import {
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { entrarComo } from "../e2e/apoio/entrar";

/** Ids das famílias e visitas fictícias (src/lib/dados/demonstracao/equipe-fixtures.ts). */
const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${String(grupo).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

export const ID_PROFISSIONAL_SUL_2 = id(30, 2);
export const ID_ACOMPANHAMENTO_JADE = id(31, 2);
/** Maré: D2 hoje (confirmada), D3 amanhã, D4 depois de amanhã. */
export const ID_VISITA_MARE_D2 = id(33, 2);
export const ID_VISITA_MARE_D3 = id(33, 3);
export const ID_VISITA_MARE_D4 = id(33, 4);

/** "aaaa-mm-dd" de hoje em Brasília, como o servidor calcula. */
export function hojeEmBrasilia(deslocamentoDias = 0): string {
  const base = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(base);
}

/** Abre outra pessoa em outro contexto do mesmo navegador (mesmo servidor). */
export async function abrirComo(
  browser: Browser,
  info: TestInfo,
  rotulo: string,
): Promise<Page> {
  const contexto = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: info.project.use.viewport ?? undefined,
  });
  const pagina = await contexto.newPage();
  await entrarComo(pagina, rotulo);
  return pagina;
}

/** O selo de estado de uma profissional na tela de Equipe, visto pela coordenação. */
export async function estadoNaEquipe(
  page: Page,
  profissionalId = ID_PROFISSIONAL_SUL_2,
) {
  await page.goto("/equipe");
  const cartao = page.locator(`[data-profissional="${profissionalId}"]`);
  await expect(cartao).toBeVisible();
  const selo = cartao.getByText(
    /^(Em visita|Em atendimento|Reservada|Backup|Oferta pendente|Folga|Livre|Inativa)$/,
  );
  return (await selo.first().textContent())?.trim() ?? "";
}
