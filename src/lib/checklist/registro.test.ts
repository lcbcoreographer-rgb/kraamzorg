import { describe, expect, it } from "vitest";
import {
  DEFINICAO_DOC2,
  dadosDeExemplo,
  regrasDoDoc3,
} from "@/lib/dados/demonstracao/assistencial-fixtures";
import { comValor, respostasVazias } from "@/lib/instrumentos/respostas";
import { lerRegrasDoSeed } from "@/lib/regras-alerta/seed-regra-alerta.test-util";
import type {
  BebeChecklist,
  RegistroAnterior,
} from "@/lib/dados/tipos-assistencial";
import { calcularAssinatura } from "./assinatura";
import {
  assinarRegistro,
  avaliarAlertasDoCampo,
  avaliarAlertasDoRegistro,
  bebesDoFormulario,
  catalogoDasLinhas,
  CHAVE_ALERTAS,
  dadosParaRespostas,
  lerDoRegistro,
  montarDados,
  pendenciasDoRegistro,
  registroParaAvaliacao,
  resumoDoDia,
  serieDosDiasAnteriores,
} from "./registro";

const BEBE_1: BebeChecklist = {
  id: "00000000-0000-4000-8000-0000000000b1",
  ordem: 1,
  nome: "Bebê Teste Um",
  dataNascimento: "2026-09-20",
  pesoNascimentoG: 3300,
  pesoAltaG: 3100,
};
const BEBE_2: BebeChecklist = {
  ...BEBE_1,
  id: "00000000-0000-4000-8000-0000000000b2",
  ordem: 2,
  nome: "Bebê Teste Dois",
};

// As regras exatamente como o banco as guarda (seed), pelo mesmo caminho da produção.
const { catalogo: CATALOGO } = catalogoDasLinhas(lerRegrasDoSeed());

function contexto(bebes = [BEBE_1], anteriores: RegistroAnterior[] = []) {
  return { catalogo: CATALOGO, bebes, anteriores, dataVisita: "2026-09-29" };
}

describe("montarDados e dadosParaRespostas", () => {
  const bebes = bebesDoFormulario([BEBE_1]);

  it("guarda o bloco por bebê como lista, um item por bebê, com bebe_id", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    const respostas = dadosParaRespostas(DEFINICAO_DOC2, dados);
    const volta = montarDados({
      definicao: DEFINICAO_DOC2,
      respostas,
      bebes,
      ultimoDia: false,
    });
    expect(volta["3.1"]).toEqual([
      expect.objectContaining({ bebe_id: BEBE_1.id, peso: 3240 }),
    ]);
    expect(lerDoRegistro(volta, { bloco: "2.1", campo: "temperatura" })).toBe(
      36.6,
    );
    expect(
      lerDoRegistro(volta, { bloco: "3.1", campo: "peso", bebe: BEBE_1.id }),
    ).toBe(3240);
  });

  it("o bloco do último dia só entra no último dia", () => {
    let respostas = respostasVazias();
    respostas = comValor(
      respostas,
      { bloco: "ultimo_dia", campo: "contato_obstetra" },
      "Dra. Teste (11) 91234-5678",
    );
    const comum = montarDados({
      definicao: DEFINICAO_DOC2,
      respostas,
      bebes,
      ultimoDia: false,
    });
    const ultimo = montarDados({
      definicao: DEFINICAO_DOC2,
      respostas,
      bebes,
      ultimoDia: true,
    });
    expect(comum["ultimo_dia"]).toBeUndefined();
    expect(ultimo["ultimo_dia"]).toEqual({
      contato_obstetra: "Dra. Teste (11) 91234-5678",
    });
  });

  it("os quatro campos do DOC 3 vão na chave reservada _alertas", () => {
    const dados = montarDados({
      definicao: DEFINICAO_DOC2,
      respostas: respostasVazias(),
      bebes,
      ultimoDia: false,
      acionamentos: [
        {
          regraId: "PU-01",
          bebeId: null,
          sinalIdentificado: " Febre de 38,2 °C ",
          acionadoEm: "2026-09-29T12:40:00-03:00",
          orientacaoMedica: "Observação e antitérmico.",
          condutaAdotada: "Reavaliação em 2 horas.",
        },
        {
          regraId: "RN-08",
          bebeId: BEBE_1.id,
          sinalIdentificado: "",
          acionadoEm: "",
          orientacaoMedica: "",
          condutaAdotada: "",
        },
      ],
    });
    expect(dados[CHAVE_ALERTAS]).toEqual([
      {
        regra_id: "PU-01",
        bebe_id: null,
        sinal_identificado: "Febre de 38,2 °C",
        acionado_em: "2026-09-29T12:40:00-03:00",
        orientacao_medica: "Observação e antitérmico.",
        conduta_adotada: "Reavaliação em 2 horas.",
      },
    ]);
  });

  it("ida e volta: dadosParaRespostas desfaz montarDados", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    const respostas = dadosParaRespostas(DEFINICAO_DOC2, dados);
    expect(respostas.por_bebe["3.1"]?.[BEBE_1.id]?.["peso"]).toBe(3240);
    expect(respostas.blocos["2.1"]?.["temperatura"]).toBe(36.6);
    const volta = montarDados({
      definicao: DEFINICAO_DOC2,
      respostas,
      bebes: bebesDoFormulario([BEBE_1]),
      ultimoDia: false,
    });
    expect(volta["2.1"]).toEqual(dados["2.1"]);
    expect(volta["3.1"]).toEqual(dados["3.1"]);
  });
});

