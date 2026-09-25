import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P18 item 2 · Tela de tarefas (`/tarefas`), modo demonstração
 * (playwright.config.ts, `KZ_DADOS=demonstracao`). O seed de tarefas
 * (`src/lib/dados/demonstracao/fixtures.ts`, `TAREFAS`) tem tarefas
 * internas e uma de follow-up com mensagem (Família Teste Dália), cujo
 * payload a loja monta a partir de `mensagem_modelo` e do telefone do
 * contato principal, como a automação do P20 vai gravar. Aqui: a lista, o
 * agrupamento, o link do WhatsApp da tarefa com mensagem, o "Concluir"
 * (tarefa sem WhatsApp) e o recorte por pessoa e por papel. O "Enviei"
 * está coberto no Vitest (`acoes.test.ts`, `cartao-tarefa.test.tsx`).
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

    await expect(
      page.getByRole("heading", { level: 1, name: "Tarefas" }),
    ).toBeVisible();
    await expect(
      page.getByText("Retomar a conversa com a Família Teste Cedro"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Conferir o formulário do contrato da Família Teste Horizonte",
      ),
    ).toBeVisible();
    // Tarefa do papel coordenação não aparece para o comercial.
    await expect(
      page.getByText("Agendar a consulta pré-natal da Família Teste Íris"),
    ).toHaveCount(0);

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("a tarefa com mensagem abre o WhatsApp da família com o texto do modelo", async ({
    page,
  }) => {
    await entrarComo(page, "Comercial");
    await page.goto("/tarefas");

    const cartao = page
      .getByRole("heading", {
        name: "Retomar o contato com a Família Teste Dália",
      })
      .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
    await expect(cartao).toBeVisible();
    const link = cartao.getByRole("link", { name: /Abrir no WhatsApp/ });
    await expect(link).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5511900000305\?text=Oi%2C%20Fernanda/,
    );
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
  await entrarComo(page, "Coordenação");
  await page.goto("/tarefas");

  await expect(
    page.getByRole("heading", { level: 1, name: "Tarefas" }),
  ).toBeVisible();
  await expect(
    page.getByText("Agendar a consulta pré-natal da Família Teste Íris"),
  ).toBeVisible();
});
