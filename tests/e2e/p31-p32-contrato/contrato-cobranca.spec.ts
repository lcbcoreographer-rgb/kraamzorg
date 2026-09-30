import { expect, test, type Page } from "@playwright/test";
import { semRolagemLateral, semViolacaoGrave } from "../apoio/entrar";
import { dubleTurnstile, entrarEmAal2 } from "../p29-p30-venda/apoio";

/**
 * P31 e P32 · Contrato, assinatura eletrônica e cobrança, modo demonstração.
 * Aceite do P31: o fluxo completo (gerar pelo celular, revisar, enviar, assinar)
 * e nenhum estado muda sem o documento de verdade. Aceite do P32: o link sai
 * com no máximo 3 parcelas, a baixa acontece uma vez só e a baixa manual
 * exige comprovante e motivo. Os webhooks de verdade (forjado, duplicado,
 * `payment_check`) estão em Vitest, com o terceiro simulado; aqui a Autentique
 * e a InfinitePay são substituídas pelos botões de demonstração, que passam
 * pelo mesmo caminho do webhook.
 *
 * Roda nos projetos celular-contrato (390 px) e computador-contrato, cada um
 * com o servidor próprio. A Família Teste Gruta parte de "Proposta enviada".
 */
test.describe.configure({ mode: "serial" });

const CPF = "111.444.777-35";
let familiaId = "";
let cobrancaUrl = "";

async function abrirFamilia(page: Page, nome: string): Promise<string> {
  await page.goto(`/familias?busca=${nome}`);
  await page
    .getByRole("link", { name: new RegExp(`Família Teste ${nome}`) })
    .click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/")[2]!;
}

test("a proposta vai até o formulário e a família manda os dados", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  familiaId = await abrirFamilia(page, "Gruta");
  await page.goto(`/familias/${familiaId}/proposta`);

  await page.getByRole("radio", { name: /^Essencial/ }).check();
  await page.getByText("3x sem juros no cartão", { exact: true }).click();
  await page.getByText("3x", { exact: true }).click();
  await page.getByRole("button", { name: "Salvar a proposta" }).click();
  await expect(page.getByText(/Proposta salva/)).toBeVisible();
  await page
    .getByRole("button", { name: "Gerar o link do formulário" })
    .click();
  const texto = page.locator("[data-texto-formulario]");
  await expect(texto).toContainText("/formulario/");
  const achado = /(https?:\/\/[^\s]+\/formulario\/[A-Za-z0-9_-]{43})/.exec(
    (await texto.textContent()) ?? "",
  );
  expect(achado).not.toBeNull();
  const link = achado![1]!;

  await page.context().clearCookies();
  await dubleTurnstile(page);
  await page.goto(link);
  await page.getByLabel("Nome completo").fill("Juliana Teste Gruta");
  await page.getByLabel("CPF").fill(CPF);
  await page.getByLabel("Data de nascimento").fill("17/05/1994");
  await page.getByLabel("E-mail").fill("juliana.teste@exemplo.invalid");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("CEP").fill("01310-100");
  await page.getByLabel("Rua ou avenida").fill("Rua de Teste");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByLabel("Bairro").fill("Bairro de Teste");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("Estado").fill("sp");
  await page.getByText("Sim, o mesmo").click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page
    .getByLabel(/E-mail da testemunha/)
    .fill("diego.teste@exemplo.invalid");
  await page.getByLabel("Concordo").check();
  await page.getByRole("button", { name: "Enviar os dados" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Recebemos, Juliana." }),
  ).toBeVisible();
});

