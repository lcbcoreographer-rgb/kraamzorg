import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { familiaPorNome } from "../../src/lib/dados/demonstracao/fixtures";
import { abrirComo, estadoNaEquipe, ID_VISITA_MARE_D2 } from "./apoio";

/**
 * P38, aceite: "a enfermeira vê só as famílias atribuídas; o dia funciona
 * offline; chegada e saída ficam registradas". O offline de verdade (rede
 * desligada e service worker) está em tests/e2e-offline/portal-enfermeira.
 * spec.ts, no build de produção. Aqui, a enfermeira fictícia é a "Profissional
 * Teste Sul 2": titular da Maré e da Jade, sem nenhuma ligação com a Lua
 * (Norte 1), a Horizonte e a Íris.
 */
test.describe("portal da enfermeira", () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, "Enfermeira");
  });

  test("vê só as famílias atribuídas a ela", async ({ page }) => {
    await page.goto("/minhas-familias");
    await expect(
      page.getByRole("heading", { level: 1, name: "Famílias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Família Teste Maré" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Família Teste Jade" }),
    ).toBeVisible();
    for (const alheia of ["Lua", "Horizonte", "Íris", "Aurora"]) {
      await expect(page.getByText(`Família Teste ${alheia}`)).toHaveCount(0);
    }
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("a ficha de família de outra enfermeira não abre", async ({ page }) => {
    // A página responde em streaming, então o status HTTP já saiu como 200;
    // o que vale é o conteúdo: a tela de "não encontrada" e nenhum dado da Lua.
    await page.goto(`/minhas-familias/${familiaPorNome("Lua").id}`);
    await expect(
      page.getByRole("heading", { name: "This page could not be found." }),
    ).toBeVisible();
    await expect(page.getByText("Família Teste Lua")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Casa e contato" }),
    ).toHaveCount(0);
  });

  test("a ficha de uma família atribuída mostra contato, endereço e visitas", async ({
    page,
  }) => {
    await page.goto("/minhas-familias");
    await page.getByRole("link", { name: /Família Teste Maré/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Família Teste Maré" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Casa e contato" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Visitas" })).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o Hoje mostra as visitas do dia com endereço, horário e a régua de dias", async ({
    page,
  }) => {
    await page.goto("/hoje");
    await expect(
      page.getByRole("heading", { level: 1, name: /^Hoje, / }),
    ).toBeVisible();
    const mare = page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`);
    await expect(mare).toBeVisible();
    await expect(mare).toContainText("Família Teste Maré");
    await expect(mare).toContainText("D2 de 6");
    await expect(mare).toContainText("09:00");
    await expect(mare).toContainText("Rua Fictícia das Acácias");
    await expect(mare.getByRole("button", { name: "Cheguei" })).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("Perfil e Alertas abrem, com o Sair no Perfil", async ({ page }) => {
    await page.goto("/perfil");
    await expect(
      page.getByRole("heading", { level: 1, name: "Perfil" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sua semana" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Seus documentos" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
    await page.goto("/alertas");
    await expect(
      page.getByRole("heading", { level: 1, name: "Alertas" }),
    ).toBeVisible();
  });

  test("é instalável: manifesto, ícones e service worker abrem sem sessão", async ({
    browser,
  }, info) => {
    const anonimo = await browser.newContext({
      baseURL: info.project.use.baseURL,
    });
    const manifesto = await anonimo.request.get("/manifest.webmanifest");
    expect(manifesto.status()).toBe(200);
    const corpo = await manifesto.json();
    expect(corpo).toMatchObject({
      display: "standalone",
      start_url: "/hoje",
      lang: "pt-BR",
    });
    const tamanhos = (corpo.icons as { sizes: string }[]).map((i) => i.sizes);
    expect(tamanhos).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icone of corpo.icons as { src: string }[]) {
      expect((await anonimo.request.get(icone.src)).status()).toBe(200);
    }
    const sw = await anonimo.request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    // O service worker não carrega nenhum dado de família.
    const texto = await sw.text();
    expect(texto).not.toMatch(/Família Teste|Maré|Jade/);
    const casco = await anonimo.request.get("/portal-offline");
    expect(casco.status()).toBe(200);
    expect(await casco.text()).not.toMatch(/Família Teste/);
    await anonimo.close();
  });

  test("chegada muda a enfermeira para em visita e a saída a devolve ao estado anterior", async ({
    page,
    browser,
  }, info) => {
    const coordenacao = await abrirComo(browser, info, "Coordenação");
    const antes = await estadoNaEquipe(coordenacao);
    expect(antes).not.toBe("Em visita");

    await page.goto("/hoje");
    const mare = page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`);
    await mare.getByRole("button", { name: "Cheguei" }).click();
    await expect(
      mare.getByRole("button", { name: "Saí da casa" }),
    ).toBeVisible();
    await expect(mare.locator('[data-marca="chegada"]')).not.toContainText(
      "ainda não",
    );

    // A fila sobe sozinha; a coordenação passa a ver "Em visita" (estado calculado).
    await expect
      .poll(async () => estadoNaEquipe(coordenacao), {
        timeout: 30_000,
        intervals: [1_000],
      })
      .toBe("Em visita");
    await expect(mare.locator('[data-marca="chegada"]')).toContainText(
      "Sincronizado",
      {
        timeout: 15_000,
      },
    );

    await mare.getByRole("button", { name: "Saí da casa" }).click();
    await expect(mare.locator('[data-marca="saída"]')).not.toContainText(
      "ainda não",
    );
    await expect
      .poll(async () => estadoNaEquipe(coordenacao), {
        timeout: 30_000,
        intervals: [1_000],
      })
      .toBe(antes);
    await expect(mare).toContainText("Saída gravada");
    await coordenacao.context().close();
  });
});
