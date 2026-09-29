import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { daquiDias, entrarEmAal2 } from "./apoio";

/**
 * P29 · Sessão de venda, modo demonstração. Aceite: e2e com a sessão
 * agendada movendo o P1; comercial que não conduziu não vê a gravação.
 *
 * A Família Teste Cedro nasce "qualificado" e com o pedido de conversa da
 * Isadora (transferência "reuniao", com duas opções de horário). A
 * Família Teste Gruta já teve a conversa, conduzida pela coordenação, com
 * consentimento e transcrição fictícia.
 */
test.describe.configure({ mode: "serial" });

test("marcar a partir do pedido de conversa move o P1 para Sessão agendada", async ({
  page,
}) => {
  const errosDaPagina: string[] = [];
  page.on("pageerror", (erro) => errosDaPagina.push(String(erro)));
  await entrarEmAal2(page, "Comercial");
  await page.goto("/transferencias");
  await page.getByRole("link", { name: "Marcar na agenda" }).first().click();
  await page.waitForURL(/\/sessoes-venda\/nova\?transferencia=/);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Conversa de orientação com a Família Teste Cedro",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A família sugeriu à Isadora: quinta à noite ou sábado de manhã.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Qualificado", { exact: true })).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page.getByLabel("Dia", { exact: true }).fill(daquiDias(5));
  await page.getByLabel("Horário").fill("19:00");
  await page
    .getByLabel("Link da reunião")
    .fill("https://meet.exemplo.invalid/cedro");
  await page.getByRole("button", { name: "Marcar a conversa" }).click();

  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}\?feito=marcada/);
  expect(errosDaPagina, errosDaPagina.join("\n")).toEqual([]);
  await expect(
    page.getByText(
      "Conversa marcada. A família passou para Sessão agendada no pipeline e o lembrete da véspera já está nas tarefas.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/às 19:00, com Perfil Teste Coordenacao/),
  ).toBeVisible();

  // O P1 mudou de verdade: a ficha mostra o estágio novo.
  await page.goto("/familias?busca=Cedro");
  await page.getByRole("link", { name: /Família Teste Cedro/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  await expect(
    page.getByText("Sessão agendada", { exact: true }),
  ).toBeVisible();

  // O pedido da Isadora saiu da fila, e a agenda mostra a conversa.
  await page.goto("/sessoes-venda");
  await expect(
    page.getByRole("heading", { name: "Pedidos de conversa" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Família Teste Cedro/ }),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("comercial que não conduziu não vê a gravação, a transcrição nem o resumo", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  await page.goto("/sessoes-venda");
  await page.getByRole("link", { name: /Família Teste Gruta/ }).click();
  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}$/);

  await expect(
    page.getByText(
      "A gravação, a transcrição e o resumo desta conversa ficam só com quem conduziu e com a diretoria.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel(/Transcrição da conversa/)).toHaveCount(0);
  await expect(page.getByText(/amamentação sozinha/i)).toHaveCount(0);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("quem conduziu vê o consentimento e a transcrição, e o resumo automático diz que está desligado", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/sessoes-venda");
  await page.getByRole("link", { name: /Família Teste Gruta/ }).click();
  await page.waitForURL(/\/sessoes-venda\/[0-9a-f-]{36}$/);

  await expect(
    page.getByText("Leia para a família antes de gravar"),
  ).toBeVisible();
  await expect(page.getByLabel(/Transcrição da conversa/)).not.toHaveValue("");
  await expect(
    page.getByText(/O resumo automático está desligado neste ambiente/),
  ).toBeVisible();

  await page
    .getByLabel("Dúvidas da família")
    .fill("Se a enfermeira dorme em casa");
  await page.getByRole("button", { name: "Salvar resumo" }).click();
  await expect(
    page.getByText(
      "Resumo salvo junto da transcrição, com o mesmo acesso: quem conduziu e a diretoria.",
    ),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});
