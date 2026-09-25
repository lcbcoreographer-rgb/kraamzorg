import { describe, expect, it } from "vitest";
import {
  AssuntoComDadoPessoalError,
  garantirAssuntoSemDadoPessoal,
  garantirNomeArquivoSemDadoPessoal,
} from "./guarda";

const NOMES = ["Maria da Silva", "Helena Souza"];

describe("garantirAssuntoSemDadoPessoal", () => {
  it("passa quando o assunto não tem dado pessoal", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Evolução de enfermagem", NOMES),
    ).not.toThrow();
    expect(() =>
      garantirAssuntoSemDadoPessoal("Relatório de 24/09/2026", NOMES),
    ).not.toThrow();
  });

  it("recusa o nome completo do paciente", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Evolução de Maria da Silva", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("recusa só o primeiro nome ou só o sobrenome", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Evolução de Maria", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
    expect(() =>
      garantirAssuntoSemDadoPessoal("Bebê Souza, alta", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("compara sem acento e sem caixa", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("evolucao de MARÍA DA SILVA", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("compara por palavra inteira (parte de outra palavra não conta)", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Mariana confirmou a agenda", ["Maria"]),
    ).not.toThrow();
  });

  it("recusa CPF, telefone e e-mail mesmo sem lista de nomes", () => {
    for (const assunto of [
      "Contrato 123.456.789-09",
      "Retorno para +55 43 99999-0000",
      "Dúvida de familia@exemplo.invalid",
    ]) {
      expect(() => garantirAssuntoSemDadoPessoal(assunto, [])).toThrow(
        AssuntoComDadoPessoalError,
      );
    }
  });

  it("a mensagem de erro nunca repete o dado encontrado (vai para log)", () => {
    try {
      garantirAssuntoSemDadoPessoal("Evolução de Maria da Silva", NOMES);
      expect.unreachable();
    } catch (erro) {
      expect((erro as Error).message).not.toMatch(/maria|silva/i);
    }
  });
});

describe("garantirNomeArquivoSemDadoPessoal", () => {
  it("recusa anexo com nome de paciente separado por hífen ou sublinhado", () => {
    expect(() =>
      garantirNomeArquivoSemDadoPessoal("evolucao-maria-silva.pdf", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
    expect(() =>
      garantirNomeArquivoSemDadoPessoal("Helena_Souza.pdf", NOMES),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("aceita anexo nomeado pelo id", () => {
    expect(() =>
      garantirNomeArquivoSemDadoPessoal(
        "evolucao-7f3c2a1e-0b7d-4c55-9a51-2f1d3c4b5a6e.pdf",
        NOMES,
      ),
    ).not.toThrow();
  });
});
