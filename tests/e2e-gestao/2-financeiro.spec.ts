import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { csvDeExtrato, entraramESairam, hojeEmBrasilia } from "./apoio";

/**
 * P46, aceite: DRE do mês em regime de caixa, despesas por categoria,
 * pagamento da equipe liberado só depois das evoluções, conferência do
 * extrato que nunca dá baixa. Só financeiro e diretoria, com MFA.
 */
test.describe("financeiro", () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, "Financeiro");
  });

  test("a visão do mês mostra o DRE, a inadimplência e a previsão", async ({
    page,
  }) => {
    await page.goto("/financeiro");
    await expect(
      page.getByRole("heading", { level: 1, name: "Financeiro" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /^DRE de / })).toBeVisible();
    await expect(
      page.getByText("Recebimentos (cobranças pagas)"),
    ).toBeVisible();
    await expect(page.getByText(/^Resultado/).first()).toBeVisible();
    const { entraram } = await entraramESairam(page);
    expect(entraram).toBeGreaterThan(0);

    // O gráfico de resultado tem a versão em tabela.
    await expect(
      page.getByRole("group", { name: /Resultado de cada um dos últimos/ }),
    ).toBeVisible();
    await expect(page.getByText("Ver como tabela").first()).toBeVisible();

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("lança uma despesa, o DRE conta com ela, e remover pede o motivo", async ({
    page,
  }) => {
    await page.goto("/financeiro");
    const antes = await entraramESairam(page);

    await page.goto("/financeiro/despesas");
    await expect(
      page.getByRole("heading", { level: 1, name: "Despesas" }),
    ).toBeVisible();
    await page.getByLabel(/^Valor em reais/).fill("1.250,00");
    await page.getByLabel(/^Categoria/).selectOption("marketing_anuncios");
    await page.getByLabel(/^Canal/).selectOption("google");
    await page.getByLabel(/^O que foi pago/).fill("Anúncios de teste E2E");
    await page.getByRole("button", { name: "Lançar despesa" }).click();
    await expect(page.getByRole("status")).toContainText("Despesa lançada");
    await expect(page.getByText("Anúncios de teste E2E").first()).toBeVisible();
    await expect(page.getByText("Canal: Google").first()).toBeVisible();

    await page.goto("/financeiro");
    const depois = await entraramESairam(page);
    expect(depois.sairam - antes.sairam).toBe(125_000);

    // Uma segunda, só para remover: o motivo é obrigatório.
    await page.goto("/financeiro/despesas");
    await page.getByLabel(/^Valor em reais/).fill("90,00");
    await page.getByLabel(/^Categoria/).selectOption("tecnologia");
    await page.getByLabel(/^O que foi pago/).fill("Despesa lançada por engano");
    await page.getByRole("button", { name: "Lançar despesa" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Despesa lançada",
    );
    await page.reload();
    const gaveta = page.locator("details").filter({
      has: page.getByLabel("Remover a despesa Despesa lançada por engano"),
    });
    await gaveta
      .getByLabel("Remover a despesa Despesa lançada por engano")
      .click();
    await gaveta.getByLabel("Motivo da remoção").fill("curto");
    await gaveta.getByRole("button", { name: "Remover do DRE" }).click();
    await expect(gaveta.getByText(/pelo menos 10 letras/)).toBeVisible();
    await gaveta
      .getByLabel("Motivo da remoção")
      .fill("Lançada em duplicidade por engano");
    await gaveta.getByRole("button", { name: "Remover do DRE" }).click();
    // A linha sai da lista e do DRE; o registro e o motivo ficam guardados.
    await expect(page.getByText("Despesa lançada por engano")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Despesa lançada por engano")).toHaveCount(0);

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o pagamento da equipe bloqueado diz o que falta e o liberado registra o dia", async ({
    page,
  }) => {
    await page.goto("/financeiro/equipe");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pagamento da equipe" }),
    ).toBeVisible();
    await expect(page.getByText("Bloqueado").first()).toBeVisible();
    await expect(page.getByText(/evoluç/).first()).toBeVisible();
    // Bloqueado não oferece o registro do pagamento.
    const botoes = page.getByRole("button", {
      name: /^Registrar o pagamento de /,
    });
    const liberados = await botoes.count();
    expect(liberados).toBeGreaterThanOrEqual(1);

    await page.goto("/financeiro");
    const antes = await entraramESairam(page);

    await page.goto("/financeiro/equipe");
    await botoes.first().click();
    // O cartão passa a "Pago" e sai da fila dos liberados.
    await expect(botoes).toHaveCount(liberados - 1);
    await page.reload();
    await expect(botoes).toHaveCount(liberados - 1);
    await expect(page.getByText(/^Pago em /).first()).toBeVisible();

    // O pagamento vira despesa de equipe assistencial no DRE.
    await page.goto("/financeiro");
    const depois = await entraramESairam(page);
    expect(depois.sairam).toBeGreaterThan(antes.sairam);

    await page.goto("/financeiro/equipe");
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("importa um extrato, sugere o par e nunca dá baixa", async ({
    page,
  }) => {
    const hoje = hojeEmBrasilia();
    await page.goto("/financeiro/extrato");
    await expect(
      page.getByRole("heading", { level: 1, name: "Extrato do banco" }),
    ).toBeVisible();

    await page.getByLabel(/^Arquivo do extrato/).setInputFiles(
      csvDeExtrato([
        { dataIso: hoje, descricao: "PAGTO ANUNCIOS", valor: "-1.250,00" },
        {
          dataIso: hoje,
          descricao: "TED RECEBIDA SEM PAR",
          valor: "98.765,43",
        },
      ]),
    );
    await page.getByRole("button", { name: "Importar e conferir" }).click();
    await page.waitForURL(/\/financeiro\/extrato\?importacao=/);

    await expect(
      page.getByRole("heading", { name: "Conferência" }),
    ).toBeVisible();
    await expect(page.getByText("PAGTO ANUNCIOS").first()).toBeVisible();
    await expect(page.getByText("Anúncios de teste E2E").first()).toBeVisible();
    await expect(
      page.getByText(/Nenhuma cobrança nem despesa com este valor/).first(),
    ).toBeVisible();

    // O mesmo arquivo de novo não duplica: a lista continua com um extrato.
    await page.goto("/financeiro/extrato");
    await page.getByLabel(/^Arquivo do extrato/).setInputFiles(
      csvDeExtrato([
        { dataIso: hoje, descricao: "PAGTO ANUNCIOS", valor: "-1.250,00" },
        {
          dataIso: hoje,
          descricao: "TED RECEBIDA SEM PAR",
          valor: "98.765,43",
        },
      ]),
    );
    await page.getByRole("button", { name: "Importar e conferir" }).click();
    await page.waitForURL(/\/financeiro\/extrato\?importacao=/);
    await page.goto("/financeiro/extrato");
    await expect(page.getByText("Extratos importados")).toBeVisible();
    await expect(page.getByText("2 lançamentos, importado em")).toHaveCount(1);

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("um arquivo que não é extrato explica o que fazer", async ({ page }) => {
    await page.goto("/financeiro/extrato");
    await page.getByLabel(/^Arquivo do extrato/).setInputFiles({
      name: "foto.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("isto não é um extrato\nnem tem as colunas\n"),
    });
    await page.getByRole("button", { name: "Importar e conferir" }).click();
    await expect(
      page.getByText(/Não reconheci o formato/).first(),
    ).toBeVisible();
  });
});
