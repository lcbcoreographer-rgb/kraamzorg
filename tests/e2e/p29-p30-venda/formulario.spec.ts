import { expect, test, type Page } from "@playwright/test";
import { semRolagemLateral, semViolacaoGrave } from "../apoio/entrar";
import { dubleTurnstile, entrarEmAal2 } from "./apoio";

/**
 * P30 · Proposta e formulário seguro, modo demonstração. Aceite: o token
 * funciona uma vez e expira; o CPF nunca aparece em log, URL ou Sentry; e2e
 * do formulário no celular (o projeto celular-venda roda em 390 px).
 *
 * A Família Teste Gruta está em "Proposta enviada", em Granja Viana (taxa
 * de deslocamento), com o parceiro cadastrado (a testemunha sugerida).
 */
test.describe.configure({ mode: "serial" });

const CPF = "111.444.777-35";
const CPF_DIGITOS = "11144477735";

async function abrirPropostaDaGruta(page: Page) {
  await entrarEmAal2(page, "Comercial");
  await page.goto("/familias?busca=Gruta");
  await page.getByRole("link", { name: /Família Teste Gruta/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  const familiaId = new URL(page.url()).pathname.split("/")[2]!;

  // A proposta pede AAL2 (a tela sem o código está no teste de ação,
  // proposta/acoes.test.ts); aqui a sessão já entrou em AAL2.
  await page.goto(`/familias/${familiaId}/proposta`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Proposta para a Família Teste Gruta",
    }),
  ).toBeVisible();
  return familiaId;
}

let linkFormulario = "";

test("proposta com a taxa da cidade, parcelas e o link do formulário no texto aprovado", async ({
  page,
}) => {
  await abrirPropostaDaGruta(page);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Proposta para a Família Teste Gruta",
    }),
  ).toBeVisible();

  await page.getByRole("radio", { name: /^Essencial/ }).check();
  await page.getByText("3x sem juros no cartão", { exact: true }).click();
  await page.getByText("3x", { exact: true }).click();

  const resumo = page.getByRole("complementary", {
    name: "Resumo da proposta",
  });
  await expect(resumo.getByText("R$ 4.550")).toBeVisible();
  await expect(
    resumo.getByText(
      /3 parcelas de R\$ 1\.516,66; a primeira fica em R\$ 1\.516,68/,
    ),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await page.getByRole("button", { name: "Salvar a proposta" }).click();
  await expect(
    page.getByText(
      "Proposta salva. O próximo passo é gerar o link do formulário para a família.",
    ),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Gerar o link do formulário" })
    .click();
  const texto = page.locator("[data-texto-formulario]");
  await expect(texto).toContainText("/formulario/");
  const achado = /(https?:\/\/[^\s]+\/formulario\/[A-Za-z0-9_-]{43})/.exec(
    (await texto.textContent()) ?? "",
  );
  expect(achado).not.toBeNull();
  linkFormulario = achado![1]!;
  await expect(
    page.getByRole("link", { name: "Abrir no WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
  // O token não vai para a barra de endereço da equipe.
  expect(page.url()).not.toContain(linkFormulario.split("/").pop()!);
});

test("a família preenche no celular, o link vale uma vez e o CPF não sai em nenhuma URL", async ({
  page,
}) => {
  expect(linkFormulario).not.toBe("");
  await page.context().clearCookies();
  await dubleTurnstile(page);
  const urls: string[] = [];
  page.on("request", (pedido) => urls.push(pedido.url()));

  await page.goto(linkFormulario);
  await expect(page).toHaveTitle("Dados do contrato · Kraamzorg Brasil");
  await expect(
    page.getByRole("heading", { level: 1, name: "Oi, Juliana." }),
  ).toBeVisible();
  await expect(
    page.getByText(/pediu estes dados para preparar o contrato de vocês/),
  ).toBeVisible();
  await expect(page.getByText("Etapa 1 de 3")).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  // Erro gentil e específico, sem apagar o que foi digitado.
  await page.getByLabel("Nome completo").fill("Juliana Teste Gruta");
  await page.getByLabel("CPF").fill("111.444.777-3");
  await page.getByLabel("Data de nascimento").fill("17/05/1994");
  await page.getByLabel("E-mail").fill("juliana.teste@exemplo.invalid");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByText("Esse CPF tem 10 números. Confira se faltou algum."),
  ).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveValue(
    "Juliana Teste Gruta",
  );
  await expect(page.getByLabel("CPF")).toBeFocused();

  await page.getByLabel("CPF").fill(CPF);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Etapa 2 de 3")).toBeVisible();
  await page.getByLabel("CEP").fill("01310-100");
  await page.getByLabel("Rua ou avenida").fill("Rua de Teste");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByLabel("Bairro").fill("Bairro de Teste");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("Estado").fill("sp");
  await page.getByText("Sim, o mesmo").click();
  await semViolacaoGrave(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Etapa 3 de 3")).toBeVisible();
  // O parceiro vem sugerido como testemunha; com o nome, pede o e-mail.
  await expect(
    page.getByLabel(/Nome de quem assina como testemunha/),
  ).toHaveValue("Diego Teste Gruta");
  await page
    .getByLabel(/E-mail da testemunha/)
    .fill("diego.teste@exemplo.invalid");
  await page.getByLabel("Concordo").check();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
  await page.getByRole("button", { name: "Enviar os dados" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Recebemos, Juliana." }),
  ).toBeVisible();
  await expect(
    page.getByText(/pela Autentique, a plataforma de assinatura/),
  ).toBeVisible();

  // Uso único: o mesmo link, de novo, já não abre o formulário.
  await page.goto(linkFormulario);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Este link já foi usado ou venceu.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("CPF")).toHaveCount(0);

  for (const url of urls) {
    expect(url).not.toContain(CPF_DIGITOS);
    expect(decodeURIComponent(url)).not.toContain(CPF);
  }
});

test("link que não existe mostra o caminho de volta, sem formulário", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(`/formulario/${"x".repeat(43)}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Este link já foi usado ou venceu.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/é só pedir pelo WhatsApp da Kraamzorg/),
  ).toBeVisible();
  const resposta = await page.request.get(`/formulario/${"y".repeat(43)}`);
  expect(resposta.headers()["referrer-policy"]).toBe("no-referrer");
  expect(resposta.headers()["x-robots-tag"]).toContain("noindex");
  await semViolacaoGrave(page);
});

test("depois do envio, a proposta mostra que os dados chegaram", async ({
  page,
}) => {
  await abrirPropostaDaGruta(page);
  await expect(page.getByText(/Dados recebidos em/)).toBeVisible();
  await expect(page.getByText(CPF)).toHaveCount(0);
});
