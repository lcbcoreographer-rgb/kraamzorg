// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface Chamada {
  funcao: string;
  args: Record<string, unknown>;
}

const estado = vi.hoisted(() => ({
  chamadas: [] as Chamada[],
  respostas: {} as Record<string, unknown>,
  depois: [] as (() => Promise<void> | void)[],
}));

vi.mock("next/server", () => ({
  after: (tarefa: () => Promise<void> | void) => {
    estado.depois.push(tarefa);
  },
}));
vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: () => ({
    rpc: async (funcao: string, args: Record<string, unknown>) => {
      estado.chamadas.push({ funcao, args });
      return { data: estado.respostas[funcao] ?? null, error: null };
    },
  }),
}));

import { POST } from "./route";

/**
 * P43: com a emissão automática ligada, a nota sai logo depois do pagamento
 * confirmado, depois de responder o webhook, e falha da nota nunca muda a
 * resposta (o pagamento já está confirmado).
 */

const COBRANCA = "ca900000-0000-4000-8000-000000000001";
const NOTA = "b0000000-0000-4000-8000-000000000001";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NFSE_PROVEDOR_BASE_URL: process.env.NFSE_PROVEDOR_BASE_URL,
  NFSE_PROVEDOR_API_KEY: process.env.NFSE_PROVEDOR_API_KEY,
  INFINITEPAY_HANDLE: process.env.INFINITEPAY_HANDLE,
};

function pedido() {
  return new Request("https://app.exemplo.invalid/api/webhooks/infinitepay", {
    method: "POST",
    body: JSON.stringify({ order_nsu: COBRANCA, transaction_nsu: "tx1" }),
  });
}

let pedidosAoProvedor: string[] = [];

function instalarRede(provedor: (corpo: unknown) => Response) {
  pedidosAoProvedor = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const endereco = String(url);
    if (endereco.includes("infinitepay")) {
      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          paid_amount: 455000,
          installments: 1,
          capture_method: "pix",
        }),
        { status: 200 },
      );
    }
    pedidosAoProvedor.push(endereco);
    return provedor(JSON.parse(String(init?.body ?? "{}")));
  });
}

beforeEach(() => {
  estado.chamadas = [];
  estado.depois = [];
  estado.respostas = {
    cobranca_do_pedido: {
      id: COBRANCA,
      status: "aberta",
      valor_centavos: 455000,
    },
    cobranca_baixar: { mudou: true, cobranca_id: COBRANCA },
    nota_para_emissao_automatica: {
      emitir: true,
      nota_id: NOTA,
      cobranca_id: COBRANCA,
      familia_id: "f0000000-0000-4000-8000-000000000001",
      status: "processando",
      valor_centavos: 455000,
      codigo_servico: "05266",
      descricao_servico: "Cuidado domiciliar pós-parto",
      tomador: {
        nome: "Carla Teste Pagadora",
        cpf: "52998224725",
        email: null,
        endereco: null,
      },
    },
    nota_registrar_resultado: { status: "emitida", mudou: true },
  };
  process.env.KZ_DADOS = "";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  process.env.INFINITEPAY_HANDLE = "handle-de-teste";
  process.env.NFSE_PROVEDOR_BASE_URL = "https://nfse.provedor.exemplo";
  process.env.NFSE_PROVEDOR_API_KEY = "chave-de-teste";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [chave, valor] of Object.entries(ORIGINAL)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

const funcoes = () => estado.chamadas.map((c) => c.funcao);

describe("webhook da InfinitePay e a nota automática", () => {
  it("baixa mudou: a nota é pedida depois da resposta, com a chave de idempotência da cobrança", async () => {
    instalarRede(() =>
      Response.json({ status: "emitida", provider_ref: "ref-1", numero: "88" }),
    );
    const r = await POST(pedido());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    // até aqui só a baixa: a nota espera a resposta
    expect(funcoes()).toEqual(["cobranca_do_pedido", "cobranca_baixar"]);
    expect(estado.depois).toHaveLength(1);

    await estado.depois[0]!();
    expect(funcoes()).toEqual([
      "cobranca_do_pedido",
      "cobranca_baixar",
      "nota_para_emissao_automatica",
      "nota_registrar_resultado",
    ]);
    expect(estado.chamadas[2]?.args).toEqual({ p_cobranca_id: COBRANCA });
    expect(estado.chamadas[3]?.args).toMatchObject({
      p_nota_id: NOTA,
      p_estado: "emitida",
      p_numero: "88",
    });
    expect(pedidosAoProvedor).toHaveLength(1);
  });

  it("emissão manual: o banco diz que não emite e o provedor não é chamado", async () => {
    estado.respostas.nota_para_emissao_automatica = {
      emitir: false,
      motivo: "manual",
    };
    instalarRede(() => Response.json({ status: "emitida", numero: "1" }));
    await POST(pedido());
    await estado.depois[0]!();
    expect(funcoes()).toEqual([
      "cobranca_do_pedido",
      "cobranca_baixar",
      "nota_para_emissao_automatica",
    ]);
    expect(pedidosAoProvedor).toEqual([]);
  });

  it("webhook repetido (baixa não mudou): nenhuma nota é pedida", async () => {
    estado.respostas.cobranca_baixar = { mudou: false };
    instalarRede(() => Response.json({ status: "emitida", numero: "1" }));
    const r = await POST(pedido());
    expect(r.status).toBe(200);
    expect(estado.depois).toEqual([]);
    expect(funcoes()).toEqual(["cobranca_do_pedido", "cobranca_baixar"]);
  });

  it("provedor recusa: o motivo volta ao banco e a resposta do webhook não muda", async () => {
    instalarRede(() =>
      Response.json({ erro: "CPF do tomador inválido" }, { status: 422 }),
    );
    const r = await POST(pedido());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    await estado.depois[0]!();
    expect(estado.chamadas.at(-1)).toMatchObject({
      funcao: "nota_registrar_resultado",
      args: {
        p_estado: "erro",
        p_erro: expect.stringContaining("CPF do tomador inválido"),
      },
    });
  });

  it("sem provedor configurado a nota fica pendente e o webhook responde normalmente", async () => {
    delete process.env.NFSE_PROVEDOR_BASE_URL;
    instalarRede(() => Response.json({ status: "emitida", numero: "1" }));
    const r = await POST(pedido());
    expect(r.status).toBe(200);
    await expect(estado.depois[0]!()).resolves.toBeUndefined();
    expect(funcoes()).toEqual(["cobranca_do_pedido", "cobranca_baixar"]);
  });
});
