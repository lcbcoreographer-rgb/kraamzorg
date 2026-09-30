import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { dubleTurnstile } from "../e2e/p29-p30-venda/apoio";

/**
 * P42, aceite na tela: a coordenação abre e conduz ocorrências; a pesquisa sai
 * por link único, a família responde sem login, e a nota baixa gera uma
 * ocorrência privada, sem nenhuma mensagem automática. Família em estado
 * sensível não recebe a pesquisa (coberto em
 * src/modules/operacao/ocorrencias/ocorrencias.test.ts).
 */

test.describe.configure({ mode: "serial" });

test.describe("ocorrências", () => {
  test("lista as abertas, com a privada marcada e o prazo em frase", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/ocorrencias");
    await expect(
      page.getByRole("heading", { level: 1, name: "Ocorrências" }),
    ).toBeVisible();
    await expect(page.getByText(/ocorrências abertas/).first()).toBeVisible();
    await expect(page.getByText("Privada").first()).toBeVisible();
    await expect(
      page.getByText("Pesquisa com nota baixa").first(),
    ).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("agrupa pela situação, com o prazo em frase e quem cuida", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/ocorrencias?situacao=todas");
    const vencidas = page.getByRole("region", { name: /Passaram do prazo/ });
    await expect(vencidas).toBeVisible();
    await expect(vencidas.getByText(/^Venceu há/).first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Dentro do prazo/ }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: /Fechadas/ })).toBeVisible();
    // A privada diz quem pode ver; quem cuida aparece em cada ocorrência.
    await expect(
      page.getByText("Privada, só coordenação e diretoria").first(),
    ).toBeVisible();
    await expect(page.getByText("Quem cuida").first()).toBeVisible();
    await semRolagemLateral(page);
  });

  test("a ocorrência privada diz que o contato é pessoal; resolver pede nota", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/ocorrencias");
    await page
      .getByRole("link", { name: "Pesquisa de satisfação com nota baixa" })
      .first()
      .click();
    await expect(
      page.getByText("Ocorrência privada da coordenação"),
    ).toBeVisible();
    await expect(
      page.getByText(/nenhuma\s+mensagem automática sai/),
    ).toBeVisible();

    await page.getByLabel("Quem cuida").selectOption({ index: 1 });
    await page.getByLabel("Próximo passo").selectOption("em_acompanhamento");
    await page.getByRole("button", { name: "Salvar no histórico" }).click();
    await expect(
      page.getByText("Salvo no histórico da ocorrência."),
    ).toBeVisible();

    await page.getByLabel("Próximo passo").selectOption("resolvida");
    await page.getByRole("button", { name: "Salvar no histórico" }).click();
    await expect(page.getByText(/nota de pelo menos 10 letras/)).toBeVisible();

    await page
      .getByLabel("Nota (obrigatória)")
      .fill("Liguei para a família e combinamos o retorno.");
    await page.getByRole("button", { name: "Salvar no histórico" }).click();
    await expect(
      page.getByText("Salvo no histórico da ocorrência."),
    ).toBeVisible();
    await expect(
      page.getByText("Liguei para a família e combinamos o retorno."),
    ).toBeVisible();
    await expect(page.getByText("Resolvida").first()).toBeVisible();
    await semRolagemLateral(page);
  });

  test("abre uma ocorrência nova e cai na página dela", async ({ page }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/ocorrencias/nova");
    await page.getByLabel("Tipo").selectOption("contato_perdido");
    await page.getByLabel("Título").fill("Sem retorno depois do D3");
    await page
      .getByLabel("O que aconteceu")
      .fill("Duas ligações sem resposta na semana.");
    await page.getByLabel("Prioridade").selectOption("alta");
    await page.getByRole("button", { name: "Abrir a ocorrência" }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sem retorno depois do D3" }),
    ).toBeVisible();
    await expect(page.getByText("Prioridade alta").first()).toBeVisible();
    await expect(page.getByText(/Responder até/)).toBeVisible();
  });

  test("campos faltando voltam marcados", async ({ page }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/ocorrencias/nova");
    await page.getByRole("button", { name: "Abrir a ocorrência" }).click();
    await expect(
      page.getByText("Falta alguma coisa para abrir a ocorrência."),
    ).toBeVisible();
    await expect(page.getByText("Escolha o tipo da ocorrência.")).toBeVisible();
    await expect(
      page.getByText("Escreva um título com 3 a 160 caracteres."),
    ).toBeVisible();
  });
});

