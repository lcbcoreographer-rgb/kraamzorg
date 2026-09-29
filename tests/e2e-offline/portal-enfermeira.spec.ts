import { expect, test, type Page } from "@playwright/test";
import { entrarComo } from "../e2e/apoio/entrar";

/**
 * Invariante 4 no portal da enfermeira (P38, aceite: "o dia funciona
 * offline; chegada e saída ficam registradas"). Roda no build de produção
 * (playwright.offline.config.ts), único em que o service worker do app
 * instalável se registra. Com a rede desligada:
 *
 * 1. o Hoje já aberto continua funcionando e a chegada é gravada no aparelho;
 * 2. abrir o portal de novo, sem rede, cai no casco de sem sinal
 *    (/portal-offline), que lê o dia guardado no IndexedDB e mostra a
 *    chegada salva;
 * 3. com a rede de volta, a fila sobe sozinha e a coordenação passa a ver a
 *    enfermeira em visita;
 * 4. a saída, feita depois, devolve a enfermeira ao estado de antes.
 */
test.use({ viewport: { width: 390, height: 844 } });

const ID_VISITA_MARE_D2 = "00000000-0000-4000-8033-000000000002";
const ID_PROFISSIONAL_SUL_2 = "00000000-0000-4000-8030-000000000002";

async function esperarCascoGuardado(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const nomes = await caches.keys();
          for (const nome of nomes) {
            const cache = await caches.open(nome);
            if (await cache.match("/portal-offline")) return true;
          }
          return false;
        }),
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
}

async function estadoDaSul2(page: Page): Promise<string> {
  await page.goto("/equipe");
  const cartao = page.locator(`[data-profissional="${ID_PROFISSIONAL_SUL_2}"]`);
  await expect(cartao).toBeVisible();
  return (
    (
      await cartao
        .getByText(
          /^(Em visita|Em atendimento|Reservada|Backup|Oferta pendente|Folga|Livre)$/,
        )
        .first()
        .textContent()
    )?.trim() ?? ""
  );
}

test("o dia funciona sem rede, a chegada sobe quando volta e a saída devolve o estado", async ({
  page,
  browser,
  baseURL,
}) => {
  await entrarComo(page, "Enfermeira");
  await page.goto("/hoje");
  const mare = page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`);
  await expect(mare).toBeVisible();
  await esperarCascoGuardado(page);

  const contextoCoordenacao = await browser.newContext({
    baseURL: baseURL ?? undefined,
  });
  const coordenacao = await contextoCoordenacao.newPage();
  await entrarComo(coordenacao, "Coordenação");
  const estadoAntes = await estadoDaSul2(coordenacao);
  expect(estadoAntes).not.toBe("Em visita");

  // 1. Sem rede: a chegada fica gravada no aparelho.
  await page.context().setOffline(true);
  await mare.getByRole("button", { name: "Cheguei" }).click();
  await expect(mare.getByRole("button", { name: "Saí da casa" })).toBeVisible();
  await expect(mare.locator('[data-marca="chegada"]')).toContainText(
    "Salvo no aparelho",
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Salvo no aparelho|registros? salvos?/ })
      .first(),
  ).toBeVisible();

  // 2. Reabrir o portal sem rede: o casco de sem sinal lê o dia do aparelho.
  await page.reload();
  await expect(page).toHaveURL(/\/portal-offline\?de=hoje/);
  const mareOffline = page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`);
  await expect(mareOffline).toBeVisible();
  await expect(mareOffline).toContainText("Família Teste Maré");
  await expect(mareOffline.locator('[data-marca="chegada"]')).toContainText(
    "Salvo no aparelho",
  );
  await expect(
    mareOffline.getByRole("button", { name: "Saí da casa" }),
  ).toBeVisible();
  await expect(
    page.getByText(/O registro está salvo no aparelho e sobe sozinho/).first(),
  ).toBeVisible();

  // As famílias guardadas também abrem sem rede.
  await page.getByRole("link", { name: "Famílias" }).click();
  await expect(
    page.getByRole("heading", { name: "Família Teste Maré" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Hoje" }).click();
  await expect(
    page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`),
  ).toBeVisible();

  // Nada subiu: a coordenação ainda não vê a enfermeira em visita.
  expect(await estadoDaSul2(coordenacao)).toBe(estadoAntes);

  // 3. A rede volta: a fila sobe sozinha.
  await page.context().setOffline(false);
  await expect
    .poll(() => estadoDaSul2(coordenacao), {
      timeout: 45_000,
      intervals: [1_000],
    })
    .toBe("Em visita");
  await expect(
    page.locator(`[data-visita="${ID_VISITA_MARE_D2}"] [data-marca="chegada"]`),
  ).toContainText("Sincronizado", { timeout: 20_000 });

  // 4. A saída, com sinal: a enfermeira volta ao estado de antes.
  await page.goto("/hoje");
  const mareOnline = page.locator(`[data-visita="${ID_VISITA_MARE_D2}"]`);
  await mareOnline.getByRole("button", { name: "Saí da casa" }).click();
  await expect(mareOnline.locator('[data-marca="saída"]')).not.toContainText(
    "ainda não",
  );
  await expect
    .poll(() => estadoDaSul2(coordenacao), {
      timeout: 45_000,
      intervals: [1_000],
    })
    .toBe(estadoAntes);

  await contextoCoordenacao.close();
});
