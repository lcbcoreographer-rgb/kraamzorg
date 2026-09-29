import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarLoteDoApp } from "./enviar-app";
import type { ItemSincronizacaoEntrada } from "./tipos";

/**
 * O envio da fila usado pelas telas leva cada entidade pela rota que tem
 * repositório de verdade: a consulta pré-natal vai para /api/sync/prenatal
 * (P35), o resto continua em /api/sync (P12). Um destino fora do ar não
 * derruba o outro.
 */

function item(
  id: string,
  entidade: ItemSincronizacaoEntrada["entidade"],
): ItemSincronizacaoEntrada {
  return {
    id,
    usuarioId: "u1",
    entidade,
    entidadeId: "e1",
    campo: "C.nome_da_gestante",
    payload: "Ana Teste",
    versaoBase: 1,
    criadoNoClienteEm: "2026-09-29T10:00:00.000Z",
  };
}

function resposta(resultados: unknown[]) {
  return new Response(JSON.stringify({ resultados }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enviarLoteDoApp", () => {
  it("cada entidade vai para a sua rota, e o resultado volta junto", async () => {
    const fetchFalso = vi.fn(async (url: string, _init?: RequestInit) =>
      url === "/api/sync/prenatal"
        ? resposta([{ id: "a", status: "processado", versaoResultante: 2 }])
        : resposta([{ id: "b", status: "processado", versaoResultante: 1 }]),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const r = await enviarLoteDoApp([
      item("a", "consulta_prenatal"),
      item("b", "visita"),
    ]);

    const chamadas = fetchFalso.mock.calls.map((c) => c[0]);
    expect(chamadas.sort()).toEqual(["/api/sync", "/api/sync/prenatal"]);
    expect(r.resultados.map((x) => x.id).sort()).toEqual(["a", "b"]);
    const prenatal = JSON.parse(
      String(
        (
          fetchFalso.mock.calls.find(
            (c) => c[0] === "/api/sync/prenatal",
          )![1] as RequestInit
        ).body,
      ),
    ) as { itens: { id: string }[] };
    expect(prenatal.itens.map((i) => i.id)).toEqual(["a"]);
  });

  it("só chama a rota que tem item", async () => {
    const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) =>
      resposta([{ id: "a", status: "processado", versaoResultante: 2 }]),
    );
    vi.stubGlobal("fetch", fetchFalso);
    await enviarLoteDoApp([item("a", "consulta_prenatal")]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0]![0]).toBe("/api/sync/prenatal");
  });

  it("rota fora do ar devolve erro só para os itens dela; a outra segue", async () => {
    const fetchFalso = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "/api/sync/prenatal")
        return new Response("{}", { status: 503 });
      return resposta([{ id: "b", status: "processado", versaoResultante: 1 }]);
    });
    vi.stubGlobal("fetch", fetchFalso);
    const r = await enviarLoteDoApp([
      item("a", "consulta_prenatal"),
      item("b", "visita"),
    ]);
    const por = new Map(r.resultados.map((x) => [x.id, x]));
    expect(por.get("a")).toMatchObject({
      status: "erro",
      erro: "sem conexão com o servidor",
    });
    expect(por.get("b")?.status).toBe("processado");
  });
});
