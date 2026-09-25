import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 item 1 · Conversas (`/conversas`), modo demonstração
 * (`KZ_DADOS=demonstracao`, `playwright.config.ts`). Lista com modo, pausa,
 * última mensagem e transferência aberta (protótipo `comercial-conversas.html`,
 * C5), mais a conversa individual (`comercial-conversa.html`, C2).
 *
 * `porProjeto`: celular e computador rodam contra o mesmo servidor de
 * demonstração, com a mesma loja em memória (`tests/e2e/p13-configuracoes/apoio.ts`).
 * O teste que assume uma conversa usa uma família diferente por projeto
 * (Aurora e Íris, as duas "Isadora conduzindo" no seed) para não brigar
 * pela mesma linha.
 */
test("lista por situação, com filtro, e é acessível", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  await expect(
    page.getByRole("heading", { level: 1, name: "Conversas" }),
  ).toBeVisible();
  await expect(page.getByText("Família Teste Aurora")).toBeVisible();
  await expect(
    page
      .getByText("Família Teste Dália")
      .or(page.getByText("Família Teste Horizonte")),
  ).toBeVisible();

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("Assumir conversa pausa a Isadora e mostra 'Devolver agora'", async ({
  page,
}, info) => {
  const familia = porProjeto(
    info,
    "Família Teste Aurora",
    "Família Teste Íris",
  );
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  const cartao = page
    .getByText(familia, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await cartao.getByRole("button", { name: "Assumir conversa" }).click();

  await expect(cartao.getByText("Pausada")).toBeVisible();
  await expect(
    cartao.getByRole("button", { name: "Devolver agora" }),
  ).toBeVisible();
});

test("filtro 'Não lead' mostra só quem não é lead", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  await page.getByRole("button", { name: /^Não lead/ }).click();
  await expect(
    page.getByText("Não lead", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Família Teste Aurora")).toHaveCount(0);
});

test("humano_comercial: resolver não reativa a Isadora; só 'Devolver à Isadora', com confirmação, devolve e grava no log", async ({
  page,
}, info) => {
  // A Família Teste Horizonte é a única conversa em humano_comercial do
  // seed, e o teste muda o estado dela: roda só no computador para os dois
  // projetos não disputarem a mesma linha da loja em memória.
  test.skip(
    info.project.name !== "computador",
    "estado compartilhado: um projeto só",
  );

  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  const cartao = page
    .getByText("Família Teste Horizonte")
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await cartao.getByRole("link", { name: "Abrir conversa" }).click();
  await page.waitForURL(/\/conversas\//);
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toBeVisible();

  // 1. Resolver a transferência (aceite do P27): a conversa continua com a equipe.
  await page
    .getByRole("button", { name: "Marcar como resolvida" })
    .first()
    .click();
  await page.getByLabel("Formulário enviado").check();
  await page
    .getByRole("button", { name: "Marcar como resolvida" })
    .last()
    .click();
  await expect(
    page.getByRole("region", { name: "Transferência aberta" }),
  ).toHaveCount(0);
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toBeVisible();
  await expect(
    page.getByText("A Isadora está conduzindo esta conversa"),
  ).toHaveCount(0);

  // 2. Só o botão específico devolve, com a confirmação explicando quando ela volta.
  await page.getByRole("button", { name: "Devolver à Isadora" }).click();
  const dialogo = page.getByRole("dialog", {
    name: "Devolver esta conversa à Isadora",
  });
  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByText(/a partir da próxima mensagem da família/),
  ).toBeVisible();
  await semViolacaoGrave(page);
  await dialogo.getByRole("button", { name: "Devolver à Isadora" }).click();

  // 3. Saiu de humano_comercial e ficou registrado na própria conversa.
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toHaveCount(0);
  await expect(
    page.getByText("A Isadora está conduzindo esta conversa"),
  ).toBeVisible();
  await expect(
    page.getByText(/devolveu a conversa à Isadora às/),
  ).toBeVisible();
});