describe("pendências para assinar (PRD 9.2 v4.2)", () => {
  const bebes = bebesDoFormulario([BEBE_1]);
  const completo = dadosParaRespostas(
    DEFINICAO_DOC2,
    dadosDeExemplo({ data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 }, [
      BEBE_1.id,
    ]),
  );
  const comResumo = comValor(
    completo,
    { bloco: "resumo", campo: "resumo_descritivo" },
    "Resumo do dia.",
  );

  it("registro completo com resumo não tem pendência", () => {
    expect(
      pendenciasDoRegistro({
        definicao: DEFINICAO_DOC2,
        respostas: comResumo,
        bebes,
        ultimoDia: false,
      }),
    ).toEqual([]);
    expect(resumoDoDia(comResumo)).toBe("Resumo do dia.");
  });

  it("sem resumo a visita não conclui", () => {
    const pendencias = pendenciasDoRegistro({
      definicao: DEFINICAO_DOC2,
      respostas: completo,
      bebes,
      ultimoDia: false,
    });
    expect(pendencias.map((p) => `${p.bloco}.${p.campo}`)).toEqual([
      "resumo.resumo_descritivo",
    ]);
  });

  it("sem os sinais vitais e o peso do bebê não conclui, um por bebê", () => {
    const doisBebes = bebesDoFormulario([BEBE_1, BEBE_2]);
    const pendencias = pendenciasDoRegistro({
      definicao: DEFINICAO_DOC2,
      respostas: comResumo,
      bebes: doisBebes,
      ultimoDia: false,
    });
    expect(
      pendencias
        .filter((p) => p.bebe === BEBE_2.id)
        .map((p) => p.campo)
        .sort(),
    ).toEqual([
      "frequencia_cardiaca",
      "frequencia_respiratoria",
      "peso",
      "temperatura",
    ]);
  });

  it("no último dia entram os contatos dos médicos e o resumo de encerramento", () => {
    const pendencias = pendenciasDoRegistro({
      definicao: DEFINICAO_DOC2,
      respostas: comResumo,
      bebes,
      ultimoDia: true,
    });
    expect(pendencias.map((p) => p.campo).sort()).toEqual([
      "contato_obstetra",
      "contato_pediatra",
      "resumo_encerramento",
    ]);
  });

  it("no último dia, ausência justificada vale no lugar do contato (com justificativa escrita)", () => {
    let respostas = comResumo;
    respostas = comValor(
      respostas,
      { bloco: "ultimo_dia", campo: "contato_obstetra" },
      "obs@exemplo.invalid",
    );
    respostas = comValor(
      respostas,
      { bloco: "ultimo_dia", campo: "contato_pediatra" },
      { ausente: true, justificativa: "A família não tinha o número" },
    );
    respostas = comValor(
      respostas,
      { bloco: "ultimo_dia", campo: "resumo_encerramento" },
      "Fim.",
    );
    expect(
      pendenciasDoRegistro({
        definicao: DEFINICAO_DOC2,
        respostas,
        bebes,
        ultimoDia: true,
      }),
    ).toEqual([]);
    respostas = comValor(
      respostas,
      { bloco: "ultimo_dia", campo: "contato_pediatra" },
      { ausente: true, justificativa: "   " },
    );
    expect(
      pendenciasDoRegistro({
        definicao: DEFINICAO_DOC2,
        respostas,
        bebes,
        ultimoDia: true,
      }).map((p) => p.campo),
    ).toEqual(["contato_pediatra"]);
  });
});