test.describe("pesquisa e pós-venda", () => {
  test("gera o link, a família responde sem login e a nota baixa vira ocorrência privada", async ({
    browser,
    page,
  }, info) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/pos-venda");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pós-venda" }),
    ).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);

    const aurora = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Aurora" }),
      })
      .first();
    await aurora
      .getByRole("button", { name: "Gerar o link da pesquisa" })
      .click();
    const texto = aurora.getByLabel("Texto para a família");
    await expect(texto).toBeVisible();
    const conteudo = await texto.inputValue();
    const endereco = /https?:\/\/[^\s]+\/pesquisa\/[A-Za-z0-9_-]+/.exec(
      conteudo,
    )?.[0];
    expect(endereco, conteudo).toBeTruthy();
    const caminho = new URL(endereco!).pathname;
    await aurora.getByRole("button", { name: "Marcar como enviada" }).click();
    await expect(aurora.getByText("Aguardando resposta")).toBeVisible();

    // a família abre o link sem sessão
    const contexto = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: info.project.use.viewport ?? undefined,
    });
    const familia = await contexto.newPage();
    await dubleTurnstile(familia);
    await familia.goto(caminho);
    await expect(
      familia.getByRole("heading", { level: 1, name: "Como foi para vocês?" }),
    ).toBeVisible();
    await expect(familia.getByText(/Oi, Marina\./)).toBeVisible();
    // nada da família na página além do primeiro nome
    await expect(familia.locator("body")).not.toContainText(/Aurora|@|\+55/);
    await semRolagemLateral(familia);
    await semViolacaoGrave(familia);

    // resposta incompleta volta com as perguntas marcadas
    await familia
      .getByRole("button", { name: "Enviar as minhas respostas" })
      .click();
    await expect(
      familia.getByText(/Falta responder alguma pergunta/),
    ).toBeVisible();

    await familia
      .getByRole("radiogroup", { name: /De 0 a 10/ })
      .getByText("4", { exact: true })
      .click();
    await familia
      .getByRole("radiogroup", { name: /Podemos usar o seu depoimento/ })
      .getByText("Não", { exact: true })
      .click();
    await familia
      .getByRole("radiogroup", { name: /Podemos usar imagens/ })
      .getByText("Não", { exact: true })
      .click();
    await familia
      .getByLabel("Tem algo que a gente poderia fazer melhor?")
      .fill("Mais aviso sobre o horário.");
    await familia
      .getByRole("button", { name: "Enviar as minhas respostas" })
      .click();
    await expect(familia.getByRole("heading", { level: 1 })).toContainText(
      "Obrigada por contar como foi, Marina.",
    );

    // o mesmo link não vale duas vezes
    await familia.goto(caminho);
    await expect(
      familia.getByText(/Este link não está mais disponível/),
    ).toBeVisible();
    await contexto.close();

    // a coordenação vê o resultado e a ocorrência privada, sem palavra de venda
    await page.goto("/pos-venda");
    const depois = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Aurora" }),
      })
      .first();
    await expect(depois.getByText(/Nota 4 de 10/)).toBeVisible();
    await expect(
      depois.getByText(/ocorrência privada da coordenação/),
    ).toBeVisible();
    await page.goto("/ocorrencias");
    await expect(
      page
        .getByRole("link", { name: "Pesquisa de satisfação com nota baixa" })
        .first(),
    ).toBeVisible();
    await expect(page.getByText("Privada").first()).toBeVisible();

    // e a enfermeira não vê a ocorrência privada nem o pós-venda
    const enf = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: info.project.use.viewport ?? undefined,
    });
    const paginaEnf = await enf.newPage();
    await entrarComo(paginaEnf, "Enfermeira");
    await paginaEnf.goto("/pos-venda");
    await expect(paginaEnf).not.toHaveURL(/\/pos-venda/);
    await enf.close();
  });

  test("família em estado sensível: o botão de gerar o link não aparece e o cartão explica", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/pos-venda");
    const bruma = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: "Família Teste Bruma" }),
      })
      .first();
    await expect(
      bruma.getByText("A pesquisa desta família fica parada"),
    ).toBeVisible();
    await expect(bruma.getByRole("button", { name: /Gerar/ })).toHaveCount(0);
  });

  test("o link inventado mostra o aviso de link indisponível, sem dado de ninguém", async ({
    browser,
  }, info) => {
    const contexto = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: info.project.use.viewport ?? undefined,
    });
    const familia = await contexto.newPage();
    await familia.goto("/pesquisa/token-que-nao-existe-em-lugar-nenhum-123");
    await expect(
      familia.getByText(/Este link não está mais disponível/),
    ).toBeVisible();
    await expect(familia.getByRole("button", { name: /Enviar/ })).toHaveCount(
      0,
    );
    await contexto.close();
  });
});
