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
  arquivos: new Map<string, Uint8Array>(),
  falhaDeBanco: false,
}));

vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: () => ({
    rpc: async (funcao: string, args: Record<string, unknown>) => {
      estado.chamadas.push({ funcao, args });
      if (estado.falhaDeBanco && funcao === "contrato_registrar_assinatura") {
        return { data: null, error: { code: "XX000" } };
      }
      const resposta = estado.respostas[funcao];
      return {
        data:
          typeof resposta === "function" ? resposta(args) : (resposta ?? null),
        error: null,
      };
    },
  }),
}));

vi.mock("@/lib/armazenamento/supabase", () => ({
  criarArmazenamentoSupabase: () => ({
    salvar: async (caminho: string, conteudo: Uint8Array) => {
      estado.arquivos.set(caminho, conteudo);
    },
  }),
}));

import { POST } from "./route";

/**
 * P31, aceite: "webhook forjado não muda nada". O corpo do POST nunca
 * decide: o segredo do caminho é a primeira barreira e a reconsulta do
 * documento pela API da Autentique é a segunda. Sem rede: o fetch é
 * interceptado.
 */

const DOC = "doc-fluxo-00001";
const CONTRATO = "b1900000-0000-4000-8000-000000000001";
const COBRANCA = "ca900000-0000-4000-8000-000000000001";
const PDF = new TextEncoder().encode("%PDF-1.7 assinado de teste");

function corpo(id = DOC) {
  return { event: { type: "document.finished", data: { id } } };
}

function pedido(segredo: string, c: unknown) {
  return [
    new Request(
      `https://app.exemplo.invalid/api/webhooks/autentique/${segredo}`,
      {
        method: "POST",
        body: JSON.stringify(c),
      },
    ),
    { params: Promise.resolve({ segredo }) },
  ] as const;
}

function documentoAutentique(concluido: boolean) {
  const assinado = concluido ? { created_at: "2026-09-29T15:00:00Z" } : null;
  return {
    data: {
      document: {
        id: DOC,
        name: "Contrato",
        created_at: "2026-09-28T15:00:00Z",
        files: {
          signed: concluido
            ? "https://arquivos.exemplo.invalid/assinado.pdf"
            : null,
        },
        signatures: [
          {
            public_id: "1",
            name: "A",
            email: "a@exemplo.invalid",
            action: { name: "SIGN" },
            link: null,
            signed: assinado,
            rejected: null,
          },
          {
            public_id: "2",
            name: "B",
            email: "b@exemplo.invalid",
            action: { name: "SIGN" },
            link: null,
            signed: assinado,
            rejected: null,
          },
        ],
      },
    },
  };
}

let requisicoes: {
  url: string;
  corpo?: string;
  cabecalhos: Record<string, string>;
}[] = [];

function instalarFetch(
  opcoes: {
    concluido?: boolean;
    pdfValido?: boolean;
    infinitepay?: unknown;
  } = {},
) {
  requisicoes = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const endereco = String(url);
    requisicoes.push({
      url: endereco,
      corpo: typeof init?.body === "string" ? init.body : undefined,
      cabecalhos: (init?.headers ?? {}) as Record<string, string>,
    });
    if (endereco.includes("api.autentique.com.br")) {
      return new Response(
        JSON.stringify(documentoAutentique(opcoes.concluido ?? true)),
        { status: 200 },
      );
    }
    if (endereco.includes("arquivos.exemplo.invalid")) {
      return new Response(opcoes.pdfValido === false ? "nao e pdf" : PDF, {
        status: 200,
      });
    }
    if (endereco.includes("api.checkout.infinitepay.io/links")) {
      return new Response(
        JSON.stringify(
          opcoes.infinitepay ?? {
            success: true,
            url: "https://pay.exemplo.invalid/l/1",
            slug: "s1",
            installments: { max: 3 },
          },
        ),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  });
}

const pendente = (parcelas: number) => [
  {
    cobranca_id: COBRANCA,
    contrato_id: CONTRATO,
    familia_id: "f1",
    valor_centavos: 455000,
    parcelas,
    parcelas_max: 3,
    acima_do_limite: parcelas > 3,
    tem_link: false,
    descricao: "Cuidado domiciliar pós-parto",
    cliente: {
      nome: "Marina",
      email: "m@exemplo.invalid",
      telefone: "+5511900000001",
    },
  },
];

