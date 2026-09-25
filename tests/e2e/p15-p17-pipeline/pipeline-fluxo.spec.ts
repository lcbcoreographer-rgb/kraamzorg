import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";

/**
 * P15 · Pipeline 1 (entrada e qualificação): leva um lead de "novo" a
 * "sessao_venda_agendada" só pelas transições que a tela oferece (PRD 7.1).
 * Roda no celular e no computador (playwright.config.ts).
 *
 * `serial`: os dois primeiros testes leem e depois mudam o estágio da
 * mesma família do seed (Família Teste Aurora, a única que nasce "novo"),
 * sobre a loja de demonstração compartilhada do processo do servidor
 * (src/lib/dados/demonstracao/loja.ts). Em série, sem corrida entre eles.
 */

test.describe.serial("Pipeline 1: mudança de estágio", () => {
  test("transição proibida não aparece no menu (PRD 7: só o que privado.transicao_permitida prevê)", async ({
    page,
  }) => {
    await entrarComo(page, "Comercial");
    // Família Teste Aurora nasce em "novo".
    await page.goto("/pipeline?pipeline=1&busca=Aurora");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pipeline" }),
    ).toBeVisible();
    await semViolacaoGrave(page);

    await page.getByRole("button", { name: "Mover para" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Sessão agendada" }),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("menuitem", { name: "Sessão realizada" }),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("menuitem", { name: "Em conversa" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Perdido, com motivo" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("leva a Família Teste Aurora de novo a sessão agendada, só pelos passos permitidos", async ({
    page,
  }) => {
    await entrarComo(page, "Comercial");
    await page.goto("/pipeline?pipeline=1&busca=Aurora");
    await expect(
      page.getByText("Família Teste Aurora").filter({ visible: true }),
    ).toBeVisible();

    async function mover(destino: string) {
      // O botão fica desabilitado enquanto a Server Action está em
      // andamento (MenuMover), então o clique seguinte já espera a
      // transição anterior terminar (auto-espera do Playwright).
      await page.getByRole("button", { name: "Mover para" }).click();
      await page.getByRole("menuitem", { name: destino, exact: true }).click();
    }

    await mover("Em conversa");
    await mover("Qualificado");
    await mover("Sessão agendada");

    // A "Sessão agendada" é o novo estágio dela; a lista continua mostrando
    // só a Aurora (busca ainda ativa).
    await expect(page.getByText("Sessão agendada").first()).toBeVisible();
    await expect(
      page.getByText("Família Teste Aurora").filter({ visible: true }),
    ).toBeVisible();
  });
});

test("perda exige motivo: sem escolher, mostra o aviso e não sai do estágio", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  // Família Teste Cedro nasce "qualificado", que tem desvio para perdido.
  // Independente do describe acima: não toca na Aurora.
  await page.goto("/pipeline?pipeline=1&busca=Cedro");
  await page.getByRole("button", { name: "Mover para" }).click();
  await page.getByRole("menuitem", { name: "Perdido, com motivo" }).click();

  await expect(
    page.getByRole("heading", { name: "Marcar como perdido" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Marcar como perdido", exact: true })
    .click();
  await expect(
    page.getByText("Escolha um motivo. Ele alimenta o relatório de perdas."),
  ).toBeVisible();

  await page.getByLabel("Preço").click();
  await page
    .getByRole("button", { name: "Marcar como perdido", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Marcar como perdido" }),
  ).toBeHidden();
});
