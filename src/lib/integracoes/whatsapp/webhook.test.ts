import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assinaturaValida,
  extrairStatus,
  iguaisEmTempoConstante,
  responderDesafio,
} from "./webhook";

const SEGREDO = "segredo-de-teste-do-app";
const assinar = (corpo: string, segredo = SEGREDO) =>
  `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;

describe("assinaturaValida", () => {
  const corpo = '{"object":"whatsapp_business_account"}';
  it("aceita o HMAC certo do corpo bruto", () => {
    expect(assinaturaValida(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });
  it("recusa corpo alterado, segredo errado, cabeçalho ausente e segredo ausente", () => {
    expect(assinaturaValida(corpo + " ", assinar(corpo), SEGREDO)).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo, "outro"), SEGREDO)).toBe(
      false,
    );
    expect(assinaturaValida(corpo, null, SEGREDO)).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo), undefined)).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo), "")).toBe(false);
  });
  it("recusa assinatura com tamanho diferente sem lançar", () => {
    expect(assinaturaValida(corpo, "sha256=abc", SEGREDO)).toBe(false);
  });
});

describe("responderDesafio", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("devolve o desafio quando o token confere", () => {
    expect(
      responderDesafio(
        p("hub.mode=subscribe&hub.verify_token=tok&hub.challenge=123"),
        "tok",
      ),
    ).toBe("123");
  });
  it("recusa token errado, modo errado, campo faltando e token não configurado", () => {
    expect(
      responderDesafio(
        p("hub.mode=subscribe&hub.verify_token=x&hub.challenge=1"),
        "tok",
      ),
    ).toBeNull();
    expect(
      responderDesafio(
        p("hub.mode=outro&hub.verify_token=tok&hub.challenge=1"),
        "tok",
      ),
    ).toBeNull();
    expect(
      responderDesafio(p("hub.mode=subscribe&hub.verify_token=tok"), "tok"),
    ).toBeNull();
    expect(
      responderDesafio(
        p("hub.mode=subscribe&hub.verify_token=tok&hub.challenge=1"),
        undefined,
      ),
    ).toBeNull();
  });
});

describe("extrairStatus", () => {
  const carga = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
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
                  recipient_id: "5511900000002",
                  errors: [
                    {
                      code: 131047,
                      title: "Re-engagement message",
                      message: "texto com dado",
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it("tira id, estado, hora e só o número do erro", () => {
    const r = extrairStatus(carga);
    expect(r).toEqual([
      {
        waMessageId: "wamid.A",
        status: "delivered",
        ocorridoEm: new Date(1790000000 * 1000).toISOString(),
        codigoErro: null,
      },
      {
        waMessageId: "wamid.B",
        status: "failed",
        ocorridoEm: new Date(1790000100 * 1000).toISOString(),
        codigoErro: "131047",
      },
    ]);
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("5511900000001");
    expect(texto).not.toContain("texto com dado");
  });

  it("carga de mensagem recebida ou formato estranho dá lista vazia", () => {
    expect(
      extrairStatus({
        entry: [{ changes: [{ value: { messages: [{ id: "x" }] } }] }],
      }),
    ).toEqual([]);
    expect(extrairStatus(null)).toEqual([]);
    expect(extrairStatus("texto")).toEqual([]);
    expect(extrairStatus({ entry: "x" })).toEqual([]);
    expect(
      extrairStatus({
        entry: [{ changes: [{ value: { statuses: [{ status: "sent" }] } }] }],
      }),
    ).toEqual([]);
  });
});

it("iguaisEmTempoConstante compara sem depender do tamanho", () => {
  expect(iguaisEmTempoConstante("a", "a")).toBe(true);
  expect(iguaisEmTempoConstante("a", "aa")).toBe(false);
});
