import { describe, expect, it } from "vitest";
import { lerAdendoDoPayload, processarLote } from "./protocolo";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";
import type { ItemSincronizacaoEntrada } from "./tipos";

/**
 * P39 item 3: correção do registro assinado é adendo com motivo. O adendo
 * pedido pela enfermeira sobe pela mesma fila e chega depois do registro;
 * o registro original nunca é sobrescrito (invariante 4, D-05).
 */

const VISITA = "11111111-1111-4111-8111-111111111111";

function registro(id: string, criadoNoClienteEm: string, payload: unknown) {
  return {
    id,
    usuarioId: "usuario-1",
    entidade: "registro_atendimento",
    entidadeId: VISITA,
    campo: null,
    payload,
    versaoBase: null,
    criadoNoClienteEm,
  } satisfies ItemSincronizacaoEntrada;
}

describe("lerAdendoDoPayload", () => {
  it("reconhece o formato do adendo", () => {
    expect(
      lerAdendoDoPayload({ adendo: { motivo: "Correção", conteudo: "Texto" } }),
    ).toEqual({ motivo: "Correção", conteudo: "Texto" });
  });

  it("não confunde registro com adendo", () => {
    expect(lerAdendoDoPayload({ dados: {} })).toBeNull();
    expect(lerAdendoDoPayload(null)).toBeNull();
    expect(
      lerAdendoDoPayload({ adendo: { motivo: 1, conteudo: "x" } }),
    ).toBeNull();
    expect(lerAdendoDoPayload([1])).toBeNull();
  });
});

describe("adendo pedido de propósito", () => {
  it("vira adendo depois do registro e não altera o original", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const original = { dados: { "2.1": { temperatura: 36.6 } }, resumo: "Ok" };
    const resposta = await processarLote(
      {
        itens: [
          registro("a", "2026-09-29T10:00:00.000Z", original),
          registro("b", "2026-09-29T10:05:00.000Z", {
            adendo: { motivo: "Correção da temperatura", conteudo: "Era 36,9" },
          }),
        ],
      },
      repo,
    );
    expect(resposta.resultados.map((r) => r.status)).toEqual([
      "processado",
      "processado",
    ]);
    expect(resposta.resultados[1]?.virouAdendo).toBe(true);
    expect(
      (await repo.buscarEstado("registro_atendimento", VISITA))?.dados,
    ).toEqual(original);
    expect(repo.listarAdendos()).toHaveLength(1);
  });

  it("adendo sem registro no servidor volta como erro, sem gravar", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const resposta = await processarLote(
      {
        itens: [
          registro("c", "2026-09-29T10:05:00.000Z", {
            adendo: { motivo: "Correção", conteudo: "Texto" },
          }),
        ],
      },
      repo,
    );
    expect(resposta.resultados[0]?.status).toBe("erro");
    expect(repo.listarAdendos()).toHaveLength(0);
  });

  it("reenviar o mesmo adendo não duplica (idempotente pelo id)", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const itens = [
      registro("a", "2026-09-29T10:00:00.000Z", { dados: {} }),
      registro("b", "2026-09-29T10:05:00.000Z", {
        adendo: { motivo: "Correção", conteudo: "Texto" },
      }),
    ];
    await processarLote({ itens }, repo);
    await processarLote({ itens }, repo);
    expect(repo.listarAdendos()).toHaveLength(1);
  });
});
