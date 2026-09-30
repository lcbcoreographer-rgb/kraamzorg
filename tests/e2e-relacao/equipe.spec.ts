import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P50 e P51 · Parceiros médicos e indicações, tarefas por equipe, manuais e
 * treinamentos, banco de talentos. Modo demonstração.
 */

test.describe.configure({ mode: "serial" });

test("parceiros: o aviso da vedação ética fica no topo e não há campo de valor", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/parceiros");
  await expect(
    page.getByRole("heading", { level: 1, name: "Parceiros médicos" }),
  ).toBeVisible();
  await expect(
    page.getByText("Parceria não tem contrapartida financeira"),
  ).toBeVisible();
  await expect(page.getByText(/não paga nem oferece comissão/)).toBeVisible();
  await expect(page.getByLabel(/valor|comissão|desconto/i)).toHaveCount(0);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("indicação de médico entra no relatório por médico e na origem do marketing", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/parceiros");
  await page.getByLabel("Família que foi indicada").selectOption({ index: 1 });
  await page
    .getByLabel("Quem indicou")
    .selectOption({ label: "Médico parceiro: Dra. Teste Obstetra" });
  await page.getByRole("button", { name: "Registrar indicação" }).click();
  await expect(page.getByText(/origem indicação de médico/)).toBeVisible();

  await page.goto("/parceiros");
  await expect(
    page.getByRole("table", { name: "Indicações por médico parceiro" }),
  ).toContainText("Dra. Teste Obstetra");

  await entrarComo(page, "Diretoria");
  await page.goto("/marketing");
  await expect(
    page.getByRole("table", { name: "Leads e receita por origem" }),
  ).toContainText("Indicação médica");
});

test("tarefas de relacionamento com o médico viram tarefa da equipe", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/parceiros");
  const cartao = page.locator('[data-parceiro="Dra. Teste Obstetra"]');
  await cartao
    .getByLabel("Nova tarefa de relacionamento")
    .fill("Enviar a apresentação institucional");
  await cartao.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(cartao.getByText(/Tarefa criada/)).toBeVisible();
});

test("tarefas por equipe: coordenação vê, comercial não", async ({ page }) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/tarefas-equipe");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tarefas por equipe" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Tarefas abertas por equipe" }),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await entrarComo(page, "Comercial");
  await page.goto("/tarefas-equipe");
  await expect(page).not.toHaveURL(/\/tarefas-equipe$/);
});

test("manual: a coordenação publica uma versão nova e a enfermeira precisa confirmar de novo", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/manuais");
  await expect(
    page.getByRole("heading", { level: 1, name: "Manuais e protocolos" }),
  ).toBeVisible();
  const primeiro = page
    .locator("[data-manual]")
    .filter({ hasText: "Enfermagem" })
    .first();
  const titulo = await primeiro.getAttribute("data-manual");
  await primeiro.getByRole("link").click();
  await page.waitForURL(/\/manuais\/[0-9a-f-]+$/);
  const url = page.url();

  // Sem dizer o que mudou, o texto novo não salva.
  await page
    .getByLabel("Texto")
    .fill("Passo um. Passo dois. Passo novo do teste.");
  await page.getByRole("button", { name: "Salvar manual" }).click();
  await expect(page.getByText(/Diga em uma frase o que mudou/)).toBeVisible();

  await page
    .getByLabel("O que mudou nesta versão")
    .fill("Incluído o passo novo.");
  await page.getByRole("button", { name: "Salvar manual" }).click();
  await expect(page.getByText(/Salvo como versão/)).toBeVisible();

  await entrarComo(page, "Enfermeira");
  await page.goto(url);
  await expect(
    page.getByRole("heading", { level: 1, name: titulo ?? "" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Li e entendi esta versão" }).click();
  await expect(page.getByText(/Leitura confirmada/)).toBeVisible();

  await page.goto("/treinamentos");
  await expect(
    page.getByRole("heading", { name: "Treinamentos" }).first(),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("banco de talentos: entrevista com o roteiro de 26 perguntas e 10 critérios", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/talentos");
  await expect(
    page.getByRole("heading", { level: 1, name: "Banco de talentos" }),
  ).toBeVisible();
  await expect(page.getByText("Página de candidatura desligada")).toBeVisible();
  await semRolagemLateral(page);

  await page
    .getByRole("table", { name: "Candidatas" })
    .getByRole("link")
    .first()
    .click();
  await page.waitForURL(/\/talentos\/[0-9a-f-]+$/);
  const form = page.getByRole("form", { name: "Avaliação da entrevista" });
  await expect(form.locator('textarea[name^="resposta:"]')).toHaveCount(26);
  await expect(form.getByRole("radiogroup")).toHaveCount(10);

  // Uma nota só: a avaliação parcial vale e diz quantos critérios faltam.
  await form
    .getByRole("radiogroup")
    .first()
    .getByText("4", { exact: true })
    .click();
  await form.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(
    page.getByText(/Avaliação salva com 1 de 10 critérios/),
  ).toBeVisible();
  await semViolacaoGrave(page);
});

test("banco de talentos é da coordenação e da diretoria", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/talentos");
  await expect(page).not.toHaveURL(/\/talentos$/);
});
