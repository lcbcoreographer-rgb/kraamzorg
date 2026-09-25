import { expect, test } from "@playwright/test";

/**
 * P10 (auditoria), item 8: a régua de dias usa uma grade explícita
 * (`repeat(dias.length, ...)`), não `auto-fit`, para não quebrar de jeito
 * diferente conforme a largura exata do aparelho. Este teste confere, na
 * régua de 12 dias da /design-system, que a primeira linha sempre tem 6
 * colunas abaixo de 600 px e 12 colunas a partir de 600 px.
 */
test.describe("ReguaDias, número de colunas por largura", () => {
  const larguras = [
    { largura: 390, colunasEsperadas: 6 },
    { largura: 430, colunasEsperadas: 6 },
    { largura: 600, colunasEsperadas: 12 },
  ];

  for (const { largura, colunasEsperadas } of larguras) {
    test(`em ${largura}px, a régua de 12 dias mostra ${colunasEsperadas} colunas por linha`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/design-system");
      await page.waitForLoadState("networkidle");

      const regua = page.getByRole("list", {
        name: "Acompanhamento, D1 a D12",
      });
      await regua.scrollIntoViewIfNeeded();

      const colunas = await regua.evaluate((el) => {
        const estilo = window.getComputedStyle(el);
        return estilo.gridTemplateColumns.split(" ").length;
      });

      expect(colunas).toBe(colunasEsperadas);
    });
  }
});
