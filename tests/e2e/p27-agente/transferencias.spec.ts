import { expect, test, type Page } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 item 2 · Fila de transferências, modo demonstração. Desde 30/09 a
 * fila mora dentro das conversas (pedido do dono): `/transferencias` leva
 * para `/conversas?filtro=esperando`, a lista mostra quem espera alguém
 * por prioridade e prazo, e a transferência aberta aparece numa faixa no
 * topo da conversa, com as ações da antiga fila (assumir, reenviar o
 * aviso, marcar como resolvida).
 *
 * A Família Teste Cedro nasce com o handoff `condicao_comercial` aberto e
 * o aviso ao grupo marcado como falho (`src/modules/agente/loja-extra.ts`,
 * só na demonstração, para este estado ter exemplo).
 *
 * `porProjeto`: o teste que assume e resolve usa um motivo diferente por
 * projeto (condição comercial da Cedro e a perda da Bruma, os dois únicos
 * handoffs "aberto" com conversa no seed) para celular e computador não
 * brigarem pela mesma linha (mesmo padrão de
 * `tests/e2e/p18-tarefas/tarefas.spec.ts`).
 *
 * `serial`: dentro do projeto, a lista confere a faixa vermelha antes de o
 * "Reenviar aviso" tirá-la, e o "Assumir" resolve a transferência da Cedro
 * só depois dos dois (no mesmo servidor, a loja em memória é uma só).
 */
test.describe.configure({ mode: "serial" });

/** A linha da lista que tem este motivo de transferência. */
function linhaDoMotivo(page: Page, motivo: string) {
  return page.getByRole("link").filter({
    has: page.getByText(motivo, { exact: true }),
  });
}

test("/transferencias leva à lista 'Esperando alguém', por prioridade e prazo, com o aviso que falhou, e é acessível", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/transferencias");

  await expect(page).toHaveURL(/\/conversas\?filtro=esperando$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Conversas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Esperando alguém/ }),
  ).toHaveAttribute("aria-pressed", "true");

  const cedro = linhaDoMotivo(page, "Pediu condição especial");
  await expect(cedro).toBeVisible();
  // Aceite do P27: a transferência aparece com o prazo, em frase.
  await expect(cedro.getByText(/vence em|venceu há/)).toBeVisible();
  await expect(cedro.getByText("Aviso não saiu")).toBeVisible();
  // Prioridade máxima (perda) vem antes da normal (condição comercial).
  const linhas = await page.getByRole("link").allTextContents();
  const perda = linhas.findIndex((texto) =>
    texto.includes("Perda gestacional"),
  );
  const condicao = linhas.findIndex((texto) =>
    texto.includes("Pediu condição especial"),
  );
  expect(perda).toBeGreaterThanOrEqual(0);
  expect(perda).toBeLessThan(condicao);

  // Na conversa, a faixa da transferência traz a falha com "Reenviar aviso".
  await cedro.click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+\?filtro=esperando$/);
  const faixa = page.getByRole("region", { name: "Transferência aberta" });
  await expect(faixa.getByText("Pediu condição especial")).toBeVisible();
  await expect(faixa.getByText("O aviso ao grupo não saiu")).toBeVisible();

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("Reenviar aviso tira a faixa vermelha (ação idempotente, sem risco de colisão)", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/transferencias");
  await linhaDoMotivo(page, "Pediu condição especial").click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+/);

  const faixa = page.getByRole("region", { name: "Transferência aberta" });
  await faixa.getByRole("button", { name: "Reenviar aviso" }).click();

  await expect(faixa.getByText("O aviso ao grupo não saiu")).toHaveCount(0);
});

test("Assumir conversa pausa a Isadora, fica na conversa, e Marcar como resolvida fecha com o desfecho", async ({
  page,
}, info) => {
  const motivo = porProjeto(
    info,
    "Pediu condição especial",
    "Perda gestacional",
  );
  await entrarComo(page, porProjeto(info, "Comercial", "Coordenação"));
  await page.goto("/transferencias");
  await linhaDoMotivo(page, motivo).click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+/);

  const transferencia = page.getByRole("region", {
    name: "Transferência aberta",
  });
  await transferencia.getByRole("button", { name: "Assumir conversa" }).click();

  // Fluxo E, item 3: assumir mantém a IA sem responder, na própria
  // conversa. Na perda, a família está com o freio em bloqueio total: a
  // Isadora está desligada, não só pausada (DESIGN.md, 11.8; camada de
  // acolhimento).
  await expect(transferencia.getByText(/Assumida/)).toBeVisible();
  await expect(
    page.getByText(
      porProjeto(
        info,
        "Isadora pausada nesta conversa",
        "A Isadora está desligada para esta família",
      ),
    ),
  ).toBeVisible();

  await transferencia
    .getByRole("button", { name: "Marcar como resolvida" })
    .click();
  await transferencia.getByLabel("Sem retorno").check();
  await transferencia
    .getByRole("button", { name: "Marcar como resolvida" })
    .last()
    .click();

  await expect(
    page.getByRole("region", { name: "Transferência aberta" }),
  ).toHaveCount(0);
  await expect(page.getByText(/não deu certo/i)).toHaveCount(0);
});
