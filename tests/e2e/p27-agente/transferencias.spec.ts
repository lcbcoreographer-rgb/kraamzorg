import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 item 2 · Fila de transferências (`/transferencias`), modo
 * demonstração. Por prioridade e prazo, com faixa vermelha quando o aviso
 * ao grupo falhou (protótipo `comercial-inicio.html`).
 *
 * A Família Teste Cedro nasce com o handoff `condicao_comercial` aberto e
 * o aviso ao grupo marcado como falho (`src/modules/agente/loja-extra.ts`,
 * só na demonstração, para este estado ter exemplo).
 *
 * `porProjeto`: o teste que assume e resolve usa um motivo diferente por
 * projeto (condição comercial da Cedro e a perda da Bruma, os dois únicos
 * handoffs "aberto" do seed) para celular e computador não brigarem pela
 * mesma linha (mesmo padrão de `tests/e2e/p18-tarefas/tarefas.spec.ts`).
 *
 * `serial`: dentro do projeto, a lista confere a faixa vermelha antes de o
 * "Reenviar aviso" tirá-la, e o "Assumir" resolve a transferência da Cedro
 * só depois dos dois (no mesmo servidor, a loja em memória é uma só).
 */
test.describe.configure({ mode: "serial" });

test("lista por prioridade e prazo, com a faixa vermelha do aviso que falhou, e é acessível", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/transferencias");

  await expect(
    page.getByRole("heading", { level: 1, name: "Transferências" }),
  ).toBeVisible();
  const cedro = page
    .getByText("Pediu condição especial", { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await expect(cedro).toBeVisible();
  // Aceite do P27: a transferência aparece com o prazo, em frase.
  await expect(cedro.getByText(/vence em|venceu há/)).toBeVisible();
  await expect(page.getByText("O aviso ao grupo não saiu")).toBeVisible();
  // Prioridade máxima (perda) vem antes da normal (condição comercial).
  const motivos = await page
    .getByRole("heading", { level: 3 })
    .allTextContents();
  const perda = motivos.indexOf("Perda gestacional");
  if (perda >= 0)
    expect(perda).toBeLessThan(motivos.indexOf("Pediu condição especial"));

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("Reenviar aviso tira a faixa vermelha (ação idempotente, sem risco de colisão)", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/transferencias");

  const cartao = page
    .getByText("Pediu condição especial")
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await cartao.getByRole("button", { name: "Reenviar aviso" }).click();

  await expect(cartao.getByText("O aviso ao grupo não saiu")).toHaveCount(0);
});

test("Assumir conversa pausa a Isadora, abre a conversa, e Marcar como resolvida fecha com o desfecho", async ({
  page,
}, info) => {
  const motivo = porProjeto(
    info,
    "Pediu condição especial",
    "Perda gestacional",
  );
  await entrarComo(page, porProjeto(info, "Comercial", "Coordenação"));
  await page.goto("/transferencias");

  const cartao = page
    .getByText(motivo, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await cartao.getByRole("button", { name: "Assumir conversa" }).click();

  // Fluxo E, item 3: assumir mantém a IA pausada e abre a conversa.
  await page.waitForURL(/\/conversas\//);
  await expect(page.getByText("Isadora pausada nesta conversa")).toBeVisible();
  const transferencia = page.getByRole("region", {
    name: "Transferência aberta",
  });
  await expect(transferencia.getByText(/Assumida/)).toBeVisible();

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
