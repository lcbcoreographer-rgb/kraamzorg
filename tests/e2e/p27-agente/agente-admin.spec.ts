import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 itens 4 e 5 · Painel da Isadora (`/agente`), modo demonstração: base de
 * conhecimento (cadastro do comercial, aprovação da diretoria) e métricas do
 * 11.12. [v4.5] O modo do agente, os números de teste e a janela de retomada
 * são parâmetros do agente, mantidos pela equipe de implantação: a tela não
 * tem mais campo para eles, nem para a diretoria.
 */
test("a tela da Isadora explica que os ajustes são da equipe de implantação e não traz campo de modo nem de retomada", async ({
  page,
}) => {
  for (const papel of ["Diretoria", "Comercial"]) {
    await entrarComo(page, papel);
    await page.goto("/agente");

    await expect(
      page.getByRole("heading", { level: 1, name: "Isadora" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ajustes da Isadora" }),
    ).toBeVisible();
    await expect(page.getByText(/equipe de implantação/).first()).toBeVisible();

    // nenhum controle de modo, de lista de teste nem de janela de retomada
    await expect(page.getByRole("radio", { name: /Em teste/ })).toHaveCount(0);
    await expect(page.getByLabel("Números de teste")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /72 h/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Salvar (modo|regra)/ }),
    ).toHaveCount(0);

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  }
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
  // Números do mês em frase, uma linha por métrica (DESIGN.md, 11.10).
  await expect(
    page.getByText(/responderam à mensagem de abertura/),
  ).toBeVisible();
  await expect(page.getByText(/Meta:/).first()).toBeVisible();
});
