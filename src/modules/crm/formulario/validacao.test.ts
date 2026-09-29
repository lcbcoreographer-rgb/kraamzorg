import { describe, expect, it } from "vitest";
import { dividirPrimeiraFrase } from "./frases";
import { ERROS } from "./textos";
import {
  cpfValido,
  dataIso,
  erroCpf,
  erroDataNascimento,
  erroEmail,
  erroNomeCompleto,
  errosDoServidor,
  etapaDoCampo,
  etapasDoFormulario,
  formatarCep,
  formatarCpf,
  formatarData,
  montarDados,
  validarEtapa,
  validarTudo,
  type Valores,
} from "./validacao";

const HOJE = "2026-09-29";

function valoresCompletos(): Valores {
  return {
    "gestante.nomeCompleto": "Juliana  Teste Gruta",
    "gestante.cpf": "111.444.777-35",
    "gestante.dataNascimento": "17/05/1994",
    "gestante.email": "juliana.teste@exemplo.invalid",
    "gestante.cep": "01310-100",
    "gestante.logradouro": "Rua de Teste",
    "gestante.numero": "100",
    "gestante.bairro": "Bairro de Teste",
    "gestante.cidade": "São Paulo",
    "gestante.uf": "sp",
    atendimentoMesmoEndereco: "sim",
    consentimento: "sim",
  };
}

describe("máscaras enquanto digita", () => {
  it("CPF, CEP e data", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35");
    expect(formatarCpf("1114")).toBe("111.4");
    expect(formatarCpf("111.444.777-3599")).toBe("111.444.777-35");
    expect(formatarCep("01310100")).toBe("01310-100");
    expect(formatarData("17051994")).toBe("17/05/1994");
  });
});

describe("erros que dizem o que fazer", () => {
  it("CPF: conta os números e confere os dígitos", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(erroCpf("111.444.777-3")).toBe(ERROS.cpfCurto(10));
    expect(erroCpf("111.444.777-00")).toBe(ERROS.cpfDigito);
    expect(erroCpf("")).toBe(ERROS.obrigatorio);
    // A frase nunca repete o número digitado.
    expect(erroCpf("111.444.777-00")).not.toMatch(/\d{3}/);
  });

  it("nome completo, e-mail e data", () => {
    expect(erroNomeCompleto("Juliana")).toBe(ERROS.nomeCompleto);
    expect(erroNomeCompleto("Juliana D'Ávila-Souza")).toBeNull();
    expect(erroEmail("juliana@exemplo")).toBe(ERROS.email);
    expect(dataIso("31/02/1994")).toBeNull();
    expect(erroDataNascimento("31/02/1994", HOJE)).toBe(ERROS.dataFormato);
    expect(erroDataNascimento("01/01/2030", HOJE)).toBe(ERROS.dataFutura);
    expect(erroDataNascimento("17/05/1994", HOJE)).toBeNull();
  });

  it("nenhum texto de erro tem travessão, exclamação ou 'inválido' sozinho", () => {
    for (const valor of Object.values(ERROS)) {
      const texto = typeof valor === "function" ? valor(10) : valor;
      expect(texto).not.toMatch(/[\u2014\u2013!]/);
      expect(texto).not.toMatch(/^inválido/i);
    }
  });
});

