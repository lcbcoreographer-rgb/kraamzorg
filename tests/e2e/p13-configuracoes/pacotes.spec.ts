import { expect, test } from "@playwright/test";
import { entrarComo } from "../apoio/entrar";
import { porProjeto } from "./apoio";

/**
 * P13 item 2 (Pacotes e versões): preço novo sempre cria versão com
 * vigência, e a versão anterior continua a mesma (aceite do P13: "o
 * contrato antigo continua na versão anterior"). Como o módulo de contrato
 * (P31) ainda não existe, o teste confere que a versão antiga permanece
 * intacta e consultável, não que um contrato específico não mudou.
 * Cada teste usa um pacote por projeto (`porProjeto`), para não colidir
 * com a mesma escrita rodando em paralelo no outro projeto.
 */
function localizarCartao(page: import("@playwright/test").Page, nome: string) {
  // Nome exato ("Essencial" não pode casar com "Gemelar Essencial") e a
  // classe p-5 como palavra inteira (gap-5 também contém "p-5").
  return page
    .getByRole("heading", { name: nome, exact: true })
    .locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' p-5 ')][1]",
    );
}

test("a diretoria cria uma nova versão de preço e a anterior continua visível", async ({
  page,
}, info) => {
  const nome = porProjeto(info, "Essencial", "Continuado");
  const precoOriginal = porProjeto(info, "R$ 4.200", "R$ 8.100");
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes?aba=pacotes");

  const cartao = localizarCartao(page, nome);
  await expect(cartao.getByText(precoOriginal)).toBeVisible();

  await cartao.getByRole("button", { name: "Nova versão de preço" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Preço (R$)").fill("9999,00");
  await dialogo.getByRole("button", { name: "Criar versão" }).click();
  await expect(dialogo).toBeHidden();

  await expect(cartao.getByText("R$ 9.999")).toBeVisible();

  // A versão anterior não some: fica listada, com o preço de antes.
  await cartao.getByText(/versão\(ões\) anterior/).click();
  await expect(cartao.getByText(precoOriginal)).toBeVisible();
});

test("desativar um pacote muda o selo, sem apagar as versões", async ({
  page,
}, info) => {
  const nome = porProjeto(info, "Imersão", "Gemelar Essencial");
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes?aba=pacotes");

  const cartao = localizarCartao(page, nome);
  await expect(cartao.getByText("Ativo")).toBeVisible();
  await cartao.getByRole("button", { name: "Desativar" }).click();
  await expect(cartao.getByText("Desativado")).toBeVisible();

  // Reverte para não atrapalhar outra rodada do mesmo projeto.
  await cartao.getByRole("button", { name: "Reativar" }).click();
  await expect(cartao.getByText("Ativo")).toBeVisible();
});
