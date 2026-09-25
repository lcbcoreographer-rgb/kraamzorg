import { describe, expect, it } from "vitest";
import {
  AssuntoComDadoPessoalError,
  garantirAssuntoSemDadoPessoal,
} from "./guarda";

describe("garantirAssuntoSemDadoPessoal", () => {
  it("passa quando o assunto não contém nenhum termo proibido", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal(
        "Evolução de enfermagem · Kraamzorg Brasil",
        ["Maria da Silva", "Bebê Maria"],
      ),
    ).not.toThrow();
  });

  it("recusa quando o assunto contém o nome do paciente", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Evolução de Maria da Silva", [
        "Maria da Silva",
      ]),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("compara sem acento e sem caixa", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("evolucao de MARIA DA SILVA", [
        "María da Silva",
      ]),
    ).toThrow(AssuntoComDadoPessoalError);
  });

  it("sem lista de termos proibidos, não recusa nada", () => {
    expect(() =>
      garantirAssuntoSemDadoPessoal("Qualquer assunto"),
    ).not.toThrow();
  });
});
