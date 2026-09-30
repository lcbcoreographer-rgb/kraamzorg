import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import type { RespostaSincronizacao } from "@/lib/sync/tipos";

const obterSessao = vi.hoisted(() =>
  vi.fn<() => Promise<SessaoUsuario | null>>(),
);
vi.mock("@/lib/auth/sessao", () => ({ obterSessao }));

// O portal (P38) que o repositório real da visita usa. O banco de verdade é
// coberto por supabase/tests/022_agenda_portal.sql; aqui só a rota.
const portalFalso = vi.hoisted(() => ({
  estadoDaVisita: vi.fn(),
  registrarChegadaSincronizada: vi.fn(),
  registrarSaidaSincronizada: vi.fn(),
  resultadoProcessado: vi.fn(),
  guardarProcessado: vi.fn(),
}));
// O registro assistencial e o alerta (P39 e P40) gravam pelo repositório do
// schema api; o banco de verdade é coberto por supabase/tests/023_checklist_alertas.sql.
const assistencialFalso = vi.hoisted(() => ({
  obterChecklist: vi.fn(),
  registrarAtendimento: vi.fn(),
  listarAlertas: vi.fn(),
  registrarAlerta: vi.fn(),
}));
vi.mock("@/lib/dados/fabrica", () => ({
  obterRepositorios: async () => ({
    portal: portalFalso,
    assistencial: assistencialFalso,
  }),
}));

import { POST } from "./route";

function sessao(extra: Partial<SessaoUsuario> = {}): SessaoUsuario {
  return {
    usuarioId: "usuario-1",
    nome: "Perfil Teste Enfermeira",
    email: "enfermeira.teste@kraamzorgbrasil.test",
    papeis: ["enfermeira"],
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
    ...extra,
  };
}

function requisicao(corpo: unknown): Request {
  return new Request("http://localhost/api/sync", {
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
    entidadeId: null,
    campo: null,
    payload: { observacoes: "primeira visita" },
    versaoBase: null,
    criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
    ...sobrescreve,
  };
}

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
    vi.stubEnv("VERCEL_ENV", "");
    obterSessao.mockResolvedValue(sessao());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("processa um item válido e devolve 200", async () => {
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(200);

    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados).toHaveLength(1);
    expect(corpo.resultados[0]?.status).toBe("processado");
  });

  it("é idempotente: reenviar o mesmo id não reprocessa", async () => {
    const mesmoItem = item({
      id: "22222222-2222-4222-8222-222222222222",
    });

    const primeira = await POST(requisicao({ itens: [mesmoItem] }));
    const segunda = await POST(requisicao({ itens: [mesmoItem] }));

    const corpoPrimeira = (await primeira.json()) as RespostaSincronizacao;
    const corpoSegunda = (await segunda.json()) as RespostaSincronizacao;

    expect(corpoSegunda.resultados).toEqual(corpoPrimeira.resultados);
  });

  it("recusa corpo sem itens, com 400", async () => {
    const resposta = await POST(requisicao({ itens: [] }));
    expect(resposta.status).toBe(400);
  });

  it("item inválido recebe erro sozinho, sem derrubar os válidos do mesmo lote", async () => {
    const valido = item({ id: "44444444-4444-4444-8444-444444444444" });
    const resposta = await POST(
      requisicao({ itens: [item({ id: "não é um uuid" }), valido] }),
    );
    expect(resposta.status).toBe(200);

    const corpo = (await resposta.json()) as RespostaSincronizacao;
    const porId = new Map(corpo.resultados.map((r) => [r.id, r]));
    expect(porId.get("não é um uuid")?.status).toBe("erro");
    expect(porId.get(valido.id)?.status).toBe("processado");
  });

  it("recusa lote que não é uma lista de itens, com 400", async () => {
    const resposta = await POST(requisicao({ itens: "nada" }));
    expect(resposta.status).toBe(400);
  });

  it("recusa corpo que não é JSON, com 400", async () => {
    const resposta = await POST(
      new Request("http://localhost/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ isso não é json",
      }),
    );
    expect(resposta.status).toBe(400);
  });

  it("recusa o item com criadoNoClienteEm que não é data ISO", async () => {
    const resposta = await POST(
      requisicao({
        itens: [
          item({
            id: "33333333-3333-4333-8333-333333333333",
            criadoNoClienteEm: "ontem à tarde",
          }),
        ],
      }),
    );
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        status: "erro",
      }),
    ]);
  });
});

