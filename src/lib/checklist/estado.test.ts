import { describe, expect, it } from "vitest";
import { DEFINICAO_DOC2 } from "@/lib/dados/demonstracao/assistencial-fixtures";
import { lerValor, respostasVazias } from "@/lib/instrumentos/respostas";
import {
  aplicarResposta,
  acionamentoDoAlerta,
  comAcionamento,
  comDisparos,
  comSinalManual,
  marcarEnfileirados,
  novosDisparos,
} from "./estado";
import { rascunhoVazio } from "./rascunho";
import type { AlertaAvaliado } from "./registro";

const CONTEXTO = {
  definicao: DEFINICAO_DOC2,
  bebes: [{ id: "b1", rotulo: "Bebê 1" }],
  ultimoDia: false,
};

function novo() {
  return rascunhoVazio(
    "v1",
    "u1",
    "v1-2026-09",
    respostasVazias(),
    new Date("2026-09-29T12:00:00Z"),
  );
}

function alerta(
  regraId: string,
  bebeId: string | null = null,
  valor: unknown = 38.2,
): AlertaAvaliado {
  return {
    regraId,
    codigo: regraId,
    grupo: "puerpera",
    severidade: "imediato",
    descricao: "d",
    conduta: "c",
    campo: "2.1.temperatura",
    valorObservado: valor,
    exigeOcorrenciaPrivada: false,
    bebeId,
  };
}

describe("aplicarResposta", () => {
  it("grava a resposta e apaga a que deixou de se aplicar", () => {
    let r = novo();
    r = aplicarResposta(
      r,
      CONTEXTO,
      { bloco: "9", campo: "contato_medico_necessario" },
      true,
    );
    r = aplicarResposta(
      r,
      CONTEXTO,
      { bloco: "9", campo: "motivo_contato_realizado" },
      "Dúvida sobre a dose",
    );
    expect(
      lerValor(r.respostas, { bloco: "9", campo: "motivo_contato_realizado" }),
    ).toBe("Dúvida sobre a dose");
    r = aplicarResposta(
      r,
      CONTEXTO,
      { bloco: "9", campo: "contato_medico_necessario" },
      false,
    );
    expect(
      lerValor(r.respostas, { bloco: "9", campo: "motivo_contato_realizado" }),
    ).toBeUndefined();
  });

  it("responder o campo tira o texto trazido do dia anterior da fila de confirmação", () => {
    let r = novo();
    r = {
      ...r,
      trazidos: {
        "2.3|medicacoes_em_uso|": { texto: "Paracetamol", deDia: 3 },
      },
    };
    r = aplicarResposta(
      r,
      CONTEXTO,
      { bloco: "2.3", campo: "medicacoes_em_uso" },
      "Outra",
    );
    expect(r.trazidos).toEqual({});
  });

  it("não muta o rascunho anterior", () => {
    const antes = novo();
    aplicarResposta(
      antes,
      CONTEXTO,
      { bloco: "2.1", campo: "temperatura" },
      36.6,
    );
    expect(antes.respostas).toEqual(respostasVazias());
  });
});

describe("alertas que ficam", () => {
  it("só os que ainda não estão no rascunho entram, sem repetir", () => {
    let r = novo();
    const novos = novosDisparos(r, [
      alerta("PU-01"),
      alerta("PU-01"),
      alerta("RN-08", "b1", 38.6),
    ]);
    expect(novos.map((n) => [n.regraId, n.bebeId, n.valorObservado])).toEqual([
      ["PU-01", null, "38,2"],
      ["RN-08", "b1", "38,6"],
    ]);
    r = comDisparos(r, novos);
    expect(novosDisparos(r, [alerta("PU-01")])).toEqual([]);
  });

  it("corrigir o valor depois não apaga o alerta que já foi para a coordenação", () => {
    let r = novo();
    r = comDisparos(r, novosDisparos(r, [alerta("PU-01")]));
    r = aplicarResposta(
      r,
      CONTEXTO,
      { bloco: "2.1", campo: "temperatura" },
      36.4,
    );
    expect(r.disparados.map((d) => d.regraId)).toEqual(["PU-01"]);
  });

  it("marca como enfileirado só o alerta indicado", () => {
    let r = novo();
    r = comDisparos(
      r,
      novosDisparos(r, [alerta("PU-01"), alerta("RN-08", "b1")]),
    );
    r = marcarEnfileirados(r, ["PU-01|"]);
    expect(r.disparados.map((d) => [d.regraId, d.enfileirado])).toEqual([
      ["PU-01", true],
      ["RN-08", false],
    ]);
  });

  it("sinal do seletor entra como manual, uma vez por regra e bebê", () => {
    const sinal = {
      regraId: "PU-05",
      grupo: "puerpera",
      descricao: "d",
      severidade: "imediato" as const,
      conduta: "c",
    };
    const primeiro = comSinalManual(
      novo(),
      sinal,
      null,
      " dor de cabeça forte ",
    );
    expect(primeiro.disparo).toMatchObject({
      regraId: "PU-05",
      manual: true,
      valorObservado: "dor de cabeça forte",
      enfileirado: false,
    });
    const repetido = comSinalManual(primeiro.rascunho, sinal, null, null);
    expect(repetido.disparo).toBeNull();
    expect(repetido.rascunho.disparados).toHaveLength(1);
  });
});

describe("acionamento (os quatro campos do DOC 3)", () => {
  it("guarda por alerta e substitui o anterior", () => {
    let r = novo();
    r = comAcionamento(r, {
      regraId: "PU-01",
      bebeId: null,
      sinalIdentificado: "Febre",
      acionadoEm: "2026-09-29T12:40:00-03:00",
      orientacaoMedica: "",
      condutaAdotada: "",
    });
    r = comAcionamento(r, {
      regraId: "PU-01",
      bebeId: null,
      sinalIdentificado: "Febre",
      acionadoEm: "2026-09-29T12:40:00-03:00",
      orientacaoMedica: "Observar",
      condutaAdotada: "Antitérmico",
    });
    expect(r.acionamentos).toHaveLength(1);
    expect(acionamentoDoAlerta(r, "PU-01", null)?.condutaAdotada).toBe(
      "Antitérmico",
    );
    expect(acionamentoDoAlerta(r, "PU-01", "b1")).toBeUndefined();
  });
});
