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
 * P32, aceite: teste automatizado com `payment_check` simulado cobre webhook
 * duplicado e forjado. O webhook da InfinitePay não é assinado: o corpo
 * nunca decide uma baixa, só a confirmação do `payment_check` decide, e o
 * valor pago vem dela.
 */

const COBRANCA = "ca900000-0000-4000-8000-000000000001";

function pedido(corpo: unknown) {
  return new Request("https://app.exemplo.invalid/api/webhooks/infinitepay", {
    method: "POST",
    body: JSON.stringify(corpo),
  });
}

let verificacoes: Record<string, unknown>[] = [];

function instalarPaymentCheck(resposta: unknown, status = 200) {
  verificacoes = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    verificacoes.push({
      url: String(url),
      corpo: JSON.parse(String(init?.body ?? "{}")),
    });
    return new Response(JSON.stringify(resposta), { status });
  });
}

beforeEach(() => {
  estado.chamadas = [];
  estado.respostas = {
    cobranca_do_pedido: {
      id: COBRANCA,
      status: "aberta",
      valor_centavos: 455000,
    },
    cobranca_baixar: { mudou: true, cobranca_id: COBRANCA },
  };
  process.env.INFINITEPAY_HANDLE = "handle-de-teste";
  instalarPaymentCheck({
    success: true,
    paid: true,
    paid_amount: 455000,
    installments: 3,
    capture_method: "credit_card",
    receipt_url: "https://recibo.exemplo.invalid/1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// A saúde do webhook (P14) é observação, não parte do trabalho: fica fora da
// lista do que o webhook faz no banco e tem asserção própria.
const funcoes = () =>
  estado.chamadas
    .map((c) => c.funcao)
    .filter((f) => f !== "saude_registrar_webhook");
const saude = () =>
  estado.chamadas
    .filter((c) => c.funcao === "saude_registrar_webhook")
    .map((c) => c.args);

describe("webhook da InfinitePay", () => {
  it("corpo sem order_nsu: 400 e nada consultado", async () => {
    const r = await POST(pedido({ paid_amount: 455000 }));
    expect(r.status).toBe(400);
    expect(estado.chamadas).toEqual([]);
    expect(verificacoes).toEqual([]);
  });

  it("forjado para um pedido que não existe: nada baixa", async () => {
    estado.respostas.cobranca_do_pedido = null;
    const r = await POST(
      pedido({ order_nsu: "qualquer-coisa", paid_amount: 455000 }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).toEqual(["cobranca_do_pedido"]);
    expect(verificacoes).toEqual([]);
  });

  it("forjado para um pedido de verdade: o corpo diz pago, o payment_check diz que não; nada baixa", async () => {
    instalarPaymentCheck({ success: true, paid: false });
    const r = await POST(
      pedido({
        order_nsu: COBRANCA,
        paid_amount: 455000,
        receipt_url: "https://falso.exemplo.invalid",
      }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).toEqual(["cobranca_do_pedido"]);
    expect(verificacoes).toHaveLength(1);
  });

  it("confirmado pelo payment_check: baixa com o valor, as parcelas e o método que vieram de lá", async () => {
    const r = await POST(
      pedido({
        order_nsu: COBRANCA,
        transaction_nsu: "tx1",
        invoice_slug: "inv1",
        // o corpo mente sobre o valor: o que vale é o payment_check
        paid_amount: 1,
        installments: 12,
      }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(funcoes()).toEqual(["cobranca_do_pedido", "cobranca_baixar"]);
    // só a chamada processada de verdade conta como acerto na saúde (P14)
    expect(saude()).toEqual([{ p_origem: "infinitepay", p_ok: true }]);
    expect(estado.chamadas[1]?.args).toEqual({
      p_order_nsu: COBRANCA,
      p_valor_pago: 455000,
      p_parcelas: 3,
      p_metodo: "credit_card",
      p_transaction_nsu: "tx1",
      p_invoice_slug: "inv1",
      p_recibo_url: "https://recibo.exemplo.invalid/1",
    });
  });

  it("valor confirmado abaixo do da cobrança: não baixa (fica para a baixa manual)", async () => {
    instalarPaymentCheck({ success: true, paid: true, paid_amount: 100 });
    const r = await POST(pedido({ order_nsu: COBRANCA }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).not.toContain("cobranca_baixar");
  });

  it("duplicado: cobrança já paga não consulta o payment_check nem baixa de novo", async () => {
    estado.respostas.cobranca_do_pedido = {
      id: COBRANCA,
      status: "paga",
      valor_centavos: 455000,
    };
    const r = await POST(pedido({ order_nsu: COBRANCA }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).toEqual(["cobranca_do_pedido"]);
    expect(verificacoes).toEqual([]);
  });

  it("duas entregas seguidas: a segunda vê a baixa idempotente do banco", async () => {
    await POST(pedido({ order_nsu: COBRANCA }));
    estado.respostas.cobranca_baixar = { mudou: false, motivo: "ja_paga" };
    const r = await POST(pedido({ order_nsu: COBRANCA }));
    expect(await r.json()).toEqual({ ok: false });
  });

  it("falha do payment_check ou do banco: 500 sem detalhe, para a InfinitePay reenviar", async () => {
    instalarPaymentCheck({}, 502);
    const r = await POST(pedido({ order_nsu: COBRANCA }));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false });
  });

  it("sem o handle configurado: 500 e nada consultado", async () => {
    delete process.env.INFINITEPAY_HANDLE;
    const r = await POST(pedido({ order_nsu: COBRANCA }));
    expect(r.status).toBe(500);
    expect(estado.chamadas).toEqual([]);
  });
});
