import { expect, test } from "@playwright/test";
import { semRolagemLateral, semViolacaoGrave } from "../apoio/entrar";
import { entrarEmAal2 } from "./apoio";

/**
 * P25b · Reunião que a Isadora marcou, modo demonstração (D-19 e D-20).
 *
 * A Família Teste Aurora tem uma reunião marcada pela Isadora que já
 * começou: falta a Edilaine registrar como foi. A Família Teste Horizonte
 * já teve a reunião (realizada), e a conversa é do Leonardo.
 *
 * Aceite: a tela mostra quem marcou, o lembrete e o resumo da Isadora; o
 * comercial lê mas não registra; a Edilaine registra a falta e a conversa
 * segue com a Isadora.
 */
test.describe.configure({ mode: "serial" });

test("comercial vê a reunião da Isadora e o resumo, mas quem registra como foi é a Edilaine", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  await page.goto("/sessoes-venda");
  await page.getByRole("link", { name: /Família Teste Aurora/ }).click();
  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}$/);

  await expect(page.getByText("Marcada pela Isadora")).toBeVisible();
  await expect(page.getByText("Isadora conduz a conversa")).toBeVisible();
  await expect(
    page.getByText("A Isadora, pela agenda da Edilaine no Google Calendar"),
  ).toBeVisible();
  await expect(page.getByText(/Enviado pela Isadora em/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Resumo da Isadora para o Leonardo" }),
  ).toBeVisible();
  await expect(page.getByText(/perguntou se há desconto no Pix/)).toBeVisible();

  // Sem botão que o banco vai recusar, e a reunião da Isadora não se remarca aqui.
  await expect(
    page.getByRole("button", { name: "Registrar como foi" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("A Edilaine registra como foi a reunião.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Remarcar", { exact: true })).toHaveCount(0);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("a Edilaine registra que a família não veio e a conversa segue com a Isadora", async ({
  page,
}) => {
  const errosDaPagina: string[] = [];
  page.on("pageerror", (erro) => errosDaPagina.push(String(erro)));
  await entrarEmAal2(page, "Coordenação");
  await page.goto("/sessoes-venda");
  await page.getByRole("link", { name: /Família Teste Aurora/ }).click();
  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}$/);

  await page.getByText("A família não veio", { exact: true }).click();
  await expect(
    page.getByText(
      "A Isadora oferece outro horário à família, sem cobrar, e a conversa continua com ela.",
    ),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page.getByRole("button", { name: "Registrar como foi" }).click();
  await expect(
    page.getByText(
      "Registrado. A Isadora vai oferecer outro horário à família, sem cobrar, e a conversa continua com ela.",
    ),
  ).toBeVisible();
  expect(errosDaPagina, errosDaPagina.join("\n")).toEqual([]);

  // A reunião saiu da agenda de quem ainda vai acontecer.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Registrar como foi" }),
  ).toHaveCount(0);
});

test("reunião realizada: a conversa é do Leonardo e o resultado aparece", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  await page.goto("/sessoes-venda");
  await page.getByRole("link", { name: /Família Teste Horizonte/ }).click();
  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}$/);

  await expect(page.getByText("Leonardo conduz a conversa")).toBeVisible();
  await expect(page.getByText("Marcada pela Isadora")).toBeVisible();
  await expect(
    page.getByText(
      "Interesse no Continuado. Quer decidir com o parceiro até sexta.",
      { exact: true },
    ),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});
