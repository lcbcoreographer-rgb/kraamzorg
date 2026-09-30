import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";
import { porProjeto } from "../p13-configuracoes/apoio";

/**
 * P27 item 1 · Conversas (`/conversas`), modo demonstração
 * (`KZ_DADOS=demonstracao`, `playwright.config.ts`). Desde 30/09, em duas
 * colunas como o WhatsApp Web: a lista com quem conduz, a última mensagem
 * e a transferência aberta; a conversa ao lado (computador) ou em tela
 * cheia (celular), com as ações que antes ficavam no cartão da lista.
 *
 * `porProjeto`: celular e computador rodam contra o mesmo servidor de
 * demonstração, com a mesma loja em memória (`tests/e2e/p13-configuracoes/apoio.ts`).
 * O teste que assume uma conversa usa uma família diferente por projeto
 * (Aurora e Íris, as duas "Isadora conduzindo" no seed) para não brigar
 * pela mesma linha.
 */
test("lista por situação, com filtro, e é acessível", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  await expect(
    page.getByRole("heading", { level: 1, name: "Conversas" }),
  ).toBeVisible();
  await expect(page.getByText("Família Teste Aurora")).toBeVisible();
  await expect(
    page
      .getByText("Família Teste Dália")
      .or(page.getByText("Família Teste Horizonte")),
  ).toBeVisible();

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("Assumir conversa pausa a Isadora e mostra 'Devolver agora'", async ({
  page,
}, info) => {
  const familia = porProjeto(
    info,
    "Família Teste Aurora",
    "Família Teste Íris",
  );
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  // A linha inteira abre a conversa; as ações moram nela.
  await page.getByRole("link", { name: new RegExp(familia) }).click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+$/);
  const conversa = page.getByRole("region", {
    name: `Conversa com ${familia}`,
  });
  await conversa.getByRole("button", { name: "Assumir conversa" }).click();

  await expect(
    conversa.getByText("Isadora pausada nesta conversa"),
  ).toBeVisible();
  await expect(
    conversa.getByRole("button", { name: "Devolver agora" }),
  ).toBeVisible();
});

test("lista e conversa lado a lado no computador; no celular, a conversa em tela cheia com voltar", async ({
  page,
}, info) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");
  await page.getByRole("link", { name: /Família Teste Horizonte/ }).click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+$/);
  const conversa = page.getByRole("region", {
    name: "Conversa com Família Teste Horizonte",
  });
  await expect(conversa).toBeVisible();
  // Mensagens em balões: a família à esquerda, a equipe à direita.
  await expect(
    conversa.getByText("Fechado, pode preparar o contrato"),
  ).toBeVisible();

  const lista = page.getByRole("heading", { level: 1, name: "Conversas" });
  if (info.project.name === "computador") {
    await expect(lista).toBeVisible();
    // A linha da conversa aberta fica marcada na lista ao lado.
    await expect(
      page
        .getByRole("list", { name: "Todas" })
        .getByRole("link", { name: /Família Teste Horizonte/ }),
    ).toHaveAttribute("aria-current", "page");
  } else {
    await expect(
      page.getByRole("link", { name: /Família Teste Aurora/ }),
    ).toBeHidden();
    await conversa
      .getByRole("link", { name: "Voltar para as conversas" })
      .click();
    await page.waitForURL(/\/conversas$/);
    await expect(lista).toBeVisible();
  }
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("filtro 'Não lead' mostra só quem não é lead", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  await page.getByRole("button", { name: /^Não lead/ }).click();
  await expect(
    page.getByText("Não lead", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Família Teste Aurora")).toHaveCount(0);
});

test("humano_comercial: resolver não reativa a Isadora; só 'Devolver à Isadora', com confirmação, devolve e grava no log", async ({
  page,
}, info) => {
  // A Família Teste Horizonte é a única conversa em humano_comercial do
  // seed, e o teste muda o estado dela: roda só no computador para os dois
  // projetos não disputarem a mesma linha da loja em memória.
  test.skip(
    info.project.name !== "computador",
    "estado compartilhado: um projeto só",
  );

  await entrarComo(page, "Comercial");
  await page.goto("/conversas");

  await page.getByRole("link", { name: /Família Teste Horizonte/ }).click();
  await page.waitForURL(/\/conversas\//);
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toBeVisible();

  // 1. Resolver a transferência (aceite do P27): a conversa continua com a equipe.
  await page
    .getByRole("button", { name: "Marcar como resolvida" })
    .first()
    .click();
  await page.getByLabel("Formulário enviado").check();
  await page
    .getByRole("button", { name: "Marcar como resolvida" })
    .last()
    .click();
  await expect(
    page.getByRole("region", { name: "Transferência aberta" }),
  ).toHaveCount(0);
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toBeVisible();
  await expect(
    page.getByText("A Isadora está conduzindo esta conversa"),
  ).toHaveCount(0);

  // 2. Só o botão específico devolve, com a confirmação explicando quando ela volta.
  await page.getByRole("button", { name: "Devolver à Isadora" }).click();
  const dialogo = page.getByRole("dialog", {
    name: "Devolver esta conversa à Isadora",
  });
  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByText(/a partir da próxima mensagem da família/),
  ).toBeVisible();
  await semViolacaoGrave(page);
  await dialogo.getByRole("button", { name: "Devolver à Isadora" }).click();

  // 3. Saiu de humano_comercial e ficou registrado na própria conversa.
  await expect(page.getByText(/A Isadora saiu desta conversa/)).toHaveCount(0);
  await expect(
    page.getByText("A Isadora está conduzindo esta conversa"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Conversa com Família Teste Horizonte" })
      .getByText(/devolveu a conversa à Isadora às/),
  ).toBeVisible();
});
