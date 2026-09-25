import { expect, test } from "@playwright/test";

/**
 * Invariante 4 (PRD 16.1, "Fila de sincronização"; CLAUDE.md item 22):
 * registro criado offline chega íntegro e na ordem. Usa `/dev/sync` (P12
 * item 5, fora de produção) como formulário de demonstração. A rede liga
 * para o primeiro carregamento (que precisa buscar o HTML/JS da página) e
 * desliga só depois, com `context.setOffline(true)`; ver o comentário em
 * playwright.offline.config.ts.
 *
 * Os dois campos deste teste deixam "Id da entidade" em branco: cada salvar
 * cria um registro novo (sem precisar de um id de servidor conhecido de
 * antemão nem de `versaoBase`, que só existe ao editar um registro já
 * existente).
 */
test.describe("motor offline (rede desligada)", () => {
  test("preenche offline, religa e sincroniza, na ordem em que foi salvo", async ({
    page,
    context,
  }) => {
    await page.goto("/dev/sync");

    await context.setOffline(true);

    // Primeiro campo, salvo sem rede.
    await page.selectOption("#campo-entidade", "visita");
    await page.fill("#campo-nome-campo", "observacoes");
    await page.fill("#campo-valor", "Sem febre, mamada tranquila");
    await page.getByTestId("botao-salvar-campo").click();

    // Segundo campo, salvo logo em seguida (ainda offline).
    await page.fill("#campo-nome-campo", "pressao");
    await page.fill("#campo-valor", "110x70");
    await page.getByTestId("botao-salvar-campo").click();

    const itens = page.getByTestId(/^item-fila-/);
    await expect(itens).toHaveCount(2);

    // Nenhum item chega a "sincronizado" sem rede: fica salvo no aparelho
    // (PRD 15: "rascunho local, enviando, sincronizado").
    for (const item of await itens.all()) {
      await expect(item).toHaveAttribute("data-estado", "rascunho_local");
      await expect(item).toContainText("Salvo no aparelho");
    }

    // A rede volta; sincronizamos pelo botão, para não depender do tempo
    // que o gatilho automático de "online" leva para disparar.
    await context.setOffline(false);
    await page.getByTestId("botao-sincronizar-agora").click();

    await expect(async () => {
      for (const item of await itens.all()) {
        await expect(item).toHaveAttribute("data-estado", "sincronizado");
      }
    }).toPass({ timeout: 15_000 });

    // A ordem na tela é a ordem de criação (o componente ordena por
    // criadoNoClienteEm): o primeiro campo salvo continua em primeiro.
    const textos = await itens.allTextContents();
    expect(textos[0]).toContain("observacoes");
    expect(textos[1]).toContain("pressao");
  });

  test("o que foi salvo offline persiste no IndexedDB do aparelho, sem rede", async ({
    page,
    context,
  }) => {
    await page.goto("/dev/sync");
    await context.setOffline(true);

    await page.selectOption("#campo-entidade", "anexo_audio");
    await page.fill("#campo-nome-campo", "duracaoSeg");
    await page.fill("#campo-valor", "42");
    await page.getByTestId("botao-salvar-campo").click();

    await expect(page.getByTestId(/^item-fila-/)).toHaveCount(1);
    await expect(page.getByTestId(/^item-fila-/)).toHaveAttribute(
      "data-estado",
      "rascunho_local",
    );

    // Prova que o item está mesmo no IndexedDB (não só no estado do React):
    // abre o banco direto, sem passar pela tela, com a rede ainda desligada.
    // (`page.reload()` não serve aqui: sem service worker cacheando o
    // aplicativo, tarefa do P11, recarregar sem rede falha na própria
    // navegação, o que testaria o P11, não o motor offline do P12.)
    const contagemNoIndexedDb = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const abrir = indexedDB.open("kraamzorg-offline");
          abrir.onerror = () => reject(abrir.error);
          abrir.onsuccess = () => {
            const banco = abrir.result;
            const transacao = banco.transaction("fila", "readonly");
            const contagem = transacao.objectStore("fila").count();
            contagem.onsuccess = () => {
              banco.close();
              resolve(contagem.result);
            };
            contagem.onerror = () => {
              banco.close();
              reject(contagem.error);
            };
          };
        }),
    );

    expect(contagemNoIndexedDb).toBe(1);
  });

  test("edita offline dois campos de um registro que já está no servidor e os dois chegam, sem conflito", async ({
    page,
    context,
  }) => {
    await page.goto("/dev/sync");

    // Cria a visita sem sinal e sobe, para ter um registro no servidor.
    await context.setOffline(true);
    await page.selectOption("#campo-entidade", "visita");
    await page.fill("#campo-nome-campo", "observacoes");
    await page.fill("#campo-valor", "Primeira anotação");
    await page.getByTestId("botao-salvar-campo").click();
    await context.setOffline(false);
    await page.getByTestId("botao-sincronizar-agora").click();

    const itens = page.getByTestId(/^item-fila-/);
    await expect(itens.first()).toHaveAttribute("data-estado", "sincronizado", {
      timeout: 15_000,
    });
    const visitaId = await itens.first().getAttribute("data-id-criado");
    expect(visitaId).toMatch(/^[0-9a-f-]{36}$/);

    // Sem sinal de novo: dois campos da mesma visita, os dois a partir da
    // versão 1 que a tela conhece.
    await context.setOffline(true);
    await page.fill("#campo-entidade-id", visitaId!);
    await page.fill("#campo-versao-base", "1");
    await page.fill("#campo-nome-campo", "pressao");
    await page.fill("#campo-valor", "110x70");
    await page.getByTestId("botao-salvar-campo").click();
    await page.fill("#campo-nome-campo", "temperatura");
    await page.fill("#campo-valor", "36.4");
    await page.getByTestId("botao-salvar-campo").click();
    await expect(itens).toHaveCount(3);

    await context.setOffline(false);
    await page.getByTestId("botao-sincronizar-agora").click();

    // O servidor aceitou as duas edições em ordem (versão 1 e depois 2):
    // nenhuma virou conflito com o próprio aparelho.
    await expect(async () => {
      for (const item of await itens.all()) {
        await expect(item).toHaveAttribute("data-estado", "sincronizado");
      }
    }).toPass({ timeout: 15_000 });
  });
});
