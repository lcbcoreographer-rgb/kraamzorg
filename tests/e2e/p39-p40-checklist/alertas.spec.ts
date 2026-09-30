import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { idVisita } from "./apoio";

/**
 * P40 · Alertas clínicos, modo demonstração. RN-08 (Cedro, aberto, sem
 * nenhum campo do registro) e PU-01 (Dália, fechado) vêm do seed fictício.
 * Ordem importa: a coordenação fecha o RN-08 no último teste da fila, então
 * os testes de leitura rodam antes e o arquivo é serial.
 */
test.describe.configure({ mode: "serial" });

test.describe("Alertas clínicos", () => {
  test("a enfermeira vê o alerta aberto com a conduta e a ligação", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto("/alertas");

    await expect(
      page.getByRole("heading", { name: "Alertas", level: 1 }),
    ).toBeVisible();
    const alerta = page.getByRole("article", { name: /^RN-08, / });
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText("Família Teste Cedro");
    await expect(alerta).toContainText(
      "Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.",
    );
    await expect(
      alerta.getByRole("link", { name: "Ligar para a supervisão" }),
    ).toBeVisible();
    await expect(
      alerta.getByRole("button", { name: "Registrar acionamento" }),
    ).toBeVisible();
    // A enfermeira registra; quem fecha é a coordenação.
    await expect(
      alerta.getByRole("button", { name: "Fechar o alerta" }),
    ).toHaveCount(0);

    await semViolacaoGrave(page);
    await semRolagemLateral(page);
  });

  test("a diretoria só lê", async ({ page }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/alertas-clinicos");
    const alerta = page.getByRole("article", { name: /^RN-08, / });
    await expect(alerta).toBeVisible();
    await expect(
      alerta.getByText("Você acompanha este alerta em leitura."),
    ).toBeVisible();
    await expect(alerta.getByRole("button")).toHaveCount(0);
  });

  test("o alerta fechado mostra os quatro campos do registro", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/alertas-clinicos?situacao=fechados");
    const alerta = page.getByRole("article", { name: /^PU-01, / });
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText("Fechado em");
    for (const rotulo of [
      "Sinal identificado",
      "Horário do acionamento",
      "Orientação médica recebida",
      "Conduta adotada",
    ]) {
      await expect(alerta.getByText(rotulo)).toBeVisible();
    }
    await semViolacaoGrave(page);
  });

  test("a coordenação só fecha o alerta com os quatro campos", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/alertas-clinicos");

    const alerta = page.getByRole("article", { name: /^RN-08, / });
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText("Para fechar falta:");
    const fechar = alerta.getByRole("button", { name: "Fechar o alerta" });
    await expect(fechar).toBeDisabled();

    await alerta.getByRole("button", { name: "Registrar acionamento" }).click();
    await page
      .getByLabel("Sinal identificado")
      .fill("Bebê com temperatura de 38,3 °C.");
    await page.getByLabel("Horário do acionamento").fill("09:30");
    await page.getByRole("button", { name: "Salvar registro" }).click();

    // Faltam a orientação médica e a conduta: continua sem fechar.
    await expect(page.getByRole("article", { name: /^RN-08, / })).toContainText(
      "Para fechar falta: orientação médica recebida",
    );
    await expect(
      page
        .getByRole("article", { name: /^RN-08, / })
        .getByRole("button", { name: "Fechar o alerta" }),
    ).toBeDisabled();

    await page
      .getByRole("article", { name: /^RN-08, / })
      .getByRole("button", { name: "Completar o registro" })
      .click();
    await page
      .getByLabel("Orientação médica recebida")
      .fill("Levar o bebê à emergência pediátrica.");
    await page
      .getByLabel("Conduta adotada")
      .fill("Família orientada e acompanhada por telefone.");
    await page.getByRole("button", { name: "Salvar registro" }).click();

    const completo = page.getByRole("article", { name: /^RN-08, / });
    await expect(completo).toContainText(
      "Os quatro campos estão preenchidos. O alerta pode ser fechado.",
    );
    await completo.getByRole("button", { name: "Fechar o alerta" }).click();

    await expect(page.getByRole("article", { name: /^RN-08, / })).toHaveCount(
      0,
    );
    await page.goto("/alertas-clinicos?situacao=fechados");
    await expect(page.getByRole("article", { name: /^RN-08, / })).toContainText(
      "Fechado em",
    );
  });
});

test.describe("Janelas de apoio (DOC 4)", () => {
  test("LATCH, NTS e laserterapia abrem como consulta, com o ILIB em vermelho", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);
    await page.getByRole("button", { name: /Ver todas as etapas/ }).click();
    await page.getByRole("button", { name: /Mamas e amamentação/ }).click();

    await page.getByRole("button", { name: /Consultar: Escala LATCH/ }).click();
    const latch = page.getByRole("dialog");
    await expect(latch.getByText("Marque os cinco itens")).toBeVisible();
    await expect(latch.getByText(/^Soma: 0 de /)).toBeVisible();
    await semViolacaoGrave(page);
    await page
      .getByRole("button", { name: "Fechar a janela de apoio" })
      .click();

    await page
      .getByRole("button", { name: /Consultar: Escore de trauma mamilar/ })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Escolha um grau"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Fechar a janela de apoio" })
      .click();

    await page
      .getByRole("button", { name: /Consultar: Protocolos de laserterapia/ })
      .click();
    const laser = page.getByRole("dialog");
    await expect(laser.getByText("ILIB")).toBeVisible();
    await expect(laser.getByText("Vermelho, 30 minutos")).toBeVisible();
    await expect(laser.getByText(/infravermelho, 30/i)).toHaveCount(0);
    await semRolagemLateral(page);
  });
});
