import { expect, test, type Page } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P43, aceite na tela: a nota que voltou com erro mostra o motivo e permite
 * reenviar; a emissão manual assistida mostra os dados e registra o número e
 * os arquivos. O provedor é de mentira (demonstração).
 */

const nota = (n: number) =>
  `00000000-0000-4000-8b00-${n.toString().padStart(12, "0")}`;
const PENDENTE = nota(1);
const COM_ERRO = nota(2);
const PROCESSANDO = nota(3);

/** "aaaa-mm-dd" de ontem em Brasília, como o servidor calcula. */
function ontem(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.now() - 86_400_000));
}

async function ajustar(page: Page, botao: string) {
  await page.getByRole("button", { name: botao }).click();
}

test.describe.configure({ mode: "serial" });

test.describe("notas fiscais", () => {
  test("a lista mostra cada estado em frase, com o erro primeiro, sem rolagem lateral", async ({
    page,
  }) => {
    await entrarComo(page, "Financeiro");
    await page.goto("/notas");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notas" }),
    ).toBeVisible();
    await expect(
      page.getByText(/esperam emissão|espera emissão/).first(),
    ).toBeVisible();
    await expect(page.getByText(/A emissão é manual/)).toBeVisible();
    await expect(page.getByText("Com erro").first()).toBeVisible();
    await expect(page.getByText("A emitir").first()).toBeVisible();
    await expect(page.getByText("Em processamento").first()).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);

    await page.getByRole("link", { name: "Com erro" }).click();
    await expect(page).toHaveURL(/situacao=erro/);
    await expect(page.getByText("Família Teste Jade")).toBeVisible();
    await expect(page.getByText("Família Teste Íris")).toHaveCount(0);
  });

  test("nota com erro: o motivo aparece e o reenvio funciona depois de uma nova falha combinada", async ({
    page,
  }) => {
    await entrarComo(page, "Financeiro");
    await page.goto(`/notas/${COM_ERRO}`);
    await expect(
      page.getByText("O provedor não emitiu esta nota"),
    ).toBeVisible();
    await expect(
      page.getByText(/o CPF do tomador não confere com o nome/),
    ).toBeVisible();
    // quem paga é o tomador
    await expect(
      page.getByText(/tomador da nota: Paulo Teste Pagador/),
    ).toBeVisible();
    // emissão manual: sem reenvio pelo provedor enquanto a automática está desligada
    await expect(
      page.getByRole("button", { name: "Reenviar a nota" }),
    ).toHaveCount(0);

    await ajustar(page, "Ligar a emissão automática");
    await expect(
      page.getByText("Emissão automática ligada na demonstração."),
    ).toBeVisible();
    await ajustar(page, "Simular falha na próxima emissão");
    await expect(page.getByText(/vai voltar com erro/)).toBeVisible();

    await page.getByRole("button", { name: "Reenviar a nota" }).click();
    await expect(
      page
        .getByText(
          /O provedor recusou a nota: o endereço de quem paga está incompleto/,
        )
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/toque em Reenviar/)).toBeVisible();
    await expect(page.getByText("2 tentativas no provedor")).toBeVisible();
    await semRolagemLateral(page);

    await page.getByRole("button", { name: "Reenviar a nota" }).click();
    await expect(page.getByText(/Nota emitida, número D/)).toBeVisible();
    await expect(page.getByText("Emitida").first()).toBeVisible();
    await expect(page.getByText("O provedor não emitiu esta nota")).toHaveCount(
      0,
    );
  });

  test("nota em processamento: a consulta ao provedor traz a nota emitida", async ({
    page,
  }) => {
    await entrarComo(page, "Financeiro");
    await page.goto(`/notas/${PROCESSANDO}`);
    await expect(page.getByText(/O pedido está no provedor/)).toBeVisible();
    await page.getByRole("button", { name: "Consultar no provedor" }).click();
    await expect(page.getByText(/Nota emitida, número D/)).toBeVisible();
  });

  test("emissão manual assistida: mostra os dados, registra número, data, PDF e XML", async ({
    page,
  }) => {
    await entrarComo(page, "Financeiro");
    await page.goto(`/notas/${PENDENTE}`);
    await expect(page.getByText("Emitir à mão, com a contadora")).toBeVisible();

    // o CPF só aparece sob pedido
    await expect(page.locator("body")).not.toContainText("529.982.247-25");
    await page
      .getByRole("button", { name: "Ver os dados para emitir" })
      .click();
    const dados = page.locator("dl[aria-label='Dados para emitir a nota']");
    await expect(dados).toContainText("Carla Teste Pagadora");
    await expect(dados).toContainText("529.982.247-25");
    await expect(dados).toContainText("05266");
    await expect(dados).toContainText("Cuidado domiciliar pós-parto");
    await expect(dados).toContainText("R$ 4.200");

    // dados que faltam voltam marcados
    await page
      .getByRole("button", { name: "Registrar a nota emitida" })
      .click();
    await expect(
      page.getByText("Falta alguma coisa para registrar a nota."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Escreva o número da nota, como aparece no portal do provedor.",
      ),
    ).toBeVisible();

    await page.getByLabel("Número da nota").fill("2026/154");
    await page.getByLabel("Data de emissão").fill(ontem());
    await page.getByLabel("Provedor").fill("Portal da contadora");
    await page.getByLabel(/^PDF da nota/).setInputFiles({
      name: "da-contadora.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 nota de teste"),
    });
    await page.getByLabel(/^XML da nota/).setInputFiles({
      name: "da-contadora.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(
        '<?xml version="1.0"?><NFSe><numero>154</numero></NFSe>',
      ),
    });
    await page
      .getByRole("button", { name: "Registrar a nota emitida" })
      .click();
    await expect(page.getByText(/Nota registrada/)).toBeVisible();
    await expect(page.getByText("Emitida à mão")).toBeVisible();
    await expect(page.getByText(/Nota número 2026\/154/)).toBeVisible();

    const pdf = page.getByRole("link", { name: "Abrir o PDF" });
    await expect(pdf).toBeVisible();
    const resposta = await page.request.get((await pdf.getAttribute("href"))!);
    expect(resposta.status()).toBe(200);
    expect((await resposta.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(resposta.headers()["content-disposition"]).toBe(
      `inline; filename="nota-${PENDENTE}.pdf"`,
    );
    const xml = await page.request.get(
      (await page
        .getByRole("link", { name: "Abrir o XML" })
        .getAttribute("href"))!,
    );
    expect(xml.headers()["content-type"]).toBe("application/xml");
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o comercial não abre as notas", async ({ page }) => {
    await entrarComo(page, "Comercial");
    await page.goto("/notas");
    await expect(page).not.toHaveURL(/\/notas/);
  });
});
