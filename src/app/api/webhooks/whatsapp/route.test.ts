import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/db/cliente-servico", () => ({
  criarClienteServico: () => ({ rpc }),
}));

import { GET, POST } from "./route";

const SEGREDO = "segredo-app-teste";
const carga = JSON.stringify({
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [
              {
                id: "wamid.A",
                status: "delivered",
                timestamp: "1790000000",
                recipient_id: "5511900000001",
              },
              {
                id: "wamid.B",
                status: "failed",
                timestamp: "1790000100",
                errors: [{ code: 131047 }],
              },
            ],
          },
        },
      ],
    },
  ],
});
const assinar = (corpo: string) =>
  `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
const pedir = (corpo: string, assinatura: string | null) =>
  new Request("https://app.exemplo.invalid/api/webhooks/whatsapp", {
    method: "POST",
    headers: assinatura ? { "x-hub-signature-256": assinatura } : {},
    body: corpo,
  });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (nome: string) =>
    nome === "mensagem_registrar_status"
      ? { data: { registrado: true }, error: null }
      : { data: null, error: null },
  );
  vi.stubEnv("WHATSAPP_APP_SECRET", SEGREDO);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "token-de-verificacao");
});

describe("GET /api/webhooks/whatsapp", () => {
  it("responde o desafio da Meta quando o token confere", async () => {
    const r = await GET(
      new Request(
        "https://app.exemplo.invalid/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-de-verificacao&hub.challenge=987",
      ),
    );
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("987");
  });
  it("recusa token errado", async () => {
    const r = await GET(
      new Request(
        "https://app.exemplo.invalid/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=987",
      ),
    );
    expect(r.status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp", () => {
  it("sem assinatura, ou com assinatura errada, recusa e não toca o banco", async () => {
    expect((await POST(pedir(carga, null))).status).toBe(401);
    expect((await POST(pedir(carga, "sha256=00"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem o segredo do app configurado, recusa tudo", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    expect((await POST(pedir(carga, assinar(carga)))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("grava cada estado de entrega e a saúde do webhook", async () => {
    const r = await POST(pedir(carga, assinar(carga)));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, gravados: 2 });
    const chamadas = rpc.mock.calls.filter(
      ([n]) => n === "mensagem_registrar_status",
    );
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]?.[1]).toMatchObject({
      p_wa_message_id: "wamid.B",
      p_status: "failed",
      p_codigo_erro: "131047",
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("5511900000001");
    expect(rpc).toHaveBeenCalledWith("saude_registrar_webhook", {
      p_origem: "whatsapp",
      p_ok: true,
    });
  });

  it("carga sem estado de entrega (mensagem recebida) responde ok sem gravar", async () => {
    const corpo = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: "x" }] } }] }],
    });
    const r = await POST(pedir(corpo, assinar(corpo)));
    expect(await r.json()).toEqual({ ok: true, gravados: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("corpo que não é JSON, mesmo assinado, é recusado", async () => {
    const corpo = "não é json";
    expect((await POST(pedir(corpo, assinar(corpo)))).status).toBe(400);
  });

  it("erro de banco responde 500 sem detalhe, para a Meta reenviar", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "mensagem_registrar_status"
        ? { data: null, error: { code: "XX000" } }
        : { data: null, error: null },
    );
    const r = await POST(pedir(carga, assinar(carga)));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false });
    expect(rpc).toHaveBeenCalledWith("saude_registrar_webhook", {
      p_origem: "whatsapp",
      p_ok: false,
    });
  });
});
