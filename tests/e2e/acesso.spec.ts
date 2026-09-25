import { expect, test } from "@playwright/test";
import {
  entrarComo,
  passarPeloMfa,
  semRolagemLateral,
  semViolacaoGrave,
} from "./apoio/entrar";

/**
 * P07, parte de app: entrar, MFA (desafio e cadastro com QR), esqueci a
 * senha, convite pela diretoria e revogação de sessões, no modo
 * demonstração. O aceite com Supabase Auth de verdade (senha e TOTP)
 * depende de Docker nesta máquina (docs/sessoes/P07-app.md).
 */

test("a raiz leva para entrar, que passa no axe", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Entrar" }),
  ).toBeVisible();
  await expect(
    page.getByText("Aqui há dados de saúde de gestantes e bebês"),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("sem sessão, a tela pedida volta depois de entrar", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/entrar\?proximo=%2Fpipeline$/);
  await page.getByRole("button", { name: /^Comercial Perfil Teste/ }).click();
  await expect(page).toHaveURL(/\/pipeline$/);
});

// AUTH-01 (revisão de segurança de 25/09/2026): um TAB entre as barras
// ("/%09/site.exemplo") passava pelo filtro do ?proximo= e o navegador, ao
// apagar o TAB, levava a pessoa para outro domínio logo depois de entrar.
for (const [papel, comMfa] of [
  ["Comercial", false],
  ["Diretoria", true],
] as const) {
  test(`AUTH-01: ?proximo= com TAB não tira ${papel.toLowerCase()} do domínio depois de entrar`, async ({
    page,
    baseURL,
  }) => {
    const pedidosDeFora: string[] = [];
    await page.route(
      (url) => url.hostname.endsWith("evil.example"),
      async (rota) => {
        pedidosDeFora.push(rota.request().url());
        await rota.abort();
      },
    );

    await page.goto("/entrar?proximo=%2F%09%2Fevil.example%2Fentrar");
    await page
      .getByRole("button", { name: new RegExp(`^${papel} Perfil Teste`) })
      .click();
    await page.waitForURL((url) => url.pathname !== "/entrar");
    if (comMfa) {
      await expect(page).toHaveURL(/\/mfa\/desafio$/);
      await passarPeloMfa(page);
    }

    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
    expect(page.url()).not.toContain("evil.example");
    expect(pedidosDeFora).toEqual([]);
  });
}

test("diretoria passa pelo desafio do MFA; código errado explica o que fazer", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /^Diretoria Perfil Teste/ }).click();
  await expect(page).toHaveURL(/\/mfa\/desafio/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Confirme que é você" }),
  ).toBeVisible();
  await semViolacaoGrave(page);

  await page.getByLabel("Código").fill("000000");
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await expect(page.getByText("Esse código não confere.")).toBeVisible();

  // Enquanto não confirma, nenhuma tela do painel abre.
  await page.goto("/sessoes");
  await expect(page).toHaveURL(/\/mfa\/desafio\?proximo=%2Fsessoes$/);

  await passarPeloMfa(page);
  await expect(page).toHaveURL(/\/sessoes$/);
});

test("esqueci a senha responde sem revelar se o e-mail existe", async ({
  page,
}) => {
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill("alguem@kraamzorgbrasil.test");
  await page
    .getByRole("button", { name: "Enviar link para criar senha" })
    .click();
  await expect(
    page.getByText("Se este e-mail tiver acesso ao sistema"),
  ).toBeVisible();
  await semViolacaoGrave(page);
});

test("convite pela diretoria, cadastro do MFA com QR e revogação das sessões", async ({
  browser,
}, info) => {
  const nome = `Pessoa Teste Convite ${info.project.name}`;
  const email = `convite.${info.project.name}.${Date.now()}@kraamzorgbrasil.test`;

  // 1. A diretoria convida uma pessoa de coordenação.
  const contextoDiretoria = await browser.newContext();
  const diretoria = await contextoDiretoria.newPage();
  await entrarComo(diretoria, "Diretoria");
  await diretoria.goto("/sessoes");
  await diretoria.getByRole("link", { name: "Convidar pessoa" }).click();
  await expect(diretoria).toHaveURL(/\/convidar$/);
  await semViolacaoGrave(diretoria);
  await diretoria.getByRole("button", { name: "Enviar convite" }).click();
  await expect(
    diretoria.getByText("Digite o nome completo da pessoa."),
  ).toBeVisible();
  await diretoria.getByLabel("Nome completo").fill(nome);
  await diretoria.getByLabel("E-mail").fill(email);
  await diretoria.getByText("Coordenação", { exact: true }).click();
  await diretoria.getByRole("button", { name: "Enviar convite" }).click();
  await expect(
    diretoria.getByText(`Convite enviado para ${email}.`),
  ).toBeVisible();

  // 2. A pessoa convidada entra: coordenação sem MFA vai para o cadastro com QR.
  const contextoConvidada = await browser.newContext();
  const convidada = await contextoConvidada.newPage();
  await convidada.goto("/entrar");
  await convidada.getByRole("button", { name: new RegExp(nome) }).click();
  await expect(convidada).toHaveURL(/\/mfa\/cadastro/);
  await expect(convidada.getByRole("img", { name: /QR code/ })).toBeVisible();
  await semRolagemLateral(convidada);
  await semViolacaoGrave(convidada);
  await passarPeloMfa(convidada);
  await expect(convidada).toHaveURL(/\/inicio$/);

  // 3. A diretoria encerra todas as sessões dessa pessoa.
  await diretoria.goto("/sessoes");
  await diretoria
    .getByRole("button", { name: `Encerrar sessões de ${nome}` })
    .click();
  await expect(
    diretoria.getByRole("dialog", { name: `Encerrar as sessões de ${nome}?` }),
  ).toBeVisible();
  await semViolacaoGrave(diretoria);
  await diretoria
    .getByRole("button", { name: "Encerrar todas as sessões" })
    .click();
  await expect(diretoria.getByText("Sessões encerradas")).toBeVisible();

  // 4. A sessão da pessoa deixa de valer.
  await convidada.goto("/inicio");
  await expect(convidada).toHaveURL(/\/entrar/);

  await contextoDiretoria.close();
  await contextoConvidada.close();
});

test("sem sinal, o desafio do MFA explica que é preciso conexão", async ({
  page,
  context,
}) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /^Diretoria Perfil Teste/ }).click();
  await expect(page).toHaveURL(/\/mfa\/desafio/);
  await context.setOffline(true);
  await page.getByLabel("Código").fill("123456");
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await expect(
    page.getByText("Sem sinal agora. Para continuar é preciso conexão"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/mfa\/desafio/);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/mfa"));
});

test("sem brecha no proxy: extensão, letra codificada e rota sem registro", async ({
  page,
}) => {
  // Sem sessão, rota dinâmica com extensão no fim também pede entrar.
  await page.goto("/familias/qualquer.png");
  await expect(page).toHaveURL(/\/entrar\?proximo=/);

  await entrarComo(page, "Enfermeira");
  await expect(page).toHaveURL(/\/hoje$/);
  for (const caminho of [
    "/familias/qualquer.png",
    "/%70ipeline",
    "/Pipeline",
    "/rota-que-nao-existe",
  ]) {
    await page.goto(caminho);
    await expect(page, caminho).toHaveURL(/\/hoje$/);
  }
});
