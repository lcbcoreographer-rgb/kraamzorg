import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { idVisita, TELEFONE_SUPERVISAO_DEMO } from "./apoio";

/**
 * P39 e interface do P40 · Checklist diário (`/visita/[visitaId]`), modo
 * demonstração. Aurora D4 é a visita aberta da enfermeira, com os três
 * primeiros dias assinados. Aqui: a etapa de abertura, a referência do dia
 * anterior, o alerta na hora do campo (PU-01), o registro do acionamento
 * do DOC 3, o rascunho que volta sozinho, o resumo que barra a assinatura e
 * o registro assinado só para leitura, com adendo. O motor de alertas, a
 * assinatura e o offline estão cobertos no Vitest e no pgTAP.
 */
test.describe("Checklist da enfermeira", () => {
  test("abre na chegada, com a trilha de etapas, é acessível e cabe na tela", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);

    await expect(page).toHaveTitle(/^Checklist/);
    await expect(page.getByText("Etapa 1 de 8")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Chegada", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Checklist do D4")).toBeAttached();
    await expect(page.getByText("Salvo no aparelho").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Acionar freio/ }),
    ).toBeVisible();

    await semViolacaoGrave(page);
    await semRolagemLateral(page);
  });

  test("temperatura de 38,2 abre o alerta PU-01 com a conduta aprovada, e o acionamento se registra", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await expect(page.getByText("Etapa 3 de 8")).toBeVisible();

    // Referência do dia anterior, só como referência.
    await expect(page.getByText("No D3 foi 36,9 °C.")).toBeVisible();

    const temperatura = page.getByLabel(/^Temperatura/).first();
    await temperatura.fill("38,2");
    await temperatura.blur();

    const faixa = page.getByRole("alert").filter({ hasText: "PU-01" });
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText("Febre");
    await expect(faixa).toContainText("38,2");
    await expect(faixa).toContainText(
      "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.",
    );
    await expect(faixa).toContainText("Antes de fechar");
    await expect(
      faixa.getByRole("link", { name: "Ligar para a supervisão" }),
    ).toHaveAttribute("href", TELEFONE_SUPERVISAO_DEMO);

    await semViolacaoGrave(page);
    await semRolagemLateral(page);

    // Registrar acionamento: os quatro campos do DOC 3.
    await faixa.getByRole("button", { name: "Registrar acionamento" }).click();
    const folha = page.getByRole("dialog", { name: "Registrar acionamento" });
    await expect(folha).toBeVisible();
    await expect(folha.getByLabel("Sinal identificado")).not.toHaveValue("");
    await expect(folha.getByLabel("Horário do acionamento")).not.toHaveValue(
      "",
    );

    // Só com o sinal e a hora, avisa o que falta.
    await expect(folha.getByRole("status")).toContainText(
      "orientação médica recebida",
    );
    await expect(folha.getByRole("status")).toContainText("conduta adotada");

    await folha
      .getByLabel("Orientação médica recebida")
      .fill("Observação em casa e reavaliação em duas horas.");
    await folha
      .getByLabel("Conduta adotada")
      .fill("Antitérmico orientado e temperatura reavaliada.");
    await expect(folha.getByRole("status")).toHaveCount(0);
    await folha.getByRole("button", { name: "Salvar registro" }).click();
    await expect(folha).toBeHidden();

    await expect(
      page.getByText("Registro do acionamento feito").first(),
    ).toBeVisible();
  });

  test("o valor digitado volta sozinho depois de recarregar a página", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await page.getByRole("button", { name: "Próxima etapa" }).click();

    const frequencia = page.getByLabel(/^Frequência cardíaca/).first();
    await frequencia.fill("82");
    await frequencia.blur();
    await expect(page.getByText("Salvo no aparelho").first()).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /Ver todas as etapas/ }).click();
    await page
      .getByRole("button", { name: /Sinais vitais/ })
      .first()
      .click();
    await expect(page.getByLabel(/^Frequência cardíaca/).first()).toHaveValue(
      "82",
    );
  });

  test("sem tudo respondido, o resumo lista o que falta e não deixa assinar", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);
    await page.getByRole("button", { name: /Ver todas as etapas/ }).click();
    await page
      .getByRole("button", { name: /Resumo e assinatura/ })
      .first()
      .click();

    await expect(page.getByText("Etapa 8 de 8")).toBeVisible();
    await expect(page.getByText("Falta para assinar")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Assinar registro do D4|Falta responder/,
      }),
    ).toBeDisabled();

    await semViolacaoGrave(page);
    await semRolagemLateral(page);
  });

  test("visita já assinada abre só para leitura e o adendo entra com motivo, sem mexer no original", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(9)}`);

    await expect(page.getByText(/^Assinado por /).first()).toBeVisible();
    await expect(
      page.getByText(
        "O registro não muda. Para corrigir, faça um adendo com o motivo.",
      ),
    ).toBeVisible();
    // Nenhum campo editável: a leitura não tem entrada de texto do checklist.
    await expect(page.getByLabel(/^Temperatura/)).toHaveCount(0);
    await expect(page.getByText("Nenhum adendo neste registro.")).toBeVisible();

    await page.getByRole("button", { name: "Fazer adendo" }).click();
    const salvar = page.getByRole("button", { name: "Salvar adendo" });
    await salvar.click();
    await expect(
      page.getByText("Escreva o motivo e o texto do adendo."),
    ).toBeVisible();

    await page
      .getByLabel("Motivo do adendo")
      .fill("Temperatura digitada errada");
    await page
      .getByLabel("O que corrigir ou acrescentar")
      .fill("A temperatura correta da mãe era 36,8 °C.");
    await salvar.click();

    await expect(page.getByText("Adendo registrado.")).toBeVisible();
    await expect(page.getByText("Temperatura digitada errada")).toBeVisible();

    await semViolacaoGrave(page);
    await semRolagemLateral(page);
  });

  test("visita de outra profissional não abre", async ({ page }) => {
    await entrarComo(page, "Enfermeira");
    const resposta = await page.goto(`/visita/${idVisita(11)}`);
    expect(resposta?.status()).toBe(404);
  });

  test("quem não é da área assistencial não abre o checklist", async ({
    page,
  }) => {
    await entrarComo(page, "Comercial");
    await page.goto(`/visita/${idVisita(4)}`);
    await expect(page).not.toHaveURL(/\/visita\//);
  });
});