describe("POST /api/sync, sessão do CRM (P07)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    obterSessao.mockReset();
  });

  it("responde 401 sem sessão", async () => {
    obterSessao.mockResolvedValue(null);
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(401);
  });

  it("responde 401 com perfil desativado ou sem papel", async () => {
    obterSessao.mockResolvedValue(sessao({ ativo: false }));
    expect((await POST(requisicao({ itens: [item()] }))).status).toBe(401);
    obterSessao.mockResolvedValue(sessao({ papeis: [] }));
    expect((await POST(requisicao({ itens: [item()] }))).status).toBe(401);
  });

  it("responde 403 em AAL1, mesmo para papel sem MFA obrigatório (dado assistencial)", async () => {
    obterSessao.mockResolvedValue(
      sessao({ papeis: ["comercial"], aal: "aal1", aalPossivel: "aal1" }),
    );
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(403);
  });

  it("item de outra pessoa recebe erro sozinho, sem derrubar o lote", async () => {
    obterSessao.mockResolvedValue(sessao());
    const alheio = item({
      id: "55555555-5555-4555-8555-555555555555",
      usuarioId: "outra-pessoa",
    });
    const proprio = item({ id: "66666666-6666-4666-8666-666666666666" });
    const resposta = await POST(requisicao({ itens: [alheio, proprio] }));
    expect(resposta.status).toBe(200);

    const corpo = (await resposta.json()) as RespostaSincronizacao;
    const porId = new Map(corpo.resultados.map((r) => [r.id, r]));
    expect(porId.get(alheio.id)?.status).toBe("erro");
    expect(porId.get(proprio.id)?.status).toBe("processado");
  });
});

describe("POST /api/sync em produção (P38: só a visita tem repositório real)", () => {
  const visitaId = "77777777-7777-4777-8777-777777777777";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "producao");
    vi.stubEnv("VERCEL_ENV", "");
    obterSessao.mockResolvedValue(sessao());
    portalFalso.resultadoProcessado.mockResolvedValue(null);
    portalFalso.estadoDaVisita.mockResolvedValue({
      visitaId,
      versao: 3,
      estado: "confirmada",
      checkinEm: null,
      checkoutEm: null,
    });
    portalFalso.registrarChegadaSincronizada.mockResolvedValue({ versao: 4 });
    portalFalso.guardarProcessado.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    obterSessao.mockReset();
    Object.values(portalFalso).forEach((f) => f.mockReset());
    Object.values(assistencialFalso).forEach((f) => f.mockReset());
  });

  it("exige sessão também em produção", async () => {
    obterSessao.mockResolvedValue(null);
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(401);
  });

  it("recusa, no próprio item, entidade que ainda não tem repositório real", async () => {
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados[0]?.status).toBe("erro");
  });

  it("a chegada da visita sobe pelas funções do banco, com a sessão da enfermeira", async () => {
    const chegada = item({
      id: "88888888-8888-4888-8888-888888888888",
      entidade: "visita",
      entidadeId: visitaId,
      campo: "checkin_em",
      payload: "2026-09-29T12:05:00.000Z",
      versaoBase: 3,
    });
    const resposta = await POST(requisicao({ itens: [chegada] }));
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados[0]).toMatchObject({
      id: chegada.id,
      status: "processado",
    });
    expect(portalFalso.registrarChegadaSincronizada).toHaveBeenCalledWith(
      visitaId,
      "2026-09-29T12:05:00.000Z",
    );
    expect(portalFalso.guardarProcessado).toHaveBeenCalledTimes(1);
  });

  it("o mesmo item reenviado não grava de novo", async () => {
    const id = "99999999-9999-4999-8999-999999999999";
    portalFalso.resultadoProcessado.mockResolvedValue({
      id,
      status: "processado",
      versao: 4,
    });
    const reenviado = item({
      id,
      entidade: "visita",
      entidadeId: visitaId,
      campo: "checkin_em",
      payload: "2026-09-29T12:05:00.000Z",
      versaoBase: 3,
    });
    const resposta = await POST(requisicao({ itens: [reenviado] }));
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados[0]).toMatchObject({ id, status: "processado" });
    expect(portalFalso.registrarChegadaSincronizada).not.toHaveBeenCalled();
  });

  it("o alerta clínico criado no aparelho sobe pelo banco, com a sessão da enfermeira", async () => {
    assistencialFalso.registrarAlerta.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    portalFalso.resultadoProcessado.mockResolvedValue(null);
    const alerta = item({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      entidade: "alerta_clinico",
      entidadeId: null,
      payload: {
        visitaId: visitaId,
        regraId: "regra-teste",
        instrumentoVersao: "v1",
        bebeId: null,
        campo: null,
        valorObservado: null,
        manual: true,
      },
    });
    const resposta = await POST(requisicao({ itens: [alerta] }));
    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados[0]).toMatchObject({
      id: alerta.id,
      status: "processado",
    });
    expect(assistencialFalso.registrarAlerta).toHaveBeenCalledTimes(1);
  });
});