beforeEach(() => {
  estado.chamadas = [];
  estado.arquivos = new Map();
  estado.falhaDeBanco = false;
  estado.respostas = {
    contrato_do_documento: {
      id: CONTRATO,
      status: "enviado",
      familia_id: "f1",
    },
    contrato_registrar_assinatura: { mudou: true, contrato_id: CONTRATO },
    cobrancas_sem_link: pendente(3),
    cobranca_registrar_link: { ok: true },
    cobranca_avisar_falha_link: null,
  };
  process.env.AUTENTIQUE_API_TOKEN = "token-de-teste";
  process.env.AUTENTIQUE_WEBHOOK_SECRET = "segredo-de-teste";
  process.env.INFINITEPAY_HANDLE = "handle-de-teste";
  process.env.APP_BASE_URL = "https://app.exemplo.invalid";
  delete process.env.KZ_DADOS;
  instalarFetch();
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

describe("webhook da Autentique", () => {
  it("segredo errado: 404, nada consultado, nada gravado", async () => {
    const r = await POST(...pedido("segredo-errado", corpo()));
    expect(r.status).toBe(404);
    expect(estado.chamadas).toEqual([]);
    expect(requisicoes).toEqual([]);
  });

  it("forjado: o corpo diz concluído, mas a reconsulta diz que não; nada muda", async () => {
    instalarFetch({ concluido: false });
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).toEqual(["contrato_do_documento"]);
    expect(estado.arquivos.size).toBe(0);
  });

  it("documento que não é de nenhum contrato: nada muda", async () => {
    estado.respostas.contrato_do_documento = null;
    const r = await POST(
      ...pedido("segredo-de-teste", corpo("doc-de-outro-sistema")),
    );
    expect(r.status).toBe(200);
    expect(funcoes()).toEqual(["contrato_do_documento"]);
  });

  it("assinado de verdade: guarda o PDF assinado com nome pelo id, registra e gera o link com no máximo 3 parcelas", async () => {
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });

    expect([...estado.arquivos.keys()]).toEqual([
      `contratos/${CONTRATO}-assinado.pdf`,
    ]);
    expect(funcoes()).toEqual([
      "contrato_do_documento",
      "contrato_registrar_assinatura",
      "cobrancas_sem_link",
      "cobranca_registrar_link",
    ]);
    expect(estado.chamadas[1]?.args).toEqual({
      p_documento_id: DOC,
      p_pdf_path: `contratos/${CONTRATO}-assinado.pdf`,
    });
    // só a chamada processada de verdade conta como acerto na saúde (P14)
    expect(saude()).toEqual([{ p_origem: "autentique", p_ok: true }]);

    // O token da API não vai junto no download do PDF assinado.
    const download = requisicoes.find((x) =>
      x.url.includes("arquivos.exemplo.invalid"),
    );
    expect(JSON.stringify(download?.cabecalhos ?? {})).not.toMatch(
      /token-de-teste|authorization/i,
    );

    // Aceite do P32 v4.2: o link pedido mostra no máximo 3 parcelas sem juros.
    const link = requisicoes.find((x) => x.url.endsWith("/links"));
    const enviado = JSON.parse(link?.corpo ?? "{}");
    expect(enviado.order_nsu).toBe(COBRANCA);
    expect(enviado.installments.max).toBeLessThanOrEqual(3);
    expect(enviado.items[0]).toMatchObject({ price: 455000, quantity: 1 });
    expect(enviado.webhook_url).toBe(
      "https://app.exemplo.invalid/api/webhooks/infinitepay",
    );
    expect(enviado.redirect_url).toBe(
      "https://app.exemplo.invalid/pagamento/recebido",
    );
    expect(JSON.stringify(enviado)).not.toMatch(/cpf|document"?:\s*"\d/i);
    expect(estado.chamadas[3]?.args).toEqual({
      p_cobranca_id: COBRANCA,
      p_url: "https://pay.exemplo.invalid/l/1",
      p_slug: "s1",
    });
  });

  it("duplicado: contrato já assinado não muda, e ainda tenta os links que faltam", async () => {
    estado.respostas.contrato_do_documento = {
      id: CONTRATO,
      status: "assinado",
      familia_id: "f1",
    };
    estado.respostas.cobrancas_sem_link = [];
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: false });
    expect(funcoes()).toEqual(["contrato_do_documento", "cobrancas_sem_link"]);
    expect(estado.arquivos.size).toBe(0);
  });

  it("PDF assinado que não é PDF: assina do mesmo jeito, sem caminho (o banco avisa o comercial)", async () => {
    instalarFetch({ pdfValido: false });
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(estado.arquivos.size).toBe(0);
    expect(estado.chamadas[1]?.args).toEqual({
      p_documento_id: DOC,
      p_pdf_path: null,
    });
  });

  it("parcelamento acima do limite: nenhum link é pedido à InfinitePay e o financeiro é avisado", async () => {
    estado.respostas.cobrancas_sem_link = pendente(5);
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(requisicoes.some((x) => x.url.endsWith("/links"))).toBe(false);
    expect(funcoes()).toContain("cobranca_avisar_falha_link");
    expect(funcoes()).not.toContain("cobranca_registrar_link");
    expect(
      estado.chamadas
        .filter((c) => c.funcao !== "saude_registrar_webhook")
        .at(-1)?.args,
    ).toEqual({
      p_cobranca_id: COBRANCA,
      p_motivo: "acima_do_limite",
    });
  });

  it("a InfinitePay mostrando mais de 3 parcelas descarta o link e avisa o financeiro", async () => {
    instalarFetch({
      infinitepay: {
        success: true,
        url: "https://pay.exemplo.invalid/l/2",
        installments: { max: 12 },
      },
    });
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(funcoes()).not.toContain("cobranca_registrar_link");
    expect(
      estado.chamadas
        .filter((c) => c.funcao !== "saude_registrar_webhook")
        .at(-1)?.args,
    ).toEqual({
      p_cobranca_id: COBRANCA,
      p_motivo: "falha_integracao",
    });
  });

  it("InfinitePay fora do ar: o contrato continua assinado e a resposta é 200", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const endereco = String(url);
      if (endereco.includes("api.autentique.com.br")) {
        return new Response(JSON.stringify(documentoAutentique(true)), {
          status: 200,
        });
      }
      if (endereco.includes("arquivos.exemplo.invalid"))
        return new Response(PDF, { status: 200 });
      return new Response("erro", { status: 503 });
    });
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(funcoes()).toContain("cobranca_avisar_falha_link");
  });

  it("erro de banco na gravação: 500 sem detalhe, para a Autentique reenviar", async () => {
    estado.falhaDeBanco = true;
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false });
  });

  it("sem credencial configurada: 500 e nada consultado", async () => {
    delete process.env.AUTENTIQUE_API_TOKEN;
    const r = await POST(...pedido("segredo-de-teste", corpo()));
    expect(r.status).toBe(500);
    expect(estado.chamadas).toEqual([]);
  });
});