describe("alertas no aparelho, sem conexão (P40 item 2)", () => {
  it("temperatura de 38,2 °C dispara PU-01 ao salvar o campo, com a conduta do banco", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 38.2, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    const alertas = avaliarAlertasDoCampo(
      { bloco: "2.1", campo: "temperatura" },
      dados,
      contexto(),
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      codigo: "PU-01",
      severidade: "imediato",
      bebeId: null,
      campo: "2.1.temperatura",
      exigeOcorrenciaPrivada: false,
    });
    expect(alertas[0]?.conduta).toBe(
      lerRegrasDoSeed().find((r) => r.id === "PU-01")?.conduta,
    );
    expect(alertas[0]?.valorObservado).toBe(38.2);
  });

  it("36,6 °C não dispara", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    expect(
      avaliarAlertasDoCampo(
        { bloco: "2.1", campo: "temperatura" },
        dados,
        contexto(),
      ),
    ).toEqual([]);
  });

  it("temperatura do bebê acima de 38 °C dispara RN-08 só para aquele bebê (gêmeos)", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 2500 },
      [BEBE_1.id, BEBE_2.id],
    );
    const lista = dados["3.1"] as Record<string, unknown>[];
    lista[1] = { ...lista[1], temperatura: 38.6 };
    const ctx = contexto([BEBE_1, BEBE_2]);
    const doPrimeiro = avaliarAlertasDoCampo(
      { bloco: "3.1", campo: "temperatura", bebe: BEBE_1.id },
      dados,
      ctx,
    );
    const doSegundo = avaliarAlertasDoCampo(
      { bloco: "3.1", campo: "temperatura", bebe: BEBE_2.id },
      dados,
      ctx,
    );
    expect(doPrimeiro).toEqual([]);
    expect(doSegundo.map((a) => [a.codigo, a.bebeId])).toEqual([
      ["RN-08", BEBE_2.id],
    ]);
  });

  it("a reavaliação completa acha o que o campo isolado achou, sem repetir por bebê", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 38.2, pesoBebe: 2500 },
      [BEBE_1.id, BEBE_2.id],
    );
    const lista = dados["3.1"] as Record<string, unknown>[];
    lista[0] = { ...lista[0], temperatura: 35.5 };
    const alertas = avaliarAlertasDoRegistro(dados, contexto([BEBE_1, BEBE_2]));
    expect(alertas.map((a) => [a.codigo, a.bebeId]).sort()).toEqual([
      ["PU-01", null],
      ["RN-08", BEBE_1.id],
    ]);
  });

  it("respiração com esforço (RN-01) e atividade não preservada (RN-03) disparam pelo DOC 2 aprovado", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    (dados["3"] as Record<string, unknown>[])[0] = {
      bebe_id: BEBE_1.id,
      respiracao_sem_sinais_esforco: false,
      atividade_responsividade_preservadas: false,
    };
    const codigos = avaliarAlertasDoRegistro(dados, contexto())
      .map((a) => a.codigo)
      .sort();
    expect(codigos).toEqual(["RN-01", "RN-03"]);
  });

  it("cesárea com sinais de infecção (PU-04) dispara; sim não dispara", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 36.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    dados["2.2"] = { cesarea_sem_sinais_infeccao: false };
    expect(
      avaliarAlertasDoRegistro(dados, contexto()).map((a) => a.codigo),
    ).toEqual(["PU-04"]);
    dados["2.2"] = { cesarea_sem_sinais_infeccao: true };
    expect(avaliarAlertasDoRegistro(dados, contexto())).toEqual([]);
  });

  it("regra desligada (PU-08, clínico) não dispara com duas visitas seguidas de 37,6", () => {
    const dados = dadosDeExemplo(
      { data: "2026-09-29", temperatura: 37.6, pesoBebe: 3240 },
      [BEBE_1.id],
    );
    const anterior: RegistroAnterior = {
      visitaId: "v-1",
      diaNumero: 1,
      data: "2026-09-28",
      dados: dadosDeExemplo(
        { data: "2026-09-28", temperatura: 37.7, pesoBebe: 3200 },
        [BEBE_1.id],
      ),
      resumoDescritivo: null,
    };
    expect(
      avaliarAlertasDoRegistro(dados, contexto([BEBE_1], [anterior])),
    ).toEqual([]);
  });

  it("regra quebrada no cache não derruba o checklist: vai para a lista de descartadas", () => {
    const linhas = lerRegrasDoSeed();
    const { catalogo, descartadas } = catalogoDasLinhas([
      ...linhas,
      { ...linhas[0]!, id: "XX-01", grupo: "grupo_inexistente" },
    ]);
    expect(descartadas).toEqual(["XX-01"]);
    expect(catalogo.length).toBe(linhas.length);
  });
});

