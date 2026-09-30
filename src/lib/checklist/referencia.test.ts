import { describe, expect, it } from "vitest";
import {
  DEFINICAO_DOC2,
  dadosDeExemplo,
} from "@/lib/dados/demonstracao/assistencial-fixtures";
import type { RegistroAnterior } from "@/lib/dados/tipos-assistencial";
import {
  acharCampo,
  comValor,
  estaRespondido,
  lerValor,
  pendenciasParaConcluir,
  respostasVazias,
  type EnderecoCampo,
} from "@/lib/instrumentos/respostas";
import {
  confirmarTextoTrazido,
  descartarTextoTrazido,
  ehCampoDeTextoRepetivel,
  referenciaDoDiaAnterior,
  referenciaNumerica,
  textosAguardandoConfirmacao,
  trazerTexto,
} from "./referencia";

const BEBE = "00000000-0000-4000-8000-0000000000b1";

function anterior(
  dia: number,
  temperatura: number,
  extra: object = {},
): RegistroAnterior {
  return {
    visitaId: `v-${dia}`,
    diaNumero: dia,
    data: `2026-09-${20 + dia}`,
    dados: dadosDeExemplo(
      {
        data: `2026-09-${20 + dia}`,
        temperatura,
        pesoBebe: 3000 + dia * 10,
        ...extra,
      },
      [BEBE],
    ),
    resumoDescritivo: null,
  };
}

const ANTERIORES = [
  anterior(1, 36.7, { medicacoes: "Dipirona 1 g, se dor" }),
  anterior(2, 36.8),
  anterior(3, 36.9, {
    medicacoes: "Paracetamol 750 mg, se dor",
    quemApoia: "Parceiro e avó",
  }),
];

const TEMPERATURA: EnderecoCampo = { bloco: "2.1", campo: "temperatura" };
const MEDICACOES: EnderecoCampo = { bloco: "2.3", campo: "medicacoes_em_uso" };
const QUEM_APOIA: EnderecoCampo = { bloco: "2.13", campo: "quem_mais_apoia" };
const campoDe = (e: EnderecoCampo) =>
  acharCampo(DEFINICAO_DOC2, `${e.bloco}.${e.campo}`)?.campo;

describe("valor numérico do dia anterior: só referência, nunca preenchido (P39 item 1)", () => {
  it("acha o valor do dia mais recente e formata com a unidade", () => {
    const ref = referenciaDoDiaAnterior(ANTERIORES, TEMPERATURA);
    expect(ref).toMatchObject({ diaNumero: 3, valor: 36.9 });
    expect(referenciaNumerica(campoDe(TEMPERATURA)!, ref!.valor)).toBe(
      "36,9 °C",
    );
  });

  it("pressão arterial em partes vira 118/76 mmHg", () => {
    const ref = referenciaDoDiaAnterior(ANTERIORES, {
      bloco: "2.1",
      campo: "pressao_arterial",
    });
    expect(
      referenciaNumerica(
        campoDe({ bloco: "2.1", campo: "pressao_arterial" })!,
        ref!.valor,
      ),
    ).toBe("118/76 mmHg");
  });

  it("valor do bebê é do bebê certo", () => {
    const ref = referenciaDoDiaAnterior(ANTERIORES, {
      bloco: "3.1",
      campo: "peso",
      bebe: BEBE,
    });
    expect(ref).toMatchObject({ diaNumero: 3, valor: 3030 });
    expect(
      referenciaDoDiaAnterior(ANTERIORES, {
        bloco: "3.1",
        campo: "peso",
        bebe: "outro",
      }),
    ).toBeNull();
  });

  it("consultar a referência não preenche nada: o campo continua sem resposta e pendente", () => {
    const respostas = respostasVazias();
    referenciaDoDiaAnterior(ANTERIORES, TEMPERATURA);
    expect(lerValor(respostas, TEMPERATURA)).toBeUndefined();
    const pendencias = pendenciasParaConcluir(DEFINICAO_DOC2, respostas, {
      bebes: [{ id: BEBE, rotulo: "Bebê" }],
    });
    expect(
      pendencias.some((p) => p.bloco === "2.1" && p.campo === "temperatura"),
    ).toBe(true);
  });

  it("sem dia anterior com o campo, não há referência", () => {
    expect(referenciaDoDiaAnterior([], TEMPERATURA)).toBeNull();
    expect(
      referenciaDoDiaAnterior(ANTERIORES, {
        bloco: "2.1",
        campo: "inexistente",
      }),
    ).toBeNull();
  });

  it("texto em branco no dia anterior não vira referência", () => {
    const vazio: RegistroAnterior = {
      ...anterior(4, 36.6),
      dados: { "2.3": { medicacoes_em_uso: "   " } },
    };
    expect(referenciaDoDiaAnterior([vazio], MEDICACOES)).toBeNull();
  });
});

