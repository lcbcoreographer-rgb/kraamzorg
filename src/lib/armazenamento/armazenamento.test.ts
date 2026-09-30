// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  caminhoComprovante,
  caminhoContrato,
  caminhoEvolucao,
  caminhoNota,
  caminhoValido,
  codigoAleatorio,
  ehComprovante,
  tipoDoArquivo,
  tipoDoArquivoNota,
} from "./caminhos";
import {
  criarArmazenamentoMemoria,
  reiniciarArmazenamentoMemoria,
} from "./memoria";

const ID = "b1900000-0000-4000-8000-000000000001";

describe("caminhos do armazenamento privado", () => {
  it("só aceita os dois formatos, montados a partir de ids", () => {
    expect(caminhoValido(caminhoContrato(ID, false))).toBe(true);
    expect(caminhoValido(caminhoContrato(ID, true))).toBe(true);
    expect(
      caminhoValido(caminhoComprovante(ID, "png", codigoAleatorio())),
    ).toBe(true);
    expect(ehComprovante(caminhoComprovante(ID, "pdf", "abcdefgh12"))).toBe(
      true,
    );
    for (const ruim of [
      "contratos/Marina-Teste.pdf",
      `contratos/${ID}.docx`,
      `contratos/${ID}/../outro.pdf`,
      `comprovantes/${ID}.png`,
      `comprovantes/${ID}-curto.png`,
      `comprovantes/${ID}-ABCDEFGH12.png`,
      `/contratos/${ID}.pdf`,
      "",
    ]) {
      expect(caminhoValido(ruim), ruim).toBe(false);
    }
  });

  it("aceita os caminhos da evolução e da nota, sempre por id", () => {
    expect(caminhoEvolucao(ID)).toBe(`evolucoes/${ID}.pdf`);
    expect(caminhoNota(ID, "xml")).toBe(`notas/${ID}.xml`);
    for (const bom of [
      caminhoEvolucao(ID),
      caminhoNota(ID, "pdf"),
      caminhoNota(ID, "xml"),
    ]) {
      expect(caminhoValido(bom), bom).toBe(true);
    }
    for (const ruim of [
      "evolucoes/Marina-Teste.pdf",
      `evolucoes/${ID}.png`,
      `evolucoes/${ID}-maria.pdf`,
      `notas/${ID}.docx`,
      `notas/nota-da-maria.pdf`,
      `notas/${ID}/../x.xml`,
    ]) {
      expect(caminhoValido(ruim), ruim).toBe(false);
    }
  });

  it("reconhece PDF e XML da nota pelo conteúdo", () => {
    const enc = new TextEncoder();
    expect(tipoDoArquivoNota(enc.encode("%PDF-1.7 x"))?.extensao).toBe("pdf");
    expect(
      tipoDoArquivoNota(enc.encode('<?xml version="1.0"?><nfse/>'))?.extensao,
    ).toBe("xml");
    expect(tipoDoArquivoNota(enc.encode("<NFSe><a/></NFSe>"))?.extensao).toBe(
      "xml",
    );
    expect(
      tipoDoArquivoNota(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]),
      ),
    ).toBeNull();
    expect(tipoDoArquivoNota(enc.encode("texto solto"))).toBeNull();
  });

  it("o código aleatório tem 16 caracteres [a-z0-9] e não repete", () => {
    const a = codigoAleatorio();
    expect(a).toMatch(/^[a-z0-9]{16}$/);
    expect(codigoAleatorio()).not.toBe(a);
  });

  it("reconhece PDF, PNG e JPEG pelos primeiros bytes, não pela extensão", () => {
    expect(
      tipoDoArquivo(new TextEncoder().encode("%PDF-1.7 x"))?.extensao,
    ).toBe("pdf");
    expect(
      tipoDoArquivo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]))
        ?.extensao,
    ).toBe("png");
    expect(
      tipoDoArquivo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.contentType,
    ).toBe("image/jpeg");
    expect(tipoDoArquivo(new TextEncoder().encode("<html>"))).toBeNull();
    expect(tipoDoArquivo(new Uint8Array([]))).toBeNull();
  });
});

describe("armazenamento em memória (demonstração)", () => {
  const original = {
    KZ_DADOS: process.env.KZ_DADOS,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  };
  beforeEach(() => {
    process.env.KZ_DADOS = "demonstracao";
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    reiniciarArmazenamentoMemoria();
  });
  afterEach(() => {
    process.env.KZ_DADOS = original.KZ_DADOS;
    process.env.NEXT_PUBLIC_APP_ENV = original.NEXT_PUBLIC_APP_ENV;
  });

  it("grava, lê e abre; o contrato pode ser regravado, o comprovante não", async () => {
    const a = criarArmazenamentoMemoria();
    const caminho = caminhoContrato(ID, false);
    await a.salvar(caminho, new Uint8Array([1, 2, 3]), "application/pdf", true);
    await a.salvar(caminho, new Uint8Array([4, 5]), "application/pdf", true);
    expect(Array.from((await a.ler(caminho))!)).toEqual([4, 5]);
    const aberto = await a.abrir(caminho, 60);
    expect(aberto).toMatchObject({
      tipo: "bytes",
      contentType: "application/pdf",
    });

    const comprovante = caminhoComprovante(ID, "png", "abcdefgh12");
    await a.salvar(comprovante, new Uint8Array([1]), "image/png", false);
    await expect(
      a.salvar(comprovante, new Uint8Array([2]), "image/png", false),
    ).rejects.toThrow(/já existe/);
  });

  it("recusa caminho fora do padrão e devolve nulo para o que não existe", async () => {
    const a = criarArmazenamentoMemoria();
    await expect(
      a.salvar(
        "contratos/Marina.pdf",
        new Uint8Array([1]),
        "application/pdf",
        true,
      ),
    ).rejects.toThrow(/fora do padrão/);
    expect(await a.ler(caminhoContrato(ID, true))).toBeNull();
    expect(await a.abrir("contratos/Marina.pdf", 60)).toBeNull();
  });

  it("fora da demonstração o armazenamento em memória não abre", async () => {
    process.env.KZ_DADOS = "";
    await expect(
      criarArmazenamentoMemoria().ler(caminhoContrato(ID, false)),
    ).rejects.toThrow();
  });
});
