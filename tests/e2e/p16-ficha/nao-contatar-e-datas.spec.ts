import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";
import { abas, porProjeto } from "./apoio";

/**
 * P16 itens 3 e 4: marcar "não contatar" com motivo, e registrar as datas
 * de nascimento e alta como fato. Uma família diferente por projeto.
 */
test("comercial marca não contatar com motivo, e a linha do tempo mostra o evento", async ({
  page,
}, info) => {
  const familia = porProjeto(info, "Maré", "Estrela");
  await entrarComo(page, "Comercial");
  await page.goto(`/familias?busca=${encodeURIComponent(familia)}`);
  await page
    .getByRole("link", { name: new RegExp(`Família Teste ${familia}`) })
    .click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await abas(page).getByRole("link", { name: "Comercial" }).click();
  await page.getByRole("button", { name: "Marcar não contatar" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo
    .getByLabel("Motivo")
    .fill("Pediu para não ser mais contatada pelo WhatsApp.");
  await dialogo.getByRole("button", { name: "Marcar não contatar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByText("Não contatar")).toBeVisible();

  await abas(page).getByRole("link", { name: "Linha do tempo" }).click();
  await expect(page.getByText("Marcada para não contatar")).toBeVisible();

  await semViolacaoGrave(page);
});

test("comercial registra uma data de fato, que aparece no cabeçalho", async ({
  page,
}, info) => {
  // Mesma família nos dois projetos, mas um campo diferente em cada um
  // (a loja em memória é uma só para os dois).
  const { rotulo, valor, formatado } = porProjeto(
    info,
    { rotulo: "Nascimento", valor: "2026-09-24", formatado: "24/09/2026" },
    { rotulo: "Alta", valor: "2026-09-23", formatado: "23/09/2026" },
  );
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=Horizonte");
  await page.getByRole("link", { name: /Família Teste Horizonte/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await abas(page).getByRole("link", { name: "Comercial" }).click();
  await page
    .getByRole("button", { name: `Registrar ${rotulo.toLowerCase()}` })
    .click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(rotulo).fill(valor);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  // O "ainda não" do cabeçalho dá lugar à data, marcada como fato.
  const data = page
    .locator("dt", { hasText: new RegExp(`^${rotulo}$`) })
    .locator("xpath=..");
  await expect(data.getByText(formatado)).toBeVisible();
  await expect(data.getByText("fato")).toBeVisible();
});

test("financeiro não vê os botões de não contatar nem de registrar data (só leitura)", async ({
  page,
}) => {
  await entrarComo(page, "Financeiro");
  await page.goto("/familias?busca=Horizonte");
  const link = page.getByRole("link", {
    name: /Família Teste Horizonte/,
  });
  if ((await link.count()) === 0) return; // financeiro só vê família com contrato
  await link.click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  await abas(page).getByRole("link", { name: "Comercial" }).click();
  await expect(page.getByText("Dados do contrato")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Marcar não contatar" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Registrar nascimento/ }),
  ).toHaveCount(0);
  // Conversas do WhatsApp não são do financeiro (PRD 13).
  await expect(abas(page).getByRole("link", { name: "Conversas" })).toHaveCount(
    0,
  );
});

test("coordenação lê a aba Comercial sem os dados de contrato nem os controles de escrita", async ({
  page,
}) => {
  await entrarComo(page, /^Coordenação Perfil Teste/);
  await page.goto("/familias?busca=D%C3%A1lia");
  await page.getByRole("link", { name: /Família Teste Dália/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await abas(page).getByRole("link", { name: "Comercial" }).click();
  await page.waitForURL(/aba=comercial/);
  // PRD 13: dados de contrato sem acesso para a coordenação.
  await expect(page.getByText("Dados do contrato")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Marcar não contatar" }),
  ).toHaveCount(0);
});

test("data de nascimento no futuro é recusada com a explicação", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=Cedro");
  await page.getByRole("link", { name: /Família Teste Cedro/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await abas(page).getByRole("link", { name: "Comercial" }).click();
  await page.getByRole("button", { name: /Registrar nascimento/ }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nascimento").fill("2999-01-01");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo.getByText(/depois de hoje/)).toBeVisible();
});
