import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";
import { porProjeto } from "./apoio";

/**
 * P13 item 1 (Parâmetros): validação por tipo e histórico vindo do log.
 * Cada teste que escreve usa um parâmetro diferente por projeto
 * (`porProjeto`): celular e computador rodam contra o mesmo servidor de
 * demonstração, em paralelo.
 */
test("a diretoria edita um parâmetro inteiro e o histórico registra a troca", async ({
  page,
}, info) => {
  const chave = porProjeto(
    info,
    "agente_debounce_segundos",
    "agente_pausa_humano_horas",
  );
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes");

  await page.getByRole("button", { name: `Editar ${chave}` }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText(chave)).toBeVisible();
  await semViolacaoGrave(page);

  const anterior = await dialogo.getByLabel("Valor").inputValue();
  const novo = String(Number(anterior) + 1);
  await dialogo.getByLabel("Valor").fill(novo);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  // A tabela mostra o valor novo.
  await expect(
    page.locator("tr", { hasText: chave }).getByText(novo, { exact: true }),
  ).toBeVisible();

  // Reabrindo, o histórico mostra a troca.
  await page.getByRole("button", { name: `Editar ${chave}` }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(new RegExp(`de.*${anterior}.*para.*${novo}`)),
  ).toBeVisible();
});

test("recusa texto solto no lugar de um número, e nada é gravado", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes");

  await page
    .getByRole("button", { name: "Editar capacidade_alerta_pct" })
    .click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Valor").fill("muito");
  await dialogo.getByRole("button", { name: "Salvar" }).click();

  await expect(dialogo.getByRole("alert")).toBeVisible();
  await expect(dialogo).toBeVisible();
});