describe("etapas", () => {
  it("três etapas, ou quatro quando o contrato tem quem paga", () => {
    expect(etapasDoFormulario(false)).toEqual(["voce", "endereco", "final"]);
    expect(etapasDoFormulario(true)).toEqual([
      "voce",
      "endereco",
      "pagador",
      "final",
    ]);
  });

  it("endereço de atendimento só é pedido quando não é o mesmo", () => {
    const valores = { ...valoresCompletos(), atendimentoMesmoEndereco: "nao" };
    const erros = validarEtapa("endereco", valores, {
      pedePagador: false,
      hoje: HOJE,
    });
    expect(Object.keys(erros)).toContain("atendimento.cep");
    expect(
      validarEtapa("endereco", valoresCompletos(), {
        pedePagador: false,
        hoje: HOJE,
      }),
    ).toEqual({});
  });

  it("pagador não pode ter o CPF da gestante", () => {
    const valores = {
      ...valoresCompletos(),
      "pagador.nomeCompleto": "Rafael Teste",
      "pagador.cpf": "111.444.777-35",
      "pagador.email": "rafael@exemplo.invalid",
      "pagador.cep": "01310-100",
      "pagador.logradouro": "Rua",
      "pagador.numero": "1",
      "pagador.bairro": "Centro",
      "pagador.cidade": "São Paulo",
      "pagador.uf": "SP",
    };
    expect(
      validarEtapa("pagador", valores, { pedePagador: true, hoje: HOJE })[
        "pagador.cpf"
      ],
    ).toBe(ERROS.cpfIgualGestante);
  });

  it("testemunha é opcional, mas com nome pede o e-mail", () => {
    const valores = {
      ...valoresCompletos(),
      "testemunha.nomeCompleto": "Diego Teste Gruta",
    };
    expect(
      validarEtapa("final", valores, { pedePagador: false, hoje: HOJE })[
        "testemunha.email"
      ],
    ).toBe(ERROS.testemunhaEmail);
  });

  it("validarTudo aponta a primeira etapa com erro", () => {
    const valores = { ...valoresCompletos(), consentimento: "" };
    expect(
      validarTudo(valores, { pedePagador: false, hoje: HOJE }).primeiraEtapa,
    ).toBe("final");
    expect(
      validarTudo(valoresCompletos(), { pedePagador: false, hoje: HOJE })
        .primeiraEtapa,
    ).toBeNull();
  });
});

describe("montarDados", () => {
  it("só dígitos no CPF e no CEP, data ISO, UF em maiúscula e a versão do termo", () => {
    const dados = montarDados(valoresCompletos(), {
      pedePagador: false,
      hoje: HOJE,
      termoVersao: "1-rascunho",
    });
    expect(dados.gestante.nomeCompleto).toBe("Juliana Teste Gruta");
    expect(dados.gestante.cpf).toBe("11144477735");
    expect(dados.gestante.dataNascimento).toBe("1994-05-17");
    expect(dados.gestante.endereco.cep).toBe("01310100");
    expect(dados.gestante.endereco.uf).toBe("SP");
    expect(dados.enderecoAtendimento).toBeNull();
    expect(dados.pagador).toBeNull();
    expect(dados.consentimento).toEqual({ aceito: true, versao: "1-rascunho" });
  });
});

describe("erros do banco voltam para o campo certo", () => {
  it("código do banco vira frase e etapa", () => {
    const erros = errosDoServidor({
      "gestante.cpf": "invalido",
      "pagador.cpf": "igual_gestante",
      endereco_atendimento: "invalido",
    });
    expect(erros).toEqual({
      "gestante.cpf": ERROS.cpfDigito,
      "pagador.cpf": ERROS.cpfIgualGestante,
      "atendimento.cep": ERROS.cep,
    });
    expect(etapaDoCampo("gestante.cpf")).toBe("voce");
    expect(etapaDoCampo("atendimento.cep")).toBe("endereco");
    expect(etapaDoCampo("gestante.cep")).toBe("endereco");
    expect(etapaDoCampo("pagador.cpf")).toBe("pagador");
    expect(etapaDoCampo("consentimento")).toBe("final");
  });
});

describe("dividirPrimeiraFrase", () => {
  it("separa a saudação do resto sem mudar nenhuma palavra", () => {
    const texto =
      "Oi, Juliana. O Leonardo pediu estes dados para preparar o contrato de vocês. Leva uns 3 minutos.";
    const { primeira, resto } = dividirPrimeiraFrase(texto);
    expect(primeira).toBe("Oi, Juliana.");
    expect(`${primeira} ${resto}`).toBe(texto);
    expect(dividirPrimeiraFrase("Sem ponto")).toEqual({
      primeira: "Sem ponto",
      resto: "",
    });
    expect(dividirPrimeiraFrase("Valor de R$ 4.200 hoje.").resto).toBe("");
  });
});
