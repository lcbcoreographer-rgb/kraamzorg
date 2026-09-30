import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import {
  hojeEmBrasilia,
  ID_ACOMPANHAMENTO_JADE,
  ID_VISITA_MARE_D3,
  ID_VISITA_MARE_D4,
} from "./apoio";

/**
 * P37, aceite: "conflito aparece na tela antes de salvar; cascata mantém o
 * período". A coordenação abre a agenda, o formulário pergunta ao banco
 * (sem gravar) e mostra os avisos, e só salva quem confirma.
 */
test.describe("agenda da coordenação", () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, "Coordenação");
  });

  test("a agenda mostra as visitas da semana, sem rolagem lateral e com axe limpo", async ({
    page,
  }) => {
    await page.goto("/agenda");
    await expect(
      page.getByRole("heading", { level: 1, name: "Agenda" }),
    ).toBeVisible();
    await expect(page.getByText("Família Teste Maré").first()).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o conflito aparece na tela antes de salvar e só salva quem confirma com motivo", async ({
    page,
  }) => {
    await page.goto(`/agenda/visitas/${ID_VISITA_MARE_D3}`);
    const salvar = page.getByRole("button", { name: "Reagendar a visita" });
    await expect(salvar).toBeDisabled();

    // Hoje a enfermeira já tem a Jade às 14:00: pôr a Maré (de manhã) nesse
    // horário muda o período da família e choca com a outra visita. O limite
    // de visitas por dia tem os próprios testes (regras, demonstração e pgTAP).
    await page.getByLabel("Novo dia").fill(hojeEmBrasilia());
    await page.getByLabel(/^Horário/).fill("14:00");

    await expect(page.getByText("Há 2 conflitos na agenda")).toBeVisible();
    await expect(page.getByText(/O período muda/)).toBeVisible();
    await expect(page.getByText(/Choca com outra visita/)).toBeVisible();
    await expect(salvar).toBeDisabled();

    await page.getByLabel("Quero salvar mesmo com o conflito").check();
    await expect(salvar).toBeDisabled();
    await page.getByLabel(/^Motivo/).fill("Pedido da família");
    await expect(salvar).toBeEnabled();

    // Nada foi gravado: a visita continua no dia de antes.
    await page.goto(`/agenda?data=${hojeEmBrasilia()}&visao=dia`);
    // Só o D2 da Maré está hoje; o D3 continua amanhã.
    const mareHoje = page.locator("[data-visita]", {
      hasText: "Família Teste Maré",
    });
    await expect(mareHoje).toHaveCount(1);
    await expect(mareHoje).toContainText("D2");
  });

  test("sem conflito, salva direto e o dia novo já aparece na agenda", async ({
    page,
  }) => {
    const novoDia = hojeEmBrasilia(12);
    await page.goto(`/agenda/visitas/${ID_VISITA_MARE_D4}`);
    // Espera a tela ficar interativa (a primeira conferência da agenda, feita
    // depois da hidratação): digitado antes disso, o dia novo se perdia e o
    // botão ficava desligado com a máquina carregada.
    await expect(page.getByText("Sem conflito na agenda")).toBeVisible();
    await page.getByLabel("Novo dia").fill(novoDia);
    await expect(page.getByText("Sem conflito na agenda")).toBeVisible();
    await page.getByRole("button", { name: "Reagendar a visita" }).click();

    await expect(page).toHaveURL(/\/agenda\?.*feito=reagendada/);
    await expect(page.getByText(/Visita reagendada/)).toBeVisible();
    await page.goto(`/agenda?data=${novoDia}&visao=dia`);
    const mareNovoDia = page.locator("[data-visita]", {
      hasText: "Família Teste Maré",
    });
    await expect(mareNovoDia).toHaveCount(1);
    await expect(mareNovoDia).toContainText("09:00");
    await expect(mareNovoDia).toContainText("D4");
  });

  test("a cascata anda todas as visitas e mantém horário e período", async ({
    page,
  }) => {
    await page.goto(`/agenda/cascata/${ID_ACOMPANHAMENTO_JADE}`);
    const primeiroDia = await page
      .getByLabel(/^Novo primeiro dia/)
      .inputValue();
    expect(primeiroDia).toBe(hojeEmBrasilia());
    const novoPrimeiroDia = hojeEmBrasilia(3);
    await page.getByLabel(/^Novo primeiro dia/).fill(novoPrimeiroDia);

    await expect(
      page.getByText("As visitas andam 3 dias para frente."),
    ).toBeVisible();
    const linhas = page
      .getByRole("list", { name: "Como ficam as visitas" })
      .getByRole("listitem");
    await expect(linhas).toHaveCount(6);
    // O horário da tarde da família se mantém em todas.
    for (const linha of await linhas.all()) {
      await expect(linha).toContainText("às 14:00");
    }

    await page
      .getByLabel(/^O que mudou/)
      .fill("Alta registrada três dias depois");
    await page.getByRole("button", { name: "Reagendar as visitas" }).click();
    await expect(page).toHaveURL(/feito=cascata/);

    await page.goto(`/agenda?data=${novoPrimeiroDia}&visao=dia`);
    const jade = page.locator("[data-visita]", {
      hasText: "Família Teste Jade",
    });
    await expect(jade).toHaveCount(1);
    await expect(jade).toContainText("14:00");
    await expect(jade).toContainText("tarde");
    await expect(jade).toContainText("D1");
  });
});