describe("catálogo de demonstração espelha o seed", () => {
  it("as 38 regras do DOC 3, com a mesma ativação e o mesmo campo nas ativas", () => {
    const seed = lerRegrasDoSeed();
    const demo = regrasDoDoc3();
    expect(demo).toHaveLength(38);
    for (const linha of seed) {
      const igual = demo.find((r) => r.id === linha.id);
      expect(igual, linha.id).toBeDefined();
      expect(igual?.ativa, linha.id).toBe(linha.ativa);
      if (linha.ativa) expect(igual?.campo, linha.id).toBe(linha.campo);
    }
  });
});

describe("registroParaAvaliacao e série", () => {
  it("resposta composta vira o valor principal e o bebê certo é escolhido", () => {
    const dados = {
      "2.6": { evn: 3, dor_mamilos_amamentar: { resposta: true, texto: "x" } },
      "3.1": [
        { bebe_id: "a", peso: 3000 },
        { bebe_id: "b", peso: 3100 },
      ],
      [CHAVE_ALERTAS]: [{ regra_id: "PU-01" }],
    };
    expect(registroParaAvaliacao(dados, "b")).toEqual({
      "2.6": { evn: 3, dor_mamilos_amamentar: true },
      "3.1": { peso: 3100 },
    });
    expect(registroParaAvaliacao(dados)).toEqual({
      "2.6": { evn: 3, dor_mamilos_amamentar: true },
    });
  });

  it("a série vem do dia mais recente ao mais antigo", () => {
    const serie = serieDosDiasAnteriores([
      {
        visitaId: "1",
        diaNumero: 1,
        data: "2026-09-27",
        dados: { "2.1": { temperatura: 36.5 } },
        resumoDescritivo: null,
      },
      {
        visitaId: "3",
        diaNumero: 3,
        data: "2026-09-29",
        dados: { "2.1": { temperatura: 36.9 } },
        resumoDescritivo: null,
      },
    ]);
    expect(serie.map((s) => s.visitaId)).toEqual(["3", "1"]);
  });
});

describe("assinarRegistro", () => {
  it("calcula a assinatura no aparelho com dados, resumo, profissional e hora", async () => {
    const dados = { "1": { data: "2026-09-29", horario: "09:30" } };
    const agora = new Date("2026-09-29T15:00:00.123Z");
    const registro = await assinarRegistro({
      visitaId: "v",
      profissionalId: "p",
      instrumentoVersao: "v1-2026-09",
      dados,
      resumo: "Resumo",
      agora,
    });
    expect(registro.assinadoEmMs).toBe(agora.getTime());
    expect(registro.assinatura).toBe(
      await calcularAssinatura({
        dados,
        resumo: "Resumo",
        profissionalId: "p",
        assinadoEmMs: agora.getTime(),
      }),
    );
  });
});
