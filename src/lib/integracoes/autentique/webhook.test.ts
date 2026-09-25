import { describe, expect, it, vi } from "vitest";
import { processarWebhookAutentique } from "./webhook";
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

describe("processarWebhookAutentique", () => {
  it("segredo errado não muda nada e nem chama a API de reconsulta", async () => {
    const buscarDocumento = vi.fn();
    const marcarContratoAssinado = vi.fn();

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "errado", corpo: { document: { id: "doc-1" } } },
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
        corpo: { document: { id: "doc-1", status: "signed" } },
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
    const marcarContratoAssinado = vi.fn().mockResolvedValue(undefined);

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: { document: { id: "doc-1" } } },
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
    const marcarContratoAssinado = vi.fn().mockResolvedValue(undefined);
    const dependencias = {
      segredoEsperado: "correto",
      buscarDocumento: vi.fn().mockResolvedValue(documentoConcluido()),
      buscarContratoPorDocumento: vi
        .fn()
        .mockResolvedValue({ id: "contrato-1", status: "assinado" }),
      marcarContratoAssinado,
    };

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: "correto", corpo: { document: { id: "doc-1" } } },
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
      { segredoRecebido: "correto", corpo: { document: { id: "doc-x" } } },
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
});
