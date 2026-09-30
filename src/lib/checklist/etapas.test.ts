import { describe, expect, it } from "vitest";
import {
  DEFINICAO_DOC2,
  dadosDeExemplo,
  regrasDoDoc3,
} from "@/lib/dados/demonstracao/assistencial-fixtures";
import { comValor, respostasVazias } from "@/lib/instrumentos/respostas";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import {
  acionamentoCompleto,
  bebesDoFormulario,
  dadosParaRespostas,
  pendenciasDoRegistro,
} from "./registro";
import {
  camposFaltandoDoAcionamento,
  caminhosDoInstrumento,
  linkDeLigacao,
  sinaisDoSeletor,
  tituloDoAchado,
  varianteDaFaixa,
} from "./alertas";
import { estadoDaEtapa, montarEtapas } from "./etapas";
import {
  dataCurta,
  diaEMes,
  formatarComUnidade,
  valorLegivel,
} from "./formato";

const BEBE = "00000000-0000-4000-8000-0000000000b1";

describe("as oito etapas do checklist (fluxo A)", () => {
  it("são oito, na ordem da visita, com o resumo por último", () => {
    const etapas = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: false,
    });
    expect(etapas.map((e) => e.id)).toEqual([
      "chegada",
      "puerpera",
      "sinais_vitais",
      "mamas",
      "bebe",
      "orientacoes",
      "emocional",
      "resumo",
    ]);
  });

  it("agrupam os blocos do DOC 2 sem perder nenhum", () => {
    const etapas = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: true,
    });
    const nasEtapas = etapas
      .flatMap((e) => e.blocosDaDefinicao.map((b) => b.id))
      .sort();
    expect(nasEtapas).toEqual(DEFINICAO_DOC2.blocos.map((b) => b.id).sort());
  });

  it("o bloco do último dia só aparece no último dia, dentro do resumo e assinatura", () => {
    const comum = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: false,
    });
    const ultimo = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: true,
    });
    const blocos = (e: typeof comum) =>
      e.find((x) => x.id === "resumo")!.blocosDaDefinicao.map((b) => b.id);
    expect(blocos(comum)).toEqual(["resumo", "assinatura"]);
    expect(blocos(ultimo)).toEqual(["ultimo_dia", "resumo", "assinatura"]);
  });

  it("a etapa do bebê é por bebê", () => {
    const etapas = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: false,
    });
    expect(etapas.find((e) => e.id === "bebe")?.porBebe).toBe(true);
    expect(etapas.find((e) => e.id === "chegada")?.porBebe).toBeUndefined();
  });

  it("bloco de versão futura que o mapa não conhece ganha etapa própria antes do resumo", () => {
    const definicao: DefinicaoInstrumento = {
      ...DEFINICAO_DOC2,
      blocos: [
        ...DEFINICAO_DOC2.blocos,
        {
          id: "10",
          titulo: "Bloco novo",
          campos: [{ id: "novo", tipo: "sim_nao", rotulo: "Novo" }],
        },
      ],
    };
    const etapas = montarEtapas(definicao, respostasVazias(), {
      ultimo_dia: false,
    });
    expect(etapas.at(-1)?.id).toBe("resumo");
    expect(etapas.at(-2)).toMatchObject({
      id: "bloco_10",
      rotulo: "Bloco novo",
    });
  });

  it("estado da etapa: não iniciada, com pendência, completa e com alerta", () => {
    const bebes = bebesDoFormulario([
      {
        id: BEBE,
        ordem: 1,
        nome: null,
        dataNascimento: null,
        pesoNascimentoG: null,
        pesoAltaG: null,
      },
    ]);
    const etapas = montarEtapas(DEFINICAO_DOC2, respostasVazias(), {
      ultimo_dia: false,
    });
    const sinais = etapas.find((e) => e.id === "sinais_vitais")!;
    const vazio = respostasVazias();
    const pend = (r: typeof vazio) =>
      pendenciasDoRegistro({
        definicao: DEFINICAO_DOC2,
        respostas: r,
        bebes,
        ultimoDia: false,
      });
    const estado = (r: typeof vazio, alerta = new Set<string>()) =>
      estadoDaEtapa({
        etapa: sinais,
        respostas: r,
        bebes,
        pendencias: pend(r),
        blocosComAlerta: alerta,
      });

    expect(estado(vazio)).toBe("nao_iniciada");
    const parcial = comValor(
      vazio,
      { bloco: "2.1", campo: "temperatura" },
      36.6,
    );
    expect(estado(parcial)).toBe("com_pendencia");
    const completo = dadosParaRespostas(
      DEFINICAO_DOC2,
      dadosDeExemplo(
        { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
        [BEBE],
      ),
    );
    expect(estado(completo)).toBe("completa");
    expect(estado(completo, new Set(["2.1"]))).toBe("com_alerta");
  });
});

