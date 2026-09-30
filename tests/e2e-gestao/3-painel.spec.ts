import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { entraramESairam } from "./apoio";

/**
 * P52, aceite: o painel da diretoria responde às cinco perguntas com as metas
 * da Kraamzorg, mostra o congelamento e usa os mesmos números das telas de
 * origem. Só a diretoria abre.
 */
test.describe("painel executivo", () => {
  test("a diretoria vê as metas, as cinco perguntas e o congelamento", async ({
    page,
  }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/painel");
    await expect(
      page.getByRole("heading", { level: 1, name: "Painel executivo" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "As metas do mês" }),
    ).toBeVisible();
    // Quatro metas: contratos, famílias, faturamento e NPS.
    await expect(page.getByRole("meter")).toHaveCount(4);

    for (const pergunta of [
      "Como está a venda?",
      "De onde vêm as famílias e quanto custa trazê-las?",
      "Como está a operação?",
      "Como as famílias estão vivendo o cuidado?",
      "Como está o dinheiro?",
    ]) {
      await expect(page.getByRole("heading", { name: pergunta })).toBeVisible();
    }

    await expect(page.getByText(/v1\.0\.0-rc\.1/).first()).toBeVisible();
    await expect(page.getByText(/congela|congelado/).first()).toBeVisible();

    // O gráfico de capacidade do painel tem a mesma legenda da tela de origem.
    await expect(
      page.getByRole("group", { name: /Ocupação de .* nas próximas/ }).first(),
    ).toBeVisible();

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o NPS não aparece sem amostra mínima e a definição de cada número está à mão", async ({
    page,
  }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/painel");
    // A meta de NPS está sempre no painel; sem amostra mínima ela diz
    // "sem número" e explica por quê, em vez de mostrar uma porcentagem
    // sobre poucas famílias.
    const meta = page.getByRole("meter", { name: /^NPS/ });
    await expect(meta).toBeVisible();
    if (/sem número/.test((await meta.getAttribute("aria-label")) ?? "")) {
      await expect(
        page.getByText(/O NPS só aparece com pelo menos \d+ respostas/).first(),
      ).toBeVisible();
    }
    await page.getByText("De onde vêm estes números").first().click();
    await expect(page.getByText(/Ver em /).first()).toBeVisible();
  });

  test("o recebimento e o custo do painel são os do financeiro", async ({
    page,
  }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/financeiro");
    const noFinanceiro = await entraramESairam(page);
    await page.goto("/painel");
    const noPainel = await entraramESairam(page);
    expect(noPainel).toEqual(noFinanceiro);
  });

  test("o mês anterior compara sem quebrar", async ({ page }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/painel");
    await page
      .getByRole("navigation", { name: "Escolher o mês" })
      .getByRole("link")
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Painel executivo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "As metas do mês" }),
    ).toBeVisible();
    await semRolagemLateral(page);
  });

  test("só a diretoria abre o painel", async ({ page }) => {
    for (const rotulo of ["Financeiro", "Coordenação", "Comercial"]) {
      await entrarComo(page, rotulo);
      await page.goto("/painel");
      await expect(page).not.toHaveURL(/\/painel/);
      await expect(
        page.getByRole("heading", { name: "As metas do mês" }),
      ).toHaveCount(0);
    }
  });
});
