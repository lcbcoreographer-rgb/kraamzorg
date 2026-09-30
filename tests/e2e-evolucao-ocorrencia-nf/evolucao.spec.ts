import { expect, test, type Page } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P41, aceite na tela: a enfermeira monta o rascunho do checklist, completa o
 * que falta, uma conclusão incoerente bloqueia a revisão, a coordenação aprova
 * e o e-mail sai com o PDF em anexo. O e-mail cai na caixa de saída local da
 * demonstração; o conteúdo do PDF e do assunto é conferido nos testes do
 * módulo (src/modules/assistencial/evolucao/evolucao.test.ts).
 */

const AURORA = "00000000-0000-4000-8610-000000000001";
const PUERPERAL_ENFERMEIRA = `/minhas-evolucoes/${AURORA}/puerperal`;
const PUERPERAL_COORDENACAO = `/evolucoes/${AURORA}/puerperal`;

function grupo(page: Page, nome: string | RegExp) {
  return page.getByRole("radiogroup", { name: nome });
}

async function escolher(
  page: Page,
  nomeDoGrupo: string | RegExp,
  opcao: string,
) {
  await grupo(page, nomeDoGrupo).getByText(opcao, { exact: true }).click();
}

test.describe.configure({ mode: "serial" });

test.describe("evolução aos médicos", () => {
  test("a coordenação vê os acompanhamentos com o prazo em frase, sem rolagem lateral", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/evolucoes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Evoluções" }),
    ).toBeVisible();
    const aurora = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Aurora" }),
      })
      .first();
    await expect(aurora).toContainText("No prazo");
    await expect(aurora).toContainText("Evolução puerperal");
    await expect(aurora).toContainText("Evolução neonatal");
    const estrela = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Estrela" }),
      })
      .first();
    await expect(estrela).toContainText("Prazo vencido");
    await expect(estrela).toContainText("A coordenação assume");
    const cedro = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Cedro" }),
      })
      .first();
    await expect(cedro).toContainText("Falta o contato do médico");
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("a enfermeira monta o rascunho e vê o que só ela pode dizer", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto("/minhas-evolucoes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Evoluções" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Família Teste Aurora" }),
    ).toBeVisible();
    await page.goto(PUERPERAL_ENFERMEIRA);
    await expect(
      page.getByRole("heading", { level: 1, name: "Evolução puerperal" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Montar o rascunho com o checklist" })
      .click();
    await expect(
      page.getByText("Falta corrigir antes de seguir"),
    ).toBeVisible();
    await expect(
      page.getByText("Falta preencher: grau da lesão mamilar."),
    ).toBeVisible();
    // o botão de revisão fica travado enquanto houver ponto a corrigir
    await expect(
      page.getByRole("button", {
        name: "Enviar para a revisão da coordenação",
      }),
    ).toBeDisabled();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("conclusão incoerente com o que foi observado bloqueia a revisão", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(PUERPERAL_ENFERMEIRA);
    await page.getByLabel("Grau da lesão mamilar", { exact: true }).fill("II");
    await page.getByLabel("Grau da lesão no último dia").fill("I");
    await escolher(page, "Aleitamento observado no período", "Misto");
    await escolher(
      page,
      "Todos os sinais vitais ficaram na referência o período inteiro?",
      "Sim",
    );
    await escolher(page, "Conclusão sobre a amamentação", "Exclusivo");
    await page
      .getByLabel("Autonomia e segurança da família")
      .fill(
        "A família demonstra autonomia e segurança nos cuidados do dia a dia.",
      );
    await page.getByRole("button", { name: "Salvar o documento" }).click();

    await expect(page.getByText(/Ainda há pontos a corrigir/)).toBeVisible();
    await expect(
      page.getByText(/A conclusão descreve aleitamento/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Enviar para a revisão da coordenação",
      }),
    ).toBeDisabled();
    // sem conteúdo montado não há prévia em PDF
    await expect(page.getByRole("link", { name: "Ver como PDF" })).toHaveCount(
      0,
    );
  });

  test("corrigida a conclusão, a enfermeira envia para a revisão e para de editar", async ({
    page,
  }) => {
    await entrarComo(page, "Enfermeira");
    await page.goto(PUERPERAL_ENFERMEIRA);
    await escolher(page, "Conclusão sobre a amamentação", "Misto");
    await page.getByRole("button", { name: "Salvar o documento" }).click();
    await expect(
      page.getByText("Salvo. Nenhum ponto a corrigir neste documento."),
    ).toBeVisible();
    await expect(page.getByText("Como o médico vai ler")).toBeVisible();
    const prévia = page.getByRole("link", { name: "Ver como PDF" });
    await expect(prévia).toBeVisible();
    const pdf = await page.request.get((await prévia.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page
      .getByRole("button", { name: "Enviar para a revisão da coordenação" })
      .click();
    await expect(
      page.getByText(/Enviado para a revisão da coordenação/),
    ).toBeVisible();
    await expect(page.getByText("Aguardando revisão").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salvar o documento" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Este documento não pode ser editado agora"),
    ).toBeVisible();
    // a enfermeira não aprova
    await expect(
      page.getByRole("button", { name: /Aprovar e enviar/ }),
    ).toHaveCount(0);
  });

  test("a coordenação devolve com recado, a enfermeira ajusta, e a coordenação aprova e envia", async ({
    browser,
    page,
  }, info) => {
    await entrarComo(page, "Coordenação");
    await page.goto(PUERPERAL_COORDENACAO);
    await page.getByRole("button", { name: "Devolver com recado" }).click();
    await page
      .getByLabel("Recado para a enfermeira")
      .fill("Confira o grau final da lesão.");
    await page
      .getByRole("button", { name: "Devolver para a enfermeira" })
      .click();
    await expect(page.getByText(/Devolvido para a enfermeira/)).toBeVisible();

    const enf = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: info.project.use.viewport ?? undefined,
    });
    const paginaEnf = await enf.newPage();
    await entrarComo(paginaEnf, "Enfermeira");
    await paginaEnf.goto(PUERPERAL_ENFERMEIRA);
    await expect(
      paginaEnf.getByText("A coordenação devolveu com um recado"),
    ).toBeVisible();
    await expect(
      paginaEnf.getByText("Confira o grau final da lesão."),
    ).toBeVisible();
    await paginaEnf.getByLabel("Grau da lesão no último dia").fill("I");
    await paginaEnf.getByRole("button", { name: "Salvar o documento" }).click();
    await expect(paginaEnf.getByText(/Nenhum ponto a corrigir/)).toBeVisible();
    await paginaEnf
      .getByRole("button", { name: "Enviar para a revisão da coordenação" })
      .click();
    await expect(paginaEnf.getByText(/Enviado para a revisão/)).toBeVisible();
    await enf.close();

    await page.goto(PUERPERAL_COORDENACAO);
    await expect(page.getByText("Aguardando revisão").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Aprovar e enviar ao médico" })
      .click();
    await expect(page.getByText(/Aprovado e enviado a 1 médico/)).toBeVisible();
    await expect(page.getByText("Enviada ao médico").first()).toBeVisible();
    await expect(
      page.getByText("Na demonstração o e-mail não sai"),
    ).toBeVisible();

    // o PDF enviado abre pela rota autenticada, com o nome do documento (o id), não o da paciente
    const enviado = page.getByRole("link", { name: "Abrir o PDF enviado" });
    await expect(enviado).toBeVisible();
    const resposta = await page.request.get(
      (await enviado.getAttribute("href"))!,
    );
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toBe("application/pdf");
    expect(resposta.headers()["content-disposition"]).toMatch(
      /filename="[0-9a-f-]{36}\.pdf"/,
    );
    await semRolagemLateral(page);
  });

  test("a família sem médico com contato fica travada com o aviso e o caminho", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/evolucoes");
    const cedro = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Cedro" }),
      })
      .first();
    await expect(
      cedro.getByRole("link", { name: "Abrir a ficha da família" }),
    ).toBeVisible();
    await page.goto(
      `/evolucoes/00000000-0000-4000-8610-000000000003/puerperal`,
    );
    await page
      .getByRole("button", { name: "Montar o rascunho com o checklist" })
      .click();
    await expect(page.getByText(/médico com e-mail ou telefone/)).toBeVisible();
  });

  test("o comercial não abre as evoluções", async ({ page }) => {
    await entrarComo(page, "Comercial");
    await page.goto("/evolucoes");
    await expect(page).not.toHaveURL(/\/evolucoes/);
  });
});
