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
    "acesso_enfermeira_pos_encerramento_dias",
    "retencao_audio_dias",
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
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
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
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(dialogo.getByRole("alert")).toBeVisible();
  await expect(dialogo).toBeVisible();
});

test("a lista de parâmetros não traz nenhum do agente e diz com quem ficam os ajustes da Isadora", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes");

  await expect(
    page.getByText("Os ajustes da Isadora ficam com a equipe de implantação"),
  ).toBeVisible();
  // Parâmetros que o app também usa continuam na lista...
  await expect(
    page.getByRole("button", { name: "Editar freio_desfazer_segundos" }),
  ).toBeVisible();
  // ...e nenhum do agente aparece, nem dentro dos botões de editar.
  for (const chave of [
    "agente_modo",
    "agente_whitelist",
    "agente_followup_horas",
    "agente_pausa_humano_horas",
    "agenda_faixas",
    "validador_listas",
    "plantao_telefones",
  ]) {
    await expect(page.getByText(chave, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Editar ${chave}` }),
    ).toHaveCount(0);
  }
  await semViolacaoGrave(page);
});
