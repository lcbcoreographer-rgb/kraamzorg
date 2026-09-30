import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { cartaoConsulta, diaBrasilia } from "./apoio";

/**
 * P35 (aceite): consulta pré-natal e entrevista do DOC 1 com famílias
 * sintéticas. A entrevista nova nasce em branco, o aviso das 34 semanas é só
 * da coordenação e sair da entrevista na etapa 4 reabre na etapa 4, no campo
 * onde parou.
 */

async function marcarConsulta(
  page: import("@playwright/test").Page,
  nome: string,
) {
  await page.goto("/prenatal");
  await cartaoConsulta(page, nome)
    .getByRole("link", { name: "Marcar a consulta" })
    .click();
  await page.waitForURL(/\/prenatal\/[0-9a-f-]+$/);
  await page.getByLabel("Dia da consulta").fill(diaBrasilia(1));
  await page.getByLabel("Horário").fill("10:00");
  await page.getByRole("button", { name: "Marcar a consulta" }).click();
  await expect(page.getByText("Consulta marcada.")).toBeVisible();
}

test("a entrevista nova nasce em branco, sem copiar nada de outra família", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await marcarConsulta(page, "Família Teste Begônia");

  await expect(page.getByText("Etapa 1 de 8")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Entrevista pré-natal" }),
  ).toBeVisible();
  // Nada de outra família e nenhuma opção de duplicar entrevista.
  await expect(page.getByText("Helena Teste")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /copiar|duplicar/i }),
  ).toHaveCount(0);

  // Etapa 2 (identificação): campos vazios.
  await page.getByRole("button", { name: "Próxima etapa" }).click();
  await expect(page.getByText("Etapa 2 de 8")).toBeVisible();
  await expect(page.getByLabel("Nome da gestante")).toHaveValue("");
  await expect(page.getByLabel("Nome do companheiro")).toHaveValue("");

  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});

test("família de 34 semanas gera aviso só para a coordenação", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/prenatal");
  await expect(
    page.getByText(/chegou às 34 semanas|chegaram às 34 semanas/),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Aviso interno da coordenação. Nada foi enviado às famílias.",
    ),
  ).toBeVisible();
  await expect(
    cartaoConsulta(page, "Família Teste Antúrio").getByText(
      "Chegou às 34 semanas",
    ),
  ).toBeVisible();
  // Quem está longe das 34 semanas não recebe o aviso.
  await expect(
    cartaoConsulta(page, "Família Teste Begônia").getByText(
      "Chegou às 34 semanas",
    ),
  ).toHaveCount(0);
  await semViolacaoGrave(page);
  await semRolagemLateral(page);

  // O comercial não abre a tela nem vê o aviso (o conteúdo é assistencial).
  await entrarComo(page, "Comercial");
  await page.goto("/prenatal");
  await expect(page).not.toHaveURL(/\/prenatal/);
  await expect(page.getByText("34 semanas")).toHaveCount(0);
});

test("sair da entrevista na etapa 4 e voltar reabre na etapa 4, no campo onde parou", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await marcarConsulta(page, "Família Teste Camélia");
  await expect(page.getByText("Etapa 1 de 8")).toBeVisible();

  for (const etapa of [2, 3, 4]) {
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await expect(page.getByText(`Etapa ${etapa} de 8`)).toBeVisible();
  }
  const campo = page.getByLabel("Intercorrências na gestação atual");
  await campo.fill("Nenhuma até agora");
  // Espera o envio que leva esta resposta (e a marca da etapa 4 junto).
  const subiu = page.waitForResponse(
    (r) =>
      r.url().includes("/api/sync/prenatal") &&
      r.ok() &&
      (r.request().postData() ?? "").includes("Nenhuma até agora"),
  );
  await campo.blur();
  await subiu;

  // Sai da entrevista e volta pela lista.
  await page.goto("/prenatal");
  const cartao = cartaoConsulta(page, "Família Teste Camélia");
  await expect(cartao.getByText(/Etapa 4 de 8/)).toBeVisible();
  await cartao.getByRole("link", { name: "Retomar da etapa 4" }).click();
  await page.waitForURL(/\/prenatal\/[0-9a-f-]+$/);

  await expect(page.getByText("Etapa 4 de 8")).toBeVisible();
  const mesmoCampo = page.getByLabel("Intercorrências na gestação atual");
  await expect(mesmoCampo).toHaveValue("Nenhuma até agora");
  await expect(mesmoCampo).toBeFocused();
});

test("em outro aparelho, o servidor guarda a etapa e o campo", async ({
  browser,
  page,
}, info) => {
  const uso = info.project.use;
  await entrarComo(page, "Coordenação");
  // Jasmim já chegou à etapa 4 no seed sintético.
  await page.goto("/prenatal");
  const cartao = cartaoConsulta(page, "Família Teste Jasmim");
  await expect(cartao.getByText(/Etapa 4 de 8/)).toBeVisible();

  const outro = await browser.newContext({
    baseURL: uso.baseURL,
    viewport: uso.viewport ?? undefined,
    userAgent: uso.userAgent,
    isMobile: uso.isMobile,
    hasTouch: uso.hasTouch,
  });
  const paginaNova = await outro.newPage();
  try {
    await entrarComo(paginaNova, "Coordenação");
    await paginaNova.goto("/prenatal");
    await cartaoConsulta(paginaNova, "Família Teste Jasmim")
      .getByRole("link", { name: "Retomar da etapa 4" })
      .click();
    await paginaNova.waitForURL(/\/prenatal\/[0-9a-f-]+$/);
    await expect(paginaNova.getByText("Etapa 4 de 8")).toBeVisible();
  } finally {
    await outro.close();
  }
});
