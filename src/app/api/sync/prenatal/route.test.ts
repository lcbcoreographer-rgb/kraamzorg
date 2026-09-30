import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import type { OperacaoRepositorio } from "@/lib/dados/repositorios";
import type { RespostaSincronizacao } from "@/lib/sync/tipos";

const obterSessao = vi.hoisted(() =>
  vi.fn<() => Promise<SessaoUsuario | null>>(),
);
const obterRepositorios = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/sessao", () => ({ obterSessao }));
vi.mock("@/lib/dados/fabrica", () => ({ obterRepositorios }));

import { POST } from "./route";

const CONSULTA = "22222222-2222-4222-8222-222222222222";

function sessao(extra: Partial<SessaoUsuario> = {}): SessaoUsuario {
  return {
    usuarioId: "usuario-1",
    nome: "Perfil Teste Coordenacao",
    email: "coordenacao.teste@kraamzorgbrasil.test",
    papeis: ["coordenacao"],
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
    ...extra,
  };
}

function requisicao(corpo: unknown): Request {
  return new Request("http://localhost/api/sync/prenatal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

function item(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    usuarioId: "usuario-1",
    entidade: "consulta_prenatal",
    entidadeId: CONSULTA,
    campo: "C.nome_da_gestante",
    payload: "Ana Teste",
    versaoBase: 1,
    criadoNoClienteEm: "2026-09-29T10:00:00.000Z",
    ...sobrescreve,
  };
}

const salvarCampo = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  salvarCampo.mockResolvedValue({
    ok: true,
    versao: 2,
    conflito: false,
    original: null,
    repetido: false,
  });
  obterRepositorios.mockResolvedValue({
    operacao: { salvarCampo } as unknown as OperacaoRepositorio,
  });
  obterSessao.mockResolvedValue(sessao());
});

describe("POST /api/sync/prenatal", () => {
  it("sem sessão: 401", async () => {
    obterSessao.mockResolvedValue(null);
    const r = await POST(requisicao({ itens: [item()] }));
    expect(r.status).toBe(401);
    expect(salvarCampo).not.toHaveBeenCalled();
  });

  it("sessão só com senha (AAL1): 403, dado assistencial pede o código do MFA", async () => {
    obterSessao.mockResolvedValue(sessao({ aal: "aal1" }));
    const r = await POST(requisicao({ itens: [item()] }));
    expect(r.status).toBe(403);
    expect(salvarCampo).not.toHaveBeenCalled();
  });

  it("perfil desativado ou sem papel: 401", async () => {
    obterSessao.mockResolvedValue(sessao({ ativo: false }));
    expect((await POST(requisicao({ itens: [item()] }))).status).toBe(401);
    obterSessao.mockResolvedValue(sessao({ papeis: [] }));
    expect((await POST(requisicao({ itens: [item()] }))).status).toBe(401);
  });

  it("corpo que não é JSON ou sem itens: 400", async () => {
    const semJson = new Request("http://localhost/api/sync/prenatal", {
      method: "POST",
      body: "não é json",
    });
    expect((await POST(semJson)).status).toBe(400);
    expect((await POST(requisicao({ itens: [] }))).status).toBe(400);
    expect((await POST(requisicao({}))).status).toBe(400);
  });

  it("aplica o item pelo repositório da sessão e devolve o resultado", async () => {
    const r = await POST(requisicao({ itens: [item()] }));
    expect(r.status).toBe(200);
    const corpo = (await r.json()) as RespostaSincronizacao;
    expect(corpo.resultados).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        status: "processado",
        versaoResultante: 2,
      },
    ]);
    expect(salvarCampo).toHaveBeenCalledWith(
      expect.objectContaining({
        consultaId: CONSULTA,
        bloco: "C",
        campo: "nome_da_gestante",
      }),
    );
  });

  it("item de outro usuário e item inválido recebem erro e não derrubam o válido", async () => {
    const r = await POST(
      requisicao({
        itens: [
          item({
            id: "33333333-3333-4333-8333-333333333333",
            usuarioId: "outra-pessoa",
          }),
          {
            id: "44444444-4444-4444-8444-444444444444",
            entidade: "consulta_prenatal",
          },
          item(),
        ],
      }),
    );
    const corpo = (await r.json()) as RespostaSincronizacao;
    const por = new Map(corpo.resultados.map((x) => [x.id, x]));
    expect(por.get("11111111-1111-4111-8111-111111111111")?.status).toBe(
      "processado",
    );
    expect(por.get("33333333-3333-4333-8333-333333333333")).toMatchObject({
      status: "erro",
      erro: "item de outro usuário",
    });
    expect(por.get("44444444-4444-4444-8444-444444444444")).toMatchObject({
      status: "erro",
      erro: "item inválido",
    });
    expect(salvarCampo).toHaveBeenCalledTimes(1);
  });

  it("entidade de outra fila não passa por esta rota", async () => {
    const r = await POST(requisicao({ itens: [item({ entidade: "visita" })] }));
    const corpo = (await r.json()) as RespostaSincronizacao;
    expect(corpo.resultados[0]).toMatchObject({
      status: "erro",
      erro: "item inválido",
    });
    expect(salvarCampo).not.toHaveBeenCalled();
  });

  it("banco fora do ar: 503, e o aparelho tenta de novo", async () => {
    salvarCampo.mockRejectedValue(new Error("sem conexão"));
    const r = await POST(requisicao({ itens: [item()] }));
    expect(r.status).toBe(503);
  });
});
