import { expect, test, type Page } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P11 e P14, aceite. Sobre o build de produção (playwright.infra.config.ts).
 *
 * - Cabeçalhos de segurança e CSP com nonce em toda página, sem nenhuma
 *   violação de CSP nas telas principais (a página hidrata: prova de que o
 *   nonce chegou aos scripts do Next).
 * - A instalação guiada reconhece Android com Chrome, iPhone no Safari,
 *   iPhone em outro navegador e computador.
 * - O navegador reconhece o app como instalável (mesmo critério do
 *   Lighthouse: manifesto, ícones e service worker), pelo protocolo de
 *   depuração do Chrome.
 * - /api/saude responde sem dado de pessoa.
 * - O portal da enfermeira pede armazenamento persistente depois do login.
 */

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  desktopFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
} as const;

/** Guarda toda violação de CSP que o navegador relatar na página. */
async function vigiarCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    (window as unknown as { __violacoes: string[] }).__violacoes = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __violacoes: string[] }).__violacoes.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __violacoes: string[] }).__violacoes,
    );
}

test.describe("cabeçalhos de segurança e CSP (P14)", () => {
  test("toda página sai com CSP de nonce novo e os cabeçalhos fixos", async ({
    request,
  }) => {
    const a = await request.get("/entrar");
    const b = await request.get("/entrar");
    const cspA = a.headers()["content-security-policy"] ?? "";
    const cspB = b.headers()["content-security-policy"] ?? "";
    const nonceA = /'nonce-([^']+)'/.exec(cspA)?.[1];
    const nonceB = /'nonce-([^']+)'/.exec(cspB)?.[1];
    expect(nonceA).toBeTruthy();
    expect(nonceB).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
    expect(cspA).toContain("'strict-dynamic'");
    expect(cspA).toContain("frame-ancestors 'none'");
    expect(cspA).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(cspA).not.toMatch(/script-src[^;]*'unsafe-eval'/);

    const h = a.headers();
    expect(h["strict-transport-security"]).toContain("max-age=31536000");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("microphone=(self)");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("o nonce chega aos scripts: as páginas hidratam sem nenhuma violação de CSP", async ({
    page,
  }) => {
    const violacoes = await vigiarCsp(page);
    for (const caminho of ["/entrar", "/instalar", "/portal-offline"]) {
      await page.goto(caminho);
      await page.waitForLoadState("networkidle");
      expect(await violacoes(), caminho).toEqual([]);
    }
    // Hidratou de verdade: a instalação guiada só sai do "Conferindo" com JavaScript.
    await page.goto("/instalar");
    await expect(
      page.getByRole("heading", { level: 1, name: /Instale o Kraamzorg/ }),
    ).toBeVisible();
    await expect(page.getByText("Conferindo o seu aparelho.")).toHaveCount(0);
  });

  test("telas de dentro do app também rodam sem violação de CSP", async ({
    page,
  }) => {
    const violacoes = await vigiarCsp(page);
    await entrarComo(page, "Enfermeira");
    for (const caminho of ["/hoje", "/minhas-familias", "/perfil"]) {
      await page.goto(caminho);
      await page.waitForLoadState("networkidle");
      expect(await violacoes(), caminho).toEqual([]);
    }
  });

  test("rota de API responde com CSP fechada e sem cache", async ({
    request,
  }) => {
    const r = await request.get("/api/saude");
    const h = r.headers();
    expect(h["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(h["cache-control"]).toContain("no-store");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("/api/saude (P14 item 7)", () => {
  test("sem banco, avisa que o sistema não está saudável, sem detalhe para quem não tem o segredo", async ({
    request,
  }) => {
    const r = await request.get("/api/saude");
    expect(r.status()).toBe(503);
    const corpo = await r.json();
    expect(corpo.estado).toBe("falha");
    expect(Object.keys(corpo).sort()).toEqual(["estado", "verificadoEm"]);
  });

  test("com o segredo das rotas internas, diz qual verificação falhou", async ({
    request,
  }) => {
    const r = await request.get("/api/saude", {
      headers: { "x-kz-interno-secret": process.env.KZ_E2E_SEGREDO ?? "" },
    });
    const corpo = await r.json();
    expect(corpo.verificacoes[0]).toMatchObject({
      nome: "banco",
      estado: "falha",
    });
    expect(JSON.stringify(corpo)).not.toMatch(/@|\+55|senha|SUPABASE/i);
  });
});

test.describe("instalação guiada (P11 item 2)", () => {
  const casos: [string, string, RegExp][] = [
    ["Android com Chrome", UA.androidChrome, /No Android, pelo Chrome/],
    ["iPhone no Safari", UA.iphoneSafari, /No iPhone, pelo Safari/],
    [
      "iPhone em outro navegador",
      UA.iphoneChrome,
      /Para instalar, abra no Safari/,
    ],
    [
      "computador com Chrome",
      UA.desktopChrome,
      /No computador, pelo Chrome ou Edge/,
    ],
    [
      "computador com Firefox",
      UA.desktopFirefox,
      /No computador, use o Chrome ou o Edge/,
    ],
  ];

  for (const [nome, userAgent, titulo] of casos) {
    test(`${nome}: mostra o passo a passo certo, sem rolagem lateral e sem violação grave`, async ({
      browser,
    }, info) => {
      const contexto = await browser.newContext({
        userAgent,
        viewport:
          info.project.name === "celular"
            ? { width: 390, height: 844 }
            : { width: 1280, height: 800 },
        baseURL: info.project.use.baseURL,
      });
      const page = await contexto.newPage();
      await page.goto("/instalar");
      await expect(
        page.getByRole("heading", { level: 2, name: titulo }),
      ).toBeVisible();
      if (userAgent === UA.iphoneChrome) {
        await expect(
          page.getByRole("button", { name: "Copiar o endereço" }),
        ).toBeVisible();
      }
      if (userAgent === UA.iphoneSafari) {
        await expect(
          page.getByText("Adicionar à Tela de Início"),
        ).toBeVisible();
      }
      await semRolagemLateral(page);
      await semViolacaoGrave(page);
      await contexto.close();
    });
  }

  test("aberta como aplicativo, diz que já está instalado e leva ao Hoje", async ({
    page,
  }) => {
    await page.emulateMedia({ media: "screen" });
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (consulta: string) =>
        consulta.includes("display-mode: standalone")
          ? ({
              matches: true,
              media: consulta,
              addEventListener() {},
              removeEventListener() {},
              addListener() {},
              removeListener() {},
              onchange: null,
              dispatchEvent: () => false,
            } as MediaQueryList)
          : original(consulta);
    });
    await page.goto("/instalar");
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "O aplicativo já está instalado",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir o Hoje" }),
    ).toBeVisible();
  });

  test("a tela é pública: abre sem entrar", async ({ page }) => {
    await page.context().clearCookies();
    const r = await page.goto("/instalar");
    expect(r?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/instalar");
  });
});

