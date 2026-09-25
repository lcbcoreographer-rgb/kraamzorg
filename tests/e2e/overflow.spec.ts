import { expect, test } from "@playwright/test";

/**
 * P10 (auditoria), item 1: o `whitespace-nowrap` do IndicadorSincronizacao
 * fazia a página inteira rolar de lado no celular. Este teste confere que
 * `scrollWidth` nunca passa de `clientWidth` na `/design-system` (onde os
 * quatro estados do indicador, incluindo o de erro com "Tentar agora",
 * aparecem lado a lado) em 360 e 390 px, as duas larguras da auditoria.
 */
test.describe("sem rolagem horizontal", () => {
  for (const largura of [360, 390]) {
    test(`/design-system não rola de lado em ${largura}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/design-system");
      await page.waitForLoadState("networkidle");

      const larguras = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(larguras.scrollWidth).toBeLessThanOrEqual(larguras.clientWidth);
    });
  }
});
