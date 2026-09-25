import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 itens 3, 4 e 5 · Painel da Isadora (`/agente`), modo demonstração:
 * regra de retomada, modo do agente e números de teste (só diretoria
 * altera), base de conhecimento (cadastro do comercial, aprovação da
 * diretoria) e métricas do 11.12.
 */
test("diretoria vê e altera o modo do agente; comercial só lê", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/agente");

  await expect(
    page.getByRole("heading", { level: 1, name: "Isadora" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Modo da Isadora" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /Em teste/ })).toBeVisible();

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("comercial não vê o formulário de edição do modo (só a diretoria altera)", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/agente");

  await expect(
    page.getByText("Só a diretoria altera o modo da Isadora"),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /Em teste/ })).toHaveCount(0);
});

test("diretoria salva a janela de retomada", async ({ page }) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/agente");

  await page.getByRole("radio", { name: /72 h/ }).check();
  await page.getByRole("button", { name: "Salvar regra de retomada" }).click();

  await expect(page.getByText(/Regra de retomada salva/)).toBeVisible();
});

test("comercial cadastra item na base de conhecimento; diretoria aprova", async ({
  page,
}, info) => {
  // Título com o nome do projeto: celular e computador criam itens
  // diferentes na mesma loja em memória, sem os dois testes acharem o
  // título um do outro (mesmo cuidado de `tests/e2e/p13-configuracoes/apoio.ts`).
  const titulo = porProjeto(
    info,
    "Atende fim de semana no celular?",
    "Atende fim de semana no computador?",
  );

  await entrarComo(page, "Comercial");
  await page.goto("/agente");

  await page.getByRole("button", { name: "Novo item" }).click();
  await page.getByLabel("Título").fill(titulo);
  await page
    .getByLabel("Texto")
    .fill(
      "Sim, a enfermeira visita todos os dias do acompanhamento, inclusive fins de semana.",
    );
  await page.getByRole("button", { name: "Salvar em rascunho" }).click();

  await expect(page.getByText(titulo)).toBeVisible();
  await expect(
    page.getByText("Item salvo em rascunho, para aprovação."),
  ).toBeVisible();

  await entrarComo(page, "Diretoria");
  await page.goto("/agente");
  const cartao = page
    .getByText(titulo)
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await cartao.getByRole("button", { name: "Aprovar" }).click();
  await expect(cartao.getByText("Aprovado", { exact: true })).toBeVisible();
});

test("mostra os números do mês com base de comparação", async ({ page }) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/agente");

  await expect(
    page.getByRole("heading", { name: "Números do mês" }),
  ).toBeVisible();
  await expect(page.getByText("Leads que respondem à abertura")).toBeVisible();
  await expect(page.getByText(/Meta:/).first()).toBeVisible();
});