test("o comercial gera o contrato pelo celular, confere o PDF e envia para assinatura", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  await page.goto(`/familias/${familiaId}/proposta`);
  await expect(page.getByText(/Dados recebidos em/)).toBeVisible();
  await page.getByRole("link", { name: "Preparar o contrato" }).click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Contrato da Família Teste Gruta",
    }),
  ).toBeVisible();
  await expect(page.getByText("Etapa 2 de 5: Gerar o contrato.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Os dados chegaram" }),
  ).toBeVisible();
  await expect(page.getByText("Modelo de contrato provisório")).toBeVisible();
  // Quem assina: a gestante, a Kraamzorg e o parceiro como testemunha.
  await expect(page.getByText("Pela Kraamzorg", { exact: true })).toBeVisible();
  await expect(page.getByText("Testemunha", { exact: true })).toBeVisible();
  await expect(page.getByText("j***@exemplo.invalid")).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page.getByRole("button", { name: "Gerar o contrato" }).click();
  await expect(page.getByText(/Contrato gerado\. Abra o PDF/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contrato gerado" }),
  ).toBeVisible();

  // O PDF abre para quem tem permissão, sem cache, com nome pelo id.
  const href = await page
    .getByRole("link", { name: "Abrir o PDF" })
    .getAttribute("href");
  expect(href).toBe(`/familias/${familiaId}/contrato/pdf`);
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect(pdf.headers()["content-disposition"]).toMatch(
    /filename="[0-9a-f-]{36}\.pdf"/,
  );
  const corpo = await pdf.body();
  expect(corpo.subarray(0, 4).toString()).toBe("%PDF");
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  // Confirmação nomeia a ação nos dois botões e lista quem vai receber.
  await page.getByRole("button", { name: "Enviar para assinatura" }).click();
  const dialogo = page.getByRole("dialog", { name: "Enviar para assinatura?" });
  await expect(dialogo.getByText(/Juliana Teste Gruta/)).toBeVisible();
  await expect(dialogo.getByText(/Diego Teste Gruta/)).toBeVisible();
  await expect(
    dialogo.getByRole("button", { name: "Revisar o PDF", exact: true }),
  ).toBeVisible();
  await semViolacaoGrave(page);
  await dialogo.getByRole("button", { name: "Enviar agora" }).click();
  await expect(
    page.getByText(/Contrato enviado\. A Autentique avisa/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Aguardando as assinaturas" }),
  ).toBeVisible();
  await expect(page.getByText("Etapa 4 de 5: Assinaturas.")).toBeVisible();
});

test("assinado: cobrança, link de pagamento e tarefa para o comercial; o comercial não vê valor da cobrança", async ({
  page,
}) => {
  await entrarEmAal2(page, "Comercial");
  await page.goto(`/familias/${familiaId}/contrato`);
  await page
    .getByRole("button", { name: "Simular a assinatura (demonstração)" })
    .click();
  await expect(page.getByText(/Assinatura simulada/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Contrato assinado em/ }),
  ).toBeVisible();
  await expect(page.getByText("Aguardando o pagamento")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a cobrança" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/Vence em/)).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  // A tarefa com o texto link_pagamento chega ao comercial, com o link.
  await page.goto("/tarefas");
  await expect(
    page.getByText("Enviar o link de pagamento para a Família Teste Gruta"),
  ).toBeVisible();
  const textos = await page
    .locator("textarea")
    .evaluateAll((campos) =>
      campos.map((c) => (c as HTMLTextAreaElement).value),
    );
  expect(
    textos.some((t) =>
      t.includes(
        "Aqui está o link de pagamento: https://pay.exemplo.invalid/demo/",
      ),
    ),
  ).toBe(true);
  expect(textos.some((t) => t.includes("em até 3x sem juros"))).toBe(true);

  // E o comercial não chega às cobranças: a casca leva de volta ao início
  // (só o status dele fica dentro do contrato).
  await page.goto("/cobrancas");
  await expect(page).not.toHaveURL(/\/cobrancas/);
});

