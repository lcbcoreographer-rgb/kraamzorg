import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";

/**
 * P15 item 4: cadastro manual de lead pelo comercial (família, pessoa e
 * oportunidade com origem), nascendo em Novo no pipeline 1.
 */

test("comercial cadastra um lead manual, que nasce em Novo", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/pipeline?pipeline=1");
  await semViolacaoGrave(page);

  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await expect(
    page.getByRole("heading", { name: "Cadastrar lead" }),
  ).toBeVisible();

  await page.getByLabel("Nome da família").fill("Família Teste E2E Cadastro");
  await page.getByLabel("Nome do contato").fill("Patrícia");
  await page.getByLabel("Telefone do contato").fill("11 91234-5678");
  await page.getByLabel("Origem").selectOption("indicacao_amigo");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Cadastrar lead" }),
  ).toBeHidden();
  // Lista (celular) e quadro (computador) coexistem no DOM; só um aparece.
  await expect(
    page.getByText("Família Teste E2E Cadastro").filter({ visible: true }),
  ).toBeVisible();
});

test("sem preencher o nome da família, o navegador não deixa enviar", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/pipeline?pipeline=1");

  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await page.getByLabel("Nome do contato").fill("Patrícia");
  await page.getByLabel("Telefone do contato").fill("11912345678");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();

  // O diálogo continua aberto: o campo obrigatório barrou o envio.
  await expect(
    page.getByRole("heading", { name: "Cadastrar lead" }),
  ).toBeVisible();
});
