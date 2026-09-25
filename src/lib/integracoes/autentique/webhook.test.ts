import { describe, expect, it, vi } from "vitest";
import { buscarDocumento } from "./cliente";
import {
  extrairDocumentoId,
  processarWebhookAutentique,
  segredoConfere,
} from "./webhook";
import type { DocumentoAutentique } from "./tipos";

function documentoConcluido(): DocumentoAutentique {
  return {
    id: "doc-1",
    nome: "Contrato 123",
    criadoEm: "2026-09-25T10:00:00Z",
    signatarios: [],
    concluido: true,
  };
}

function documentoNaoConcluido(): DocumentoAutentique {
  return { ...documentoConcluido(), concluido: false };
}

/** Corpo no formato da API v2: `{ id (do webhook), event: { type, data } }`. */
function corpoFinalizado(documentoId: string, extra: object = {}) {
  return {
    id: "webhook-99",
    object: "webhook",
    event: {
      id: "evento-1",
      type: "document.finished",
      data: { object: "document", id: documentoId, ...extra },
    },
  };
}

describe("processarWebhookAutentique", () => {
  it("segredo errado não muda nada e nem chama a API de reconsulta", async () => {
    const buscarDocumento = vi.fn();
    const marcarContratoAssinado = vi.fn();

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "errado", corpo: corpoFinalizado("doc-1") },
      {
        segredoEsperado: "correto",
        buscarDocumento,
        buscarContratoPorDocumento: vi.fn(),
        marcarContratoAssinado,
      },
    );

    expect(resultado).toEqual({
      status: 404,
      mudouEstado: false,
      motivo: "segredo_invalido",
    });
    expect(buscarDocumento).not.toHaveBeenCalled();
    expect(marcarContratoAssinado).not.toHaveBeenCalled();
  });

  it("webhook forjado (corpo diz concluído, API real diz que não) não muda nada", async () => {
    const marcarContratoAssinado = vi.fn();

    const resultado = await processarWebhookAutentique(
      {
        segredoRecebido: "correto",
        // Corpo forjado tentando parecer concluído; a função nem lê status
        // do corpo, só o id, então isso não importa - o que importa é o
        // mock de buscarDocumento devolvendo não concluído.
        corpo: corpoFinalizado("doc-1", { status: "signed" }),
      },
      {
        segredoEsperado: "correto",
        buscarDocumento: vi.fn().mockResolvedValue(documentoNaoConcluido()),
        buscarContratoPorDocumento: vi
          .fn()
          .mockResolvedValue({ id: "contrato-1", status: "enviado" }),
        marcarContratoAssinado,
      },
    );

    expect(resultado.mudouEstado).toBe(false);
    expect(resultado.motivo).toBe("documento_nao_concluido");
    expect(marcarContratoAssinado).not.toHaveBeenCalled();
  });

  it("documento concluído e contrato ainda não assinado muda o estado uma vez", async () => {
    const marcarContratoAssinado = vi.fn().mockResolvedValue(true);

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: corpoFinalizado("doc-1") },
      {
        segredoEsperado: "correto",
        buscarDocumento: vi.fn().mockResolvedValue(documentoConcluido()),
        buscarContratoPorDocumento: vi
          .fn()
          .mockResolvedValue({ id: "contrato-1", status: "enviado" }),
        marcarContratoAssinado,
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: true,
      motivo: "assinado",
    });
    expect(marcarContratoAssinado).toHaveBeenCalledTimes(1);
    expect(marcarContratoAssinado).toHaveBeenCalledWith(
      "contrato-1",
      documentoConcluido(),
    );
  });

  it("webhook duplicado (contrato já assinado) não muda nada na segunda chamada", async () => {
    const marcarContratoAssinado = vi.fn().mockResolvedValue(true);
    const dependencias = {
      segredoEsperado: "correto",
      buscarDocumento: vi.fn().mockResolvedValue(documentoConcluido()),
      buscarContratoPorDocumento: vi
        .fn()
        .mockResolvedValue({ id: "contrato-1", status: "assinado" }),
      marcarContratoAssinado,
    };

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: corpoFinalizado("doc-1") },
      dependencias,
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "ja_assinado",
    });
    expect(marcarContratoAssinado).not.toHaveBeenCalled();
  });

  it("corpo sem id de documento devolve 400 sem chamar a API", async () => {
    const buscarDocumento = vi.fn();

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: { foo: "bar" } },
      {
        segredoEsperado: "correto",
        buscarDocumento,
        buscarContratoPorDocumento: vi.fn(),
        marcarContratoAssinado: vi.fn(),
      },
    );

    expect(resultado).toEqual({
      status: 400,
      mudouEstado: false,
      motivo: "sem_id_documento",
    });
    expect(buscarDocumento).not.toHaveBeenCalled();
  });

  it("contrato não encontrado pelo id do documento não muda nada", async () => {
    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: corpoFinalizado("doc-x") },
      {
        segredoEsperado: "correto",
        buscarDocumento: vi.fn(),
        buscarContratoPorDocumento: vi.fn().mockResolvedValue(null),
        marcarContratoAssinado: vi.fn(),
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "contrato_nao_encontrado",
    });
  });

  it("dois webhooks ao mesmo tempo: a gravação condicional não muda nada no segundo", async () => {
    // O contrato ainda aparece como enviado na leitura, mas o banco já foi
    // gravado pelo primeiro webhook: a atualização condicional devolve falso.
    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: corpoFinalizado("doc-1") },
      {
        segredoEsperado: "correto",
        buscarDocumento: vi.fn().mockResolvedValue(documentoConcluido()),
        buscarContratoPorDocumento: vi
          .fn()
          .mockResolvedValue({ id: "contrato-1", status: "enviado" }),
        marcarContratoAssinado: vi.fn().mockResolvedValue(false),
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "ja_assinado",
    });
  });

  it("forjado de ponta a ponta: com a reconsulta real e fetch interceptado, documento pendente não muda nada", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          document: {
            id: "doc-1",
            name: "Contrato 123",
            created_at: "2026-09-25T10:00:00Z",
            signatures: [
              {
                public_id: "s1",
                name: "Pessoa 1",
                email: null,
                action: { name: "SIGN" },
                signed: { created_at: "2026-09-26T12:00:00Z" },
                rejected: null,
              },
              {
                public_id: "s2",
                name: "Pessoa 2",
                email: null,
                action: { name: "SIGN" },
                signed: null,
                rejected: null,
              },
            ],
          },
        },
      }),
    } as Response);
    const marcarContratoAssinado = vi.fn();

    const resultado = await processarWebhookAutentique(
      {
        segredoRecebido: "correto",
        corpo: corpoFinalizado("doc-1", { status: "finished" }),
      },
      {
        segredoEsperado: "correto",
        buscarDocumento: (id) => buscarDocumento({ token: "t", fetchImpl }, id),
        buscarContratoPorDocumento: vi
          .fn()
          .mockResolvedValue({ id: "contrato-1", status: "enviado" }),
        marcarContratoAssinado,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(resultado.motivo).toBe("documento_nao_concluido");
    expect(marcarContratoAssinado).not.toHaveBeenCalled();
  });

  it("falha de rede na reconsulta propaga o erro (a rota responde 500) sem gravar", async () => {
    const marcarContratoAssinado = vi.fn();
    await expect(
      processarWebhookAutentique(
        { segredoRecebido: "correto", corpo: corpoFinalizado("doc-1") },
        {
          segredoEsperado: "correto",
          buscarDocumento: vi.fn().mockRejectedValue(new Error("rede")),
          buscarContratoPorDocumento: vi
            .fn()
            .mockResolvedValue({ id: "contrato-1", status: "enviado" }),
          marcarContratoAssinado,
        },
      ),
    ).rejects.toThrow();
    expect(marcarContratoAssinado).not.toHaveBeenCalled();
  });
});

describe("extrairDocumentoId", () => {
  it("lê event.data.id (documento) e nunca o id da raiz (do webhook)", () => {
    expect(extrairDocumentoId(corpoFinalizado("doc-1"))).toBe("doc-1");
    expect(extrairDocumentoId({ id: "webhook-99" })).toBeNull();
  });

  it("em evento de assinatura, lê o documento aninhado", () => {
    expect(
      extrairDocumentoId({
        event: {
          type: "signature.accepted",
          data: { id: "assinatura-1", document: { id: "doc-2" } },
        },
      }),
    ).toBe("doc-2");
  });

  it("corpo vazio, nulo ou sem id devolve nulo", () => {
    expect(extrairDocumentoId(null)).toBeNull();
    expect(extrairDocumentoId("texto")).toBeNull();
    expect(extrairDocumentoId({ event: { data: {} } })).toBeNull();
  });
});

describe("segredoConfere", () => {
  it("só confere com o segredo exato, e segredo esperado vazio nunca confere", () => {
    expect(segredoConfere("abc", "abc")).toBe(true);
    expect(segredoConfere("abcd", "abc")).toBe(false);
    expect(segredoConfere("", "")).toBe(false);
  });
});