test("o financeiro vê a cobrança, o link e a baixa vira paga uma vez só", async ({
  page,
}) => {
  await entrarEmAal2(page, "Financeiro");
  await page.goto("/cobrancas");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cobranças" }),
  ).toBeVisible();
  await expect(page.getByText(/esperam pagamento, somando/)).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page.getByRole("link", { name: "Família Teste Gruta" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cobrança da Família Teste Gruta",
    }),
  ).toBeVisible();
  cobrancaUrl = new URL(page.url()).pathname;
  await expect(page.getByText("Aguardando o pagamento").first()).toBeVisible();
  await expect(page.locator("[data-link-pagamento]")).toContainText(
    "https://pay.exemplo.invalid/demo/",
  );
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page
    .getByRole("button", { name: "Simular o pagamento (demonstração)" })
    .click();
  await expect(
    page.getByText("Pagamento simulado. A cobrança está paga."),
  ).toBeVisible();
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();
  await expect(page.getByText("Nota fiscal pendente")).toBeVisible();
  // Depois de paga, não há mais link nem baixa manual.
  await expect(page.getByRole("button", { name: "Dar a baixa" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Simular o pagamento (demonstração)" }),
  ).toHaveCount(0);

  // O comercial vê a cobrança paga dentro do contrato.
  await entrarEmAal2(page, "Comercial");
  await page.goto(`/familias/${familiaId}/contrato`);
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();
});

test("baixa manual: exige comprovante e motivo, guarda o arquivo com nome pelo id e dá a baixa", async ({
  page,
}) => {
  await entrarEmAal2(page, "Financeiro");
  await page.goto("/cobrancas?situacao=aberta");
  await page.getByRole("link", { name: "Família Teste Horizonte" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cobrança da Família Teste Horizonte",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pix recebido fora do sistema" }),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  // Sem comprovante nem motivo, a baixa não sai e a tela diz o que falta.
  await page.getByRole("button", { name: "Dar a baixa" }).click();
  await expect(
    page.getByText("Falta alguma coisa para dar a baixa."),
  ).toBeVisible();
  await expect(
    page.getByText("Anexe o comprovante do pagamento (PDF, PNG ou JPG)."),
  ).toBeVisible();
  await expect(
    page.getByText(/Escreva o motivo em pelo menos 10 letras/),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "comprovante-da-marina.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 comprovante de teste"),
  });
  await page
    .getByLabel("Motivo da baixa")
    .fill("Pix recebido no extrato de 29/09");
  await page.getByRole("button", { name: "Dar a baixa" }).click();
  await expect(page.getByText(/Baixa registrada/)).toBeVisible();
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();

  const comprovante = page.getByRole("link", { name: "Abrir o comprovante" });
  await expect(comprovante).toBeVisible();
  const arquivo = await page.request.get(
    (await comprovante.getAttribute("href"))!,
  );
  expect(arquivo.status()).toBe(200);
  expect(arquivo.headers()["cache-control"]).toContain("no-store");
  expect(arquivo.headers()["content-disposition"]).not.toMatch(/marina/i);
  expect((await arquivo.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("a página de retorno do pagamento é pública, calma e não mostra dado de ninguém", async ({
  page,
}) => {
  await page.context().clearCookies();
  const resposta = await page.goto("/pagamento/recebido");
  expect(resposta?.headers()["x-robots-tag"]).toContain("noindex");
  expect(resposta?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(
    page.getByRole("heading", { level: 1, name: "Obrigado." }),
  ).toBeVisible();
  await expect(
    page.getByText(/a equipe da Kraamzorg recebe o aviso/),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("o PDF e o comprovante não abrem sem sessão nem para quem não tem o papel", async ({
  page,
}) => {
  await page.context().clearCookies();
  const semSessao = await page.request.get(
    `/familias/${familiaId}/contrato/pdf`,
    {
      maxRedirects: 0,
    },
  );
  expect([302, 307, 401, 403]).toContain(semSessao.status());

  await entrarEmAal2(page, "Comercial");
  // A casca leva o comercial de volta ao início; se algum dia deixar passar,
  // o banco recusa (403) ou não acha (404). Nunca 200 com o arquivo.
  const doComercial = await page.request.get(`${cobrancaUrl}/comprovante`, {
    maxRedirects: 0,
  });
  expect([302, 307, 403, 404]).toContain(doComercial.status());
});
