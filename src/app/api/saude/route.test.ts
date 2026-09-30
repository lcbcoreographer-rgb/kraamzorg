import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: () => ({ rpc }),
}));

import { GET } from "./route";

const BOM = {
  recalculo_diario: {
    ultimo_concluido_em: "2026-09-30T10:05:00Z",
    status: "concluido",
    horas_desde: 3,
    tolerancia_horas: 26,
    atrasado: false,
    com_erro: false,
  },
  cron: [
    {
      job: "recalculo_diario",
      ultimo_em: "2026-09-30T10:00:00Z",
      status: "succeeded",
    },
  ],
  webhooks: [
    {
      origem: "infinitepay",
      ultimo_ok_em: "2026-09-30T09:00:00Z",
      falha_recente: false,
    },
  ],
  falhas: {
    janela_horas: 24,
    automacoes_com_falha: 0,
    sincronizacao_com_erro: 0,
  },
};

const pedir = (segredo?: string) =>
  new Request("https://app.exemplo.invalid/api/saude", {
    headers: segredo ? { "x-kz-interno-secret": segredo } : {},
  });

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("INTERNAL_ROUTES_SECRET", "segredo-interno-teste");
});

describe("GET /api/saude", () => {
  it("tudo certo: 200 e só o estado para quem não tem o segredo", async () => {
    rpc.mockResolvedValue({ data: BOM, error: null });
    const r = await GET(pedir());
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.estado).toBe("ok");
    expect(Object.keys(corpo).sort()).toEqual(["estado", "verificadoEm"]);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("com o segredo, traz cada verificação", async () => {
    rpc.mockResolvedValue({ data: BOM, error: null });
    const corpo = await (await GET(pedir("segredo-interno-teste"))).json();
    expect(corpo.verificacoes.map((v: { nome: string }) => v.nome)).toEqual([
      "banco",
      "recalculo_diario",
      "agendador",
      "webhook_infinitepay",
      "falhas_recentes",
    ]);
  });

  it("segredo errado não abre o detalhe", async () => {
    rpc.mockResolvedValue({ data: BOM, error: null });
    const corpo = await (await GET(pedir("errado"))).json();
    expect(corpo.verificacoes).toBeUndefined();
  });

  it("recálculo das 7h atrasado: 503", async () => {
    rpc.mockResolvedValue({
      data: {
        ...BOM,
        recalculo_diario: {
          ...BOM.recalculo_diario,
          horas_desde: 40,
          atrasado: true,
        },
      },
      error: null,
    });
    const r = await GET(pedir());
    expect(r.status).toBe(503);
    expect((await r.json()).estado).toBe("falha");
  });

  it("webhook com falha recente: 200 com atenção", async () => {
    rpc.mockResolvedValue({
      data: {
        ...BOM,
        webhooks: [
          {
            origem: "autentique",
            ultima_falha_em: "2026-09-30T11:00:00Z",
            falha_recente: true,
          },
        ],
      },
      error: null,
    });
    const r = await GET(pedir());
    expect(r.status).toBe(200);
    expect((await r.json()).estado).toBe("atencao");
  });

  it("banco fora do ar ou erro de permissão: 503, sem detalhe do erro", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "senha do banco errada" },
    });
    const r = await GET(pedir("segredo-interno-teste"));
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("senha");
  });

  it("exceção ao criar o cliente (sem service_role) também é 503", async () => {
    rpc.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
    });
    expect((await GET(pedir())).status).toBe(503);
  });
});
