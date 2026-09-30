import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";

/**
 * Camada de acolhimento (docs/design/DESIGN.md, seção 11; voz.md), modo
 * demonstração. Só lê a loja em memória: nenhum teste aqui muda estado,
 * então celular e computador rodam os mesmos passos sem disputar linha.
 *
 * A Família Teste Bruma do seed está em bloqueio total depois de um relato
 * de perda (transferência "Perda gestacional" para a coordenação clínica).
 */

test("conversa de uma família em luto: Isadora desligada, sem triagem, sem prazo e sem vermelho (DESIGN.md 11.8)", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/conversas");
  await page.getByRole("link", { name: "Abrir com cuidado" }).first().click();
  await page.waitForURL(/\/conversas\/[0-9a-f-]+$/);

  const conteudo = page.locator("#conteudo");
  await expect(
    conteudo.getByText("A Isadora está desligada para esta família"),
  ).toBeVisible();
  await expect(
    conteudo.getByText("A Isadora está conduzindo esta conversa"),
  ).toHaveCount(0);
  await expect(
    conteudo.getByRole("button", { name: /não lead|outro assunto/i }),
  ).toHaveCount(0);
  await expect(
    conteudo.getByRole("button", { name: "Pausar a Isadora" }),
  ).toHaveCount(0);
  await expect(conteudo.getByText(/venceu há|vira fato/)).toHaveCount(0);
  await expect(conteudo.getByText("sem registro").first()).toBeVisible();
  await expect(conteudo.getByText(/recebida às/).first()).toBeVisible();
  // Nada em `alerta` na tela de uma família em luto.
  await expect(conteudo.locator(".text-alerta, .bg-alerta-lavado")).toHaveCount(
    0,
  );

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("fila: a perda mostra a hora do relato, em ameixa, e o destino em frase", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/transferencias");

  const perda = page
    .getByRole("heading", { level: 3, name: "Perda gestacional" })
    .locator("xpath=ancestor::*[contains(@class,'rounded-3')][1]");
  await expect(perda.getByText(/recebida às/)).toBeVisible();
  await expect(perda.getByText(/venceu há|vence em/)).toHaveCount(0);
  await expect(perda.locator(".text-alerta, .bg-alerta-lavado")).toHaveCount(0);
  await expect(
    perda.getByText(/Família Teste Bruma, com a coordenação clínica/),
  ).toBeVisible();
});

test("Início abre pelo dia, com a frase de estado em vez da palavra da aba (DESIGN.md 11.4)", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/inicio");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^(Domingo|Segunda|Terça|Quarta|Quinta|Sexta|Sábado), \d{2}\/\d{2}$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/transferências?.*(vencem? hoje|atrasadas?|nenhuma tarefa)/),
  ).toBeVisible();
  await expect(page).toHaveTitle(/^Início/);
  await semRolagemLateral(page);
});

test("pipeline no celular: página sem rolagem lateral, busca à vista e filtros recolhidos (DESIGN.md 11.5)", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "celular", "só a largura de 390 px");
  await entrarComo(page, "Comercial");
  await page.goto("/pipeline");

  await semRolagemLateral(page);
  await expect(page.getByRole("searchbox", { name: "Buscar" })).toBeVisible();
  await expect(page.getByLabel("Região")).toBeHidden();
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const folha = page.getByRole("dialog", { name: "Filtrar o pipeline" });
  await expect(folha.getByLabel("Região")).toBeVisible();
  await expect(
    folha.getByRole("button", { name: "Mostrar famílias" }),
  ).toBeVisible();
});

test("tela sem módulo diz o que a pessoa vai ter, sem ler a especificação (DESIGN.md 11.7)", async ({
  page,
}) => {
  // /hoje virou tela de verdade no P38, /notas no P43 e /financeiro no P46; o início da
  // diretoria segue sem módulo até o painel receber o resumo do dia.
  await entrarComo(page, "Diretoria");
  await page.goto("/inicio");

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Esta parte ainda está em construção.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/aparecer aqui|régua de dias/)).toHaveCount(0);
  await expect(
    page.getByText(/Aqui você vai ver, uma linha para cada/),
  ).toBeVisible();
});

test("números do mês em frase, uma linha por métrica, com a meta ao lado (DESIGN.md 11.10)", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/agente");

  const lista = page.getByRole("list", { name: "Números do mês da Isadora" });
  await expect(lista).toBeVisible();
  await expect(lista.getByRole("listitem")).toHaveCount(7);
  await expect(
    lista.getByText(/leads do período fecharam contrato/),
  ).toBeVisible();
  await expect(lista.getByText("Meta: 7% ou mais")).toBeVisible();
  await semRolagemLateral(page);
});
