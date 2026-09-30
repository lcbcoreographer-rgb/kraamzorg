import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { abrirAlocacao, dataBr, diaBrasilia, linhasDeVisitas } from "./apoio";

/**
 * P36 (aceite): nascimento e alta geram 6 ou 12 visitas no período certo.
 * Família Teste Orquídea tem o pacote de 6 dias (preferência: manhã) e a
 * Família Teste Violeta o de 12 dias (preferência: tarde). D1 é o dia
 * seguinte à alta.
 */

async function registrarNascimentoEAlta(
  page: import("@playwright/test").Page,
  nome: string,
  visitas: number,
) {
  await abrirAlocacao(page, nome);

  // O nascimento vem primeiro; a alta só aparece depois dele.
  await expect(
    page.getByRole("heading", { name: "Registrar a alta" }),
  ).toHaveCount(0);
  const nascimento = page.locator("form[data-form='nascimento']");
  await nascimento.getByLabel("Data do nascimento").fill(diaBrasilia(0));
  await nascimento.getByLabel("Peso ao nascer").fill("3200");
  await nascimento
    .getByRole("button", { name: "Registrar o nascimento" })
    .click();
  await expect(page.getByText(/Nascimento registrado em/)).toBeVisible();
  await expect(
    page
      .locator("dt", { hasText: "Nascimento" })
      .locator("xpath=following-sibling::dd[1]"),
  ).toHaveText(dataBr(diaBrasilia(0)));

  // Alta hoje: D1 amanhã, todas as visitas no mesmo período.
  const alta = page.locator("form[data-form='alta']");
  await alta.getByLabel("Data da alta").fill(diaBrasilia(0));
  await alta.getByRole("button", { name: "Registrar a alta" }).click();
  await expect(
    page.getByText(
      new RegExp(`Alta registrada em .*${visitas} visitas marcadas`),
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: `Visitas de D1 a D${visitas}` }),
  ).toBeVisible();
  await expect(linhasDeVisitas(page)).toHaveCount(visitas);
  return linhasDeVisitas(page);
}

test("nascimento e alta do pacote de 6 dias geram 6 visitas de manhã", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  const linhas = await registrarNascimentoEAlta(
    page,
    "Família Teste Orquídea",
    6,
  );

  await expect(linhas.first()).toContainText("D1");
  await expect(linhas.first()).toContainText(dataBr(diaBrasilia(1)));
  await expect(linhas.last()).toContainText("D6");
  await expect(linhas.last()).toContainText(dataBr(diaBrasilia(6)));
  for (let i = 0; i < 6; i++) {
    await expect(linhas.nth(i)).toContainText("09:00");
    await expect(linhas.nth(i)).toContainText(dataBr(diaBrasilia(i + 1)));
  }
  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});

test("nascimento e alta do pacote de 12 dias geram 12 visitas à tarde", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  const linhas = await registrarNascimentoEAlta(
    page,
    "Família Teste Violeta",
    12,
  );

  await expect(linhas.first()).toContainText("D1");
  await expect(linhas.last()).toContainText("D12");
  await expect(linhas.last()).toContainText(dataBr(diaBrasilia(12)));
  for (let i = 0; i < 12; i++) {
    await expect(linhas.nth(i)).toContainText("14:00");
  }
  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});

test("a data de nascimento não aceita o futuro e a alta só aparece depois do nascimento", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  // Hortênsia ainda não nasceu: o servidor recusa data futura mesmo se o navegador deixar passar.
  await abrirAlocacao(page, "Família Teste Hortênsia");
  const nascimento = page.locator("form[data-form='nascimento']");
  await nascimento
    .getByLabel("Data do nascimento")
    .evaluate((el: HTMLInputElement, v) => {
      el.removeAttribute("max");
      el.value = v;
    }, diaBrasilia(3));
  await nascimento
    .getByRole("button", { name: "Registrar o nascimento" })
    .click();
  await expect(
    page.getByText(
      "Nascimento e alta são fatos: a data não pode ser depois de hoje.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registrar a alta" }),
  ).toHaveCount(0);
});
