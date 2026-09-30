import { expect, test } from "@playwright/test";
import { entrarComo } from "../e2e/apoio/entrar";
import { idVisita } from "../e2e/p39-p40-checklist/apoio";

/**
 * Invariante 4 com o DOC 2 (P39 e P40): o checklist da visita funciona com
 * a rede desligada. A rede liga para carregar a página; depois cai. Sem
 * conexão, o valor digitado fica no aparelho e o alerta PU-01 (temperatura
 * de 38,2 °C) aparece na hora, com a conduta aprovada. A assinatura, o
 * hash e a sincronização do registro têm teste próprio no Vitest
 * (src/lib/checklist/sincronizacao.test.ts) e no pgTAP (023).
 */
test.describe("checklist sem conexão", () => {
  test("temperatura de 38,2 dispara PU-01 e o valor fica no aparelho", async ({
    page,
    context,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(`/visita/${idVisita(4)}`);
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await expect(page.getByText("Etapa 3 de 8")).toBeVisible();

    await context.setOffline(true);

    const temperatura = page.getByLabel(/^Temperatura/).first();
    await temperatura.fill("38,2");
    await temperatura.blur();

    const faixa = page.getByRole("alert").filter({ hasText: "PU-01" });
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText(
      "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.",
    );
    await expect(page.getByText("Salvo no aparelho").first()).toBeVisible();

    // A navegação entre as etapas segue funcionando sem rede.
    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await expect(page.getByText("Etapa 4 de 8")).toBeVisible();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByLabel(/^Temperatura/).first()).toHaveValue("38,2");
  });
});
