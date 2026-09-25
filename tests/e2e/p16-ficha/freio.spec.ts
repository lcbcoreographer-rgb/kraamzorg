import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";
import { porProjeto } from "./apoio";

/**
 * P16 item 2 e PRD 8.3: freio em um toque, sem pergunta antes, direto para
 * bloqueio total; aviso efêmero com "Desfazer"; reversão só com coordenação
 * ou diretoria, com justificativa. Uma família normal por projeto
 * (`porProjeto`), porque o freio muda estado.
 */
test("comercial aciona o freio em um toque no celular e no computador, e o cabeçalho vira ameixa", async ({
  page,
}, info) => {
  const familia = porProjeto(info, "Flor", "Gruta");
  await entrarComo(page, "Comercial");
  await page.goto(`/familias?busca=${encodeURIComponent(familia)}`);
  await page
    .getByRole("link", { name: new RegExp(`Família Teste ${familia}`) })
    .click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: /^Freio: pausa na hora/ }).click();

  // Confirmação imediata, sem pergunta nenhuma antes.
  await expect(page.getByText(/Nenhuma mensagem automática sai/)).toBeVisible();
  await expect(page.getByText("Freio ativo")).toBeVisible();
  await expect(page.getByText(/Freio em bloqueio total/)).toBeVisible();

  // Tarefa de justificativa embutida na própria ficha, e continua lá depois
  // de recarregar (vem da tarefa aberta, não só do estado da tela).
  await expect(page.getByText("Justificar o freio")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Justificar o freio")).toBeVisible();

  // O evento do freio é restrito: o comercial não o vê na linha do tempo.
  await expect(page.getByText(/Evento restrito/)).toHaveCount(0);

  await semViolacaoGrave(page);
});

test("quem acionou pode desfazer dentro do prazo, e o estado volta ao normal", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=Jade");
  await page.getByRole("link", { name: /Família Teste Jade/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: /^Freio: pausa na hora/ }).click();
  await expect(page.getByText("Freio ativo")).toBeVisible();

  await page.getByRole("button", { name: /^Desfazer \d+ s$/ }).click();
  await expect(page.getByText("Freio ativo")).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Freio: pausa na hora/ }),
  ).toBeVisible();
});

test("comercial não vê a ação de reverter; coordenação reverte com justificativa", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=Lua");
  await page.getByRole("link", { name: /Família Teste Lua/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: /^Freio: pausa na hora/ }).click();

  // O selo "Freio ativo" do comercial é só informativo, sem clique.
  const seloComercial = page.getByText("Freio ativo");
  await expect(seloComercial).toBeVisible();
  await expect(page.getByRole("button", { name: "Freio ativo" })).toHaveCount(
    0,
  );

  // Trocar de pessoa na mesma página: sem limpar a sessão, /entrar manda
  // quem já entrou direto para o início. O botão do seletor de
  // demonstração diz "Coordenação", com cedilha e til.
  await page.context().clearCookies();
  await entrarComo(page, /^Coordenação Perfil Teste/);
  await page.goto("/familias?busca=Lua");
  await page.getByRole("link", { name: /Família Teste Lua/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  // A coordenação vê o evento restrito do freio na linha do tempo, com o
  // título em frase (nunca o código gravado pelo banco).
  await expect(page.getByText(/Freio acionado/).first()).toBeVisible();
  await expect(page.getByText(/Evento restrito/).first()).toBeVisible();
  // A tarefa de justificativa é de quem acionou, não da coordenação.
  await expect(page.getByText("Justificar o freio")).toHaveCount(0);

  await page.getByRole("button", { name: "Freio ativo" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText("Reverter ou ajustar o freio")).toBeVisible();

  // O estado atual não aparece como opção: não seria uma mudança.
  await expect(dialogo.getByLabel("Bloqueio total")).toHaveCount(0);
  await dialogo.getByLabel("Normal").click();
  await dialogo
    .getByLabel("Justificativa")
    .fill("Confirmado com a família: susto sem gravidade.");
  await dialogo.getByRole("button", { name: "Salvar decisão" }).click();
  await expect(dialogo).toBeHidden();

  await expect(
    page.getByRole("button", { name: /^Freio: pausa na hora/ }),
  ).toBeVisible();
});