describe("apoio dos alertas (P40)", () => {
  it("o seletor lista os sinais sem campo no DOC 2 a partir de regra_alerta, imediatos primeiro", () => {
    const sinais = sinaisDoSeletor(regrasDoDoc3(), DEFINICAO_DOC2);
    const codigos = sinais.map((s) => s.regraId);
    expect(codigos).toEqual(
      expect.arrayContaining([
        "PU-05",
        "PU-06",
        "RN-05",
        "RN-06",
        "RN-04",
        "RN-07",
        "SM-01",
      ]),
    );
    // Regra com campo que existe no DOC 2 avalia sozinha e não entra no seletor.
    expect(codigos).not.toContain("PU-01");
    expect(codigos).not.toContain("RN-08");
    // Imediatos antes dos prioritários.
    const primeiroPrioritario = sinais.findIndex(
      (s) => s.severidade === "prioritario",
    );
    const ultimoImediato = sinais
      .map((s) => s.severidade)
      .lastIndexOf("imediato");
    expect(ultimoImediato).toBeLessThan(primeiroPrioritario);
  });

  it("caminhosDoInstrumento traz bloco.campo, inclusive o cabeçalho", () => {
    const caminhos = caminhosDoInstrumento(DEFINICAO_DOC2);
    expect(caminhos.has("2.1.temperatura")).toBe(true);
    expect(caminhos.has("cabecalho.paciente")).toBe(true);
    expect(caminhos.has("2.dor")).toBe(false);
  });

  it("família em luto ou intercorrência nunca leva o vermelho do alerta", () => {
    expect(varianteDaFaixa("imediato", false)).toBe("imediato");
    expect(varianteDaFaixa("prioritario", false)).toBe("prioritario");
    expect(varianteDaFaixa("imediato", true)).toBe("sensivel");
    expect(varianteDaFaixa("prioritario", true)).toBe("sensivel");
  });

  it("o achado leva o valor registrado", () => {
    expect(tituloDoAchado("Febre ≥ 38 °C", "38,2 °C")).toBe(
      "Febre ≥ 38 °C. Registrado: 38,2 °C",
    );
    expect(tituloDoAchado("Convulsão", null)).toBe("Convulsão");
  });

  it("aponta o que falta dos quatro campos do DOC 3", () => {
    expect(camposFaltandoDoAcionamento(undefined)).toEqual([
      "sinalIdentificado",
      "acionadoEm",
      "orientacaoMedica",
      "condutaAdotada",
    ]);
    expect(
      camposFaltandoDoAcionamento({
        sinalIdentificado: "Febre",
        acionadoEm: "ontem à tarde",
        orientacaoMedica: "Observar",
        condutaAdotada: "Antitérmico",
      }),
    ).toEqual(["acionadoEm"]);
    const completo = {
      regraId: "PU-01",
      bebeId: null,
      sinalIdentificado: "Febre",
      acionadoEm: "2026-09-29T12:40:00-03:00",
      orientacaoMedica: "Observar",
      condutaAdotada: "Antitérmico",
    };
    expect(camposFaltandoDoAcionamento(completo)).toEqual([]);
    expect(acionamentoCompleto(completo)).toBe(true);
    expect(acionamentoCompleto({ ...completo, orientacaoMedica: " " })).toBe(
      false,
    );
    expect(acionamentoCompleto(undefined)).toBe(false);
  });

  it("link de ligação só com telefone em E.164", () => {
    expect(linkDeLigacao("+5511900000099")).toBe("tel:+5511900000099");
    expect(linkDeLigacao("")).toBeNull();
    expect(linkDeLigacao("11 90000-0099")).toBeNull();
  });
});

describe("formatação brasileira", () => {
  it("números, unidades e datas", () => {
    expect(formatarComUnidade(36.9, "°C", 1)).toBe("36,9 °C");
    expect(formatarComUnidade(3240, "g")).toBe("3.240 g");
    expect(dataCurta("2026-09-29")).toBe("29/09/2026");
    expect(diaEMes("2026-09-29")).toBe("29/09");
  });

  it("valorLegivel de resposta, pressão e texto", () => {
    expect(valorLegivel(undefined, true)).toBe("Sim");
    expect(valorLegivel(undefined, "  ")).toBeNull();
    expect(valorLegivel(undefined, { resposta: false, texto: "x" })).toBe(
      "Não",
    );
  });
});