describe("texto do dia anterior: só com confirmação campo a campo", () => {
  it("só campo de texto livre oferece 'Trazer o texto'", () => {
    expect(ehCampoDeTextoRepetivel(campoDe(MEDICACOES)!)).toBe(true);
    expect(ehCampoDeTextoRepetivel(campoDe(QUEM_APOIA)!)).toBe(true);
    expect(ehCampoDeTextoRepetivel(campoDe(TEMPERATURA)!)).toBe(false);
  });

  it("texto trazido sem confirmação não conta como respondido nem entra nas respostas", () => {
    const ref = referenciaDoDiaAnterior(ANTERIORES, QUEM_APOIA)!;
    const trazidos = trazerTexto({}, QUEM_APOIA, ref);
    const respostas = respostasVazias();

    expect(trazidos["2.13|quem_mais_apoia|"]).toEqual({
      texto: "Parceiro e avó",
      deDia: 3,
    });
    // A resposta de hoje continua vazia: não conta como respondido e não é assinado.
    expect(lerValor(respostas, QUEM_APOIA)).toBeUndefined();
    expect(
      estaRespondido(campoDe(QUEM_APOIA)!, lerValor(respostas, QUEM_APOIA)),
    ).toBe(false);
    const pendencias = pendenciasParaConcluir(DEFINICAO_DOC2, respostas, {
      bebes: [{ id: BEBE, rotulo: "Bebê" }],
    });
    expect(pendencias.some((p) => p.campo === "quem_mais_apoia")).toBe(true);
    expect(textosAguardandoConfirmacao(trazidos, respostas, campoDe)).toEqual([
      QUEM_APOIA,
    ]);
  });

  it("'Vale para hoje' confirma e só então o campo conta como respondido", () => {
    const ref = referenciaDoDiaAnterior(ANTERIORES, QUEM_APOIA)!;
    const trazidos = trazerTexto({}, QUEM_APOIA, ref);
    const { respostas, trazidos: restantes } = confirmarTextoTrazido(
      respostasVazias(),
      trazidos,
      QUEM_APOIA,
    );
    expect(lerValor(respostas, QUEM_APOIA)).toBe("Parceiro e avó");
    expect(restantes).toEqual({});
    expect(textosAguardandoConfirmacao(restantes, respostas, campoDe)).toEqual(
      [],
    );
  });

  it("confirmar depois de editar grava o texto editado, não o do dia anterior", () => {
    const trazidos = trazerTexto(
      {},
      MEDICACOES,
      referenciaDoDiaAnterior(ANTERIORES, MEDICACOES)!,
    );
    const { respostas } = confirmarTextoTrazido(
      respostasVazias(),
      trazidos,
      MEDICACOES,
      "Paracetamol 500 mg",
    );
    expect(lerValor(respostas, MEDICACOES)).toBe("Paracetamol 500 mg");
  });

  it("'Apagar e escrever' descarta o texto trazido sem tocar nas respostas", () => {
    const trazidos = trazerTexto(
      {},
      MEDICACOES,
      referenciaDoDiaAnterior(ANTERIORES, MEDICACOES)!,
    );
    expect(descartarTextoTrazido(trazidos, MEDICACOES)).toEqual({});
  });

  it("não existe 'trazer tudo': cada campo é trazido e confirmado sozinho", () => {
    let trazidos = trazerTexto(
      {},
      MEDICACOES,
      referenciaDoDiaAnterior(ANTERIORES, MEDICACOES)!,
    );
    trazidos = trazerTexto(
      trazidos,
      QUEM_APOIA,
      referenciaDoDiaAnterior(ANTERIORES, QUEM_APOIA)!,
    );
    const confirmada = confirmarTextoTrazido(
      respostasVazias(),
      trazidos,
      MEDICACOES,
    );
    expect(lerValor(confirmada.respostas, MEDICACOES)).toBe(
      "Paracetamol 750 mg, se dor",
    );
    expect(lerValor(confirmada.respostas, QUEM_APOIA)).toBeUndefined();
    expect(Object.keys(confirmada.trazidos)).toEqual(["2.13|quem_mais_apoia|"]);
  });

  it("texto trazido de referência vazia não vira nada", () => {
    const trazidos = trazerTexto({}, MEDICACOES, {
      diaNumero: 2,
      data: "2026-09-22",
      valor: "  ",
    });
    expect(trazidos).toEqual({});
  });

  it("se a enfermeira escreveu outra coisa no campo, o texto trazido deixa de esperar confirmação", () => {
    const trazidos = trazerTexto(
      {},
      MEDICACOES,
      referenciaDoDiaAnterior(ANTERIORES, MEDICACOES)!,
    );
    const respostas = comValor(respostasVazias(), MEDICACOES, "Outro texto");
    expect(textosAguardandoConfirmacao(trazidos, respostas, campoDe)).toEqual(
      [],
    );
  });
});