test.describe("app instalável (P11 item 1)", () => {
  test("o Chrome não aponta nenhum impedimento de instalação (critério do Lighthouse)", async ({
    page,
    context,
  }, info) => {
    test.skip(
      info.project.name !== "computador",
      "o critério é o mesmo nos dois; uma vez basta",
    );
    await page.goto("/instalar");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    // o service worker se registra em produção e assume a página
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    const resposta = (await cdp.send(
      "Page.getInstallabilityErrors" as never,
    )) as {
      installabilityErrors: { errorId: string }[];
    };
    // O Playwright abre o navegador em contexto de navegação anônima, e o
    // Chrome sempre acrescenta "in-incognito" nele: não é defeito do app.
    const impedimentos = resposta.installabilityErrors
      .map((e) => e.errorId)
      .filter((id) => id !== "in-incognito");
    expect(impedimentos).toEqual([]);
  });

  test("o manifesto e o service worker abrem sem entrar e sem cache do worker", async ({
    request,
  }) => {
    const manifesto = await request.get("/manifest.webmanifest");
    expect(manifesto.status()).toBe(200);
    const json = await manifesto.json();
    expect(json.display).toBe("standalone");
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-store");
    expect(await sw.text()).toContain('addEventListener("push"');
  });
});

test.describe("armazenamento persistente e avisos (P11 itens 3 e 4)", () => {
  test("depois do login da enfermeira o app pede armazenamento persistente", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto("/hoje");
    await page.waitForFunction(
      () => localStorage.getItem("kz:armazenamento-persistente") !== null,
    );
    const situacao = await page.evaluate(() =>
      localStorage.getItem("kz:armazenamento-persistente"),
    );
    expect(["persistente", "temporario", "indisponivel"]).toContain(situacao);
  });

  test("o perfil mostra o cartão de avisos e o caminho para instalar", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto("/perfil");
    await expect(
      page.getByRole("heading", { name: "Avisos no aparelho" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver como instalar" }),
    ).toHaveAttribute("href", "/instalar");
    // com a chave VAPID configurada e permissão ainda não pedida, o botão de ligar aparece
    await expect(
      page.getByRole("button", { name: "Ligar os avisos" }),
    ).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("a inscrição de push só existe para quem entrou e é do próprio aparelho", async ({
    page,
    request,
  }) => {
    const inscricao = {
      endpoint: "https://push.exemplo.invalid/e2e",
      chaves: { p256dh: "publica", auth: "segredo" },
    };
    const semSessao = await request.post("/api/push/inscrever", {
      data: inscricao,
    });
    expect(semSessao.status()).toBe(401);

    await entrarComo(page, "Enfermeira");
    const ok = await page.request.post("/api/push/inscrever", {
      data: inscricao,
    });
    expect(ok.status()).toBe(200);
    expect(await ok.text()).not.toContain("push.exemplo");
    const invalida = await page.request.post("/api/push/inscrever", {
      data: { ...inscricao, endpoint: "http://push.exemplo.invalid/e2e" },
    });
    expect(invalida.status()).toBe(400);
    const remover = await page.request.delete("/api/push/inscrever", {
      data: { endpoint: inscricao.endpoint },
    });
    expect(remover.status()).toBe(200);
  });
});
