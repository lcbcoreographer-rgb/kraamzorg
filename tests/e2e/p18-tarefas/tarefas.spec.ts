import { expect, test } from "@playwright/test";
import { entrarComo, semRolagemLateral, semViolacaoGrave } from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P18 item 2 · Tela de tarefas (`/tarefas`), modo demonstração
 * (playwright.config.ts, `KZ_DADOS=demonstracao`). O seed de tarefas
 * (`src/lib/dados/demonstracao/fixtures.ts`, `TAREFAS`) hoje só tem
 * tarefas internas: o repositório de demonstração da fundação sempre
 * devolve `payload: {}` (`src/lib/dados/demonstracao/index.ts`,
 * `listarTarefas`), então nenhuma delas tem texto sugerido nem telefone
 * ainda — "Abrir no WhatsApp" e "Enviei" não têm o que exercitar por
 * aqui. Esse fluxo está coberto de ponta a ponta em
 * `src/modules/mensageria/tarefas/componentes/cartao-tarefa.test.tsx`
 * (Vitest, com uma tarefa construída com o payload que o contrato pede) e
 * em `acoes.test.ts`. Aqui: a lista, o agrupamento, o "Concluir" (tarefa
 * sem WhatsApp) e o recorte por pessoa e por papel.
 *
 * `serial` e `porProjeto`: celular e computador rodam contra o mesmo
 * servidor de demonstração, com a mesma loja em memória compartilhada
 * (`tests/e2e/p13-configuracoes/apoio.ts`); cada projeto conclui uma
 * tarefa diferente para não brigar pela mesma linha.
 */
test.describe.serial("Tarefas do comercial", () => {
  test("lista, agrupa por vencimento e é acessível", async ({ page }) => {
    await entrarComo(page, "Comercial");
    await page.goto("/tarefas");

    await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible();
    await expect(
      page.getByText("Retomar a conversa com a Família Teste Cedro"),
    ).toBeVisible();
    await expect(
      page.getByText("Conferir o formulário do contrato da Família Teste Horizonte"),
    ).toBeVisible();
    // Tarefa do papel coordenação não aparece para o comercial.
    await expect(
      page.getByText("Agendar a consulta pré-natal da Família Teste Íris"),
    ).toHaveCount(0);

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("Concluir tira a tarefa interna da lista", async ({ page }, info) => {
    const titulo = porProjeto(
      info,
      "Retomar a conversa com a Família Teste Cedro",
      "Conferir o formulário do contrato da Família Teste Horizonte",
    );
    await entrarComo(page, "Comercial");
    await page.goto("/tarefas");

    // Sobe até o cartão (o container com a classe do componente Cartao),
    // para não misturar com o botão "Concluir" de outra tarefa na mesma tela.
    const cartao = page
      .getByRole("heading", { name: titulo })
      .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
    await expect(cartao).toBeVisible();
    await cartao.getByRole("button", { name: "Concluir" }).click();

    await expect(page.getByText(titulo)).toHaveCount(0);
  });
});

test("a coordenação vê a tarefa do próprio papel", async ({ page }) => {
  await entrarComo(page, "Coordenacao");
  await page.goto("/tarefas");

  await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible();
  await expect(
    page.getByText("Agendar a consulta pré-natal da Família Teste Íris"),
  ).toBeVisible();
});
