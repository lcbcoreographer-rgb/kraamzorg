import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { abrirAlocacao, cartaoRadar } from "./apoio";

/**
 * P36 (aceite): a recusa da titular aciona o backup e avisa a coordenação.
 * Família Teste Girassol: titular com oferta sem resposta (a enfermeira de
 * teste) e backup já aceita.
 */
test("a recusa da titular aciona o backup e avisa a coordenação", async ({
  page,
}) => {
  // A enfermeira vê a oferta e recusa com o motivo.
  await entrarComo(page, "Enfermeira");
  await page.goto("/ofertas");
  const oferta = page.locator("[data-oferta]", {
    has: page.getByRole("heading", { name: "Família Teste Girassol" }),
  });
  await expect(oferta).toBeVisible();
  await expect(oferta.getByText("Titular", { exact: true })).toBeVisible();
  await semViolacaoGrave(page);
  await semRolagemLateral(page);

  await oferta.getByText("Não posso aceitar").click();
  await oferta.getByText("Folga ou bloqueio").click();
  await oferta.getByRole("button", { name: "Recusar a oferta" }).click();
  await expect(
    oferta.getByText(/O backup assumiu a família e a coordenação foi avisada/),
  ).toBeVisible();

  // A coordenação vê o backup como titular e a pendência de novo backup.
  await entrarComo(page, "Coordenação");
  await abrirAlocacao(page, "Família Teste Girassol");
  const titular = page.locator("[data-papel='titular']");
  await expect(titular.getByText("Profissional Teste Sul 3")).toBeVisible();
  await expect(titular.getByText("Aceita")).toBeVisible();
  await expect(titular.getByText("Profissional Teste Sul 2")).toBeVisible();
  await expect(titular.getByText("Recusada")).toBeVisible();
  await expect(
    titular.getByText(/Folga ou bloqueio|folga ou bloqueada/i),
  ).toBeVisible();
  await expect(page.getByText("Designar um novo backup")).toBeVisible();
  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});

test("a coordenação oferece a titular e atribui direto o backup em urgência", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await abrirAlocacao(page, "Família Teste Lírio");

  // Oferta: a enfermeira tem o prazo para responder.
  const titular = page.locator("[data-papel='titular']");
  await titular
    .getByRole("radiogroup", { name: "Quem será a titular" })
    .getByText("Profissional Teste Sul 1")
    .click();
  await titular.getByRole("button", { name: "Fazer a oferta" }).click();
  await expect(titular.getByText("Oferta sem resposta")).toBeVisible();
  await expect(titular.getByText(/Responde até/)).toBeVisible();

  // Atribuição direta pede o motivo e fica no histórico.
  const backup = page.locator("[data-papel='backup']");
  await backup.getByText("Atribuir direto, em urgência").click();
  await backup
    .getByLabel("Quem assume como backup")
    .getByText("Profissional Teste Sul 3")
    .click();
  await backup.getByRole("button", { name: "Atribuir agora" }).click();
  await expect(
    backup.getByText("Escreva o motivo da atribuição direta."),
  ).toBeVisible();
  await backup
    .getByLabel("Motivo da atribuição direta")
    .fill("Titular de folga na semana do parto");
  await backup.getByRole("button", { name: "Atribuir agora" }).click();
  await expect(backup.getByText("Atribuição direta").first()).toBeVisible();
  await expect(backup.getByText("Aceita")).toBeVisible();

  // No radar, os dois aparecem no cartão da família.
  await page.goto("/radar");
  const cartao = cartaoRadar(page, "Família Teste Lírio");
  await expect(cartao.getByText("Profissional Teste Sul 1")).toBeVisible();
  await expect(cartao.getByText("Profissional Teste Sul 3")).toBeVisible();
});

test("o radar mostra a janela do parto, quem está sem contato e a ocupação por praça", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/radar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Radar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Na janela do parto" }),
  ).toBeVisible();

  // Ipê passou da janela, com titular e sem contato há mais de dez dias.
  const ipe = cartaoRadar(page, "Família Teste Ipê");
  await expect(ipe.getByText("Sem backup")).toBeVisible();
  await expect(ipe.getByText(/Sem contato há/)).toBeVisible();

  // Margarida já nasceu: espera a alta.
  await expect(
    page.getByRole("heading", { name: "Já nasceram, aguardando a alta" }),
  ).toBeVisible();
  await expect(
    cartaoRadar(page, "Família Teste Margarida").getByRole("link", {
      name: "Registrar a alta",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Ocupação por praça" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "São Paulo" })).toBeVisible();

  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});
