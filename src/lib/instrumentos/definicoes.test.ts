import { describe, expect, it } from "vitest";
import doc1 from "../../../supabase/dados/instrumentos/doc1.json";
import doc2 from "../../../supabase/dados/instrumentos/doc2.json";
import doc3 from "../../../supabase/dados/instrumentos/doc3.json";
import doc4 from "../../../supabase/dados/instrumentos/doc4.json";
import { lerDefinicao, type Bloco, type Campo } from "./schema";

/**
 * P34 item 2: as definições v1 dos quatro instrumentos batem com o PRD 9.1
 * a 9.4 (nenhum campo inventado, nenhum nome alterado; itens [clínico]
 * marcados). A tabela esperada do DOC 2 abaixo é a do PRD 9.2 transcrita:
 * se alguém renomear, tirar ou acrescentar campo, o teste quebra.
 */
const definicoes = {
  doc1: lerDefinicao(doc1),
  doc2: lerDefinicao(doc2),
  doc3: lerDefinicao(doc3),
  doc4: lerDefinicao(doc4),
};

function campos(blocos: Bloco[]): Array<[string, string, Campo["tipo"]]> {
  return blocos.flatMap((b) =>
    b.campos.map(
      (c) => [b.id, c.rotulo, c.tipo] as [string, string, Campo["tipo"]],
    ),
  );
}

describe("as quatro definições v1", () => {
  it("validam no esquema, com código e versão do PRD 6.5", () => {
    expect(definicoes.doc1.codigo).toBe("DOC1_ENTREVISTA");
    expect(definicoes.doc2.codigo).toBe("DOC2_CHECKLIST");
    expect(definicoes.doc3.codigo).toBe("DOC3_ALERTAS");
    expect(definicoes.doc4.codigo).toBe("DOC4_MAMADA");
    for (const d of Object.values(definicoes))
      expect(d.versao).toBe("v1-2026-09");
  });

  it("não têm travessão, meia-risca nem os termos proibidos", () => {
    const texto = JSON.stringify([doc1, doc2, doc3, doc4]);
    expect(texto).not.toMatch(new RegExp("[\\u2014\\u2013]"));
    expect(texto.toLowerCase()).not.toMatch(/mãezinha|mamãe|papai/);
  });
});

describe("DOC 2, checklist diário (PRD 9.2)", () => {
  const doc = definicoes.doc2;

  it("tem os campos do 9.2, com os nomes e os tipos da tabela", () => {
    expect(campos(doc.blocos)).toEqual([
      ["1", "Data", "data"],
      ["1", "Horário", "hora"],
      ["1", "Acompanhante presente?", "sim_nao_texto"],
      ["1", "Pontualidade confirmada", "sim_nao"],
      ["1", "Higienização das mãos", "sim_nao"],
      ["1", "Apresentação e acolhimento da família", "sim_nao"],
      ["1", "Relato desde a última visita coletado", "sim_nao"],
      ["2", "Bem-estar geral preservado", "sim_nao"],
      ["2", "Queixa de dor?", "sim_nao_texto"],
      ["2", "Dor, intensidade", "escala"],
      ["2", "Sangramento (lóquios) esperado", "sim_nao"],
      ["2.1", "Pressão arterial", "numero"],
      ["2.1", "Temperatura", "numero"],
      ["2.1", "Frequência cardíaca", "numero"],
      ["2.2", "Cesárea sem sinais de infecção", "sim_nao"],
      ["2.2", "Episiotomia ou laceração sem alterações", "sim_nao"],
      ["2.2", "Orientações de cuidado reforçadas", "sim_nao"],
      ["2.3", "Medicações em uso", "texto"],
      ["2.4", "Higiene íntima orientada", "sim_nao"],
      ["2.4", "Sono e repouso adequados", "sim_nao"],
      ["2.4", "Alimentação e hidratação adequadas", "sim_nao"],
      ["2.4", "Eliminações e evacuação presentes", "sim_nao"],
      ["2.5", "Túrgidas ou secretantes", "sim_nao"],
      ["2.5", "Flácidas", "sim_nao"],
      ["2.5", "Ingurgitadas", "sim_nao"],
      ["2.6", "Dor nos mamilos para amamentar", "sim_nao"],
      ["2.6", "EVN", "escala"],
      ["2.6", "Intervenções realizadas para dor", "texto"],
      ["2.7", "Apresenta lesão mamilar?", "opcao_unica"],
      ["2.7", "Escore de trauma mamilar (NTS)", "escala"],
      ["2.7", "Interrupção adequada da sucção", "sim_nao"],
      ["2.8", "LATCH", "escala"],
      ["2.8", "Teste da linguinha", "opcao_unica"],
      ["2.9", "FBM aplicada", "multipla"],
      ["2.10", "Uso de bicos artificiais", "sim_nao"],
      ["2.10", "Uso de forros e conchas", "sim_nao"],
      ["2.10", "Uso de bomba de extração", "sim_nao"],
      ["2.11", "Sucções por dia", "opcao_unica"],
      ["2.12", "Produção de leite", "opcao_unica"],
      ["2.13", "Sente-se apoiada ao amamentar", "escala"],
      ["2.13", "Quem mais apoia", "texto"],
      ["3", "Cor da pele ictérica", "opcao_unica"],
      ["3", "Respiração sem sinais de esforço", "sim_nao"],
      ["3", "Choro habitual", "sim_nao"],
      ["3", "Atividade e responsividade preservadas", "sim_nao"],
      ["3.1", "Temperatura", "numero"],
      ["3.1", "Frequência cardíaca", "numero"],
      ["3.1", "Frequência respiratória", "numero"],
      ["3.1", "Peso", "numero"],
      ["3.2", "Troca de fraldas e avaliação de diurese", "sim_nao_texto"],
      ["3.2", "Banho orientado ou realizado", "sim_nao"],
      ["3.2", "Coto umbilical avaliado e cuidado", "sim_nao_texto"],
      ["3.2", "Vestimenta adequada ao clima", "sim_nao"],
      ["4", "Massagem e extração de leite", "sim_nao"],
      ["4", "Correção de pega e posição", "sim_nao"],
      ["4", "Livre demanda reforçada", "sim_nao"],
      ["4", "Cólica e disquesia", "sim_nao"],
      ["4", "Posturas de conforto", "sim_nao"],
      ["4", "Sinais de fome", "sim_nao"],
      ["4", "Manobra de desengasgo", "sim_nao"],
      ["5", "Sono seguro orientado", "sim_nao"],
      ["5", "Sinais e janelas de sono explicados", "sim_nao"],
      ["5", "Organização em acordo com a rotina familiar", "sim_nao"],
      ["6", "Orientações ao parceiro", "sim_nao"],
      ["6", "Dúvidas esclarecidas", "sim_nao"],
      ["7", "Escuta ativa e emoções validadas", "sim_nao"],
      ["7", "Sinais de sofrimento emocional", "sim_nao_texto"],
      ["8", "Ambiente organizado", "sim_nao"],
      ["8", "Alinhamento para o dia seguinte", "sim_nao"],
      ["9", "Contato com médico necessário", "sim_nao"],
      ["9", "Motivo do contato realizado", "texto"],
      ["ultimo_dia", "Contato do obstetra", "texto"],
      ["ultimo_dia", "Contato do pediatra", "texto"],
      ["ultimo_dia", "Resumo de encerramento", "texto_longo"],
      ["assinatura", "Enfermeira e hora", "automatico"],
      ["resumo", "Resumo descritivo do dia", "texto_longo"],
    ]);
  });

  it("tem o cabeçalho do acompanhamento, com os campos do bebê repetidos por bebê", () => {
    expect(campos(doc.cabecalho ?? [])).toEqual([
      ["cabecalho", "Paciente", "texto"],
      ["cabecalho", "Ginecologista", "texto"],
      ["cabecalho", "Hospital", "texto"],
      ["cabecalho", "Data da alta", "data"],
      ["cabecalho", "Pediatra", "texto"],
      ["cabecalho_bebe", "Nome do recém-nascido", "texto"],
      ["cabecalho_bebe", "Peso ao nascer", "numero"],
      ["cabecalho_bebe", "Peso do bebê na alta", "numero"],
    ]);
    expect(
      doc.cabecalho?.find((b) => b.id === "cabecalho_bebe")?.repete_por_bebe,
    ).toBe(true);
  });

  it("repete por bebê os blocos 3, 3.1 e 3.2", () => {
    expect(
      doc.blocos.filter((b) => b.repete_por_bebe).map((b) => b.id),
    ).toEqual(["3", "3.1", "3.2"]);
  });

  it("marca como obrigatórios os itens do PRD 9.2 v4.2, com o bloco de amamentação inteiro", () => {
    const obrigatorios = doc.blocos.flatMap((b) =>
      b.campos.filter((c) => c.obrigatorio).map((c) => `${b.id}.${c.id}`),
    );
    const amamentacao = doc.blocos
      .filter((b) => /^2\.(5|6|7|8|9|10|11|12|13)$/.test(b.id))
      .flatMap((b) => b.campos.map((c) => `${b.id}.${c.id}`));
    expect(amamentacao).toHaveLength(19);
    expect(obrigatorios).toEqual([
      "1.data",
      "1.horario",
      "2.1.pressao_arterial",
      "2.1.temperatura",
      "2.1.frequencia_cardiaca",
      ...amamentacao,
      "3.1.temperatura",
      "3.1.frequencia_cardiaca",
      "3.1.frequencia_respiratoria",
      "3.1.peso",
      "ultimo_dia.contato_obstetra",
      "ultimo_dia.contato_pediatra",
      "ultimo_dia.resumo_encerramento",
      "assinatura.enfermeira_e_hora",
      "resumo.resumo_descritivo",
    ]);
  });

  it("mantém marcados os itens [clínico] do 9.2", () => {
    const blocoAmamentacao = doc.blocos.filter((b) =>
      /^2\.(5|6|7|8|9|10|11|12|13)$/.test(b.id),
    );
    expect(
      blocoAmamentacao.every(
        (b) => b.clinico && b.nota_clinica?.includes("K-09"),
      ),
    ).toBe(true);
    const succoes = doc.blocos.find((b) => b.id === "2.11")?.campos[0];
    expect(succoes?.clinico).toBe(true);
    expect(succoes?.nota_clinica).toContain("onde entra o 8");
    const latch = doc.blocos.find((b) => b.id === "2.8")?.campos[0];
    expect(latch?.alertas?.[0]?.clinico).toBe(true);
    expect(latch?.alertas?.[0]?.nota_clinica).toContain("0 a 7");
  });

  it('mantém os blocos 4, 5, 6 e 8 em sim ou não item a item (PRD 20.6 não adotou "feito hoje")', () => {
    for (const id of ["4", "5", "6", "8"]) {
      const b = doc.blocos.find((x) => x.id === id);
      expect(b?.campos.every((c) => c.tipo === "sim_nao")).toBe(true);
      expect(b?.nota_clinica).toContain("K-19");
    }
  });

  it("liga cada campo só a regras que existem no catálogo do DOC 3", () => {
    const codigos = new Set(
      definicoes.doc3.catalogo_alertas?.grupos.flatMap((g) =>
        g.sinais.map((s) => s.codigo),
      ),
    );
    const ligadas = doc.blocos.flatMap((b) =>
      b.campos.flatMap((c) => (c.alertas ?? []).flatMap((a) => a.regras)),
    );
    expect(ligadas.length).toBeGreaterThan(0);
    for (const regra of ligadas) expect(codigos.has(regra)).toBe(true);
  });

  it("dá condição avaliável às regras do Apêndice B com fonte DOC 3 que têm corte no próprio campo", () => {
    const comFonteDoc3 = doc.blocos.flatMap((b) =>
      b.campos.flatMap((c) =>
        (c.alertas ?? [])
          .filter((a) => a.fonte === "DOC 3")
          .map((a) => ({
            regra: a.regras.join(","),
            condicao: a.condicao !== undefined,
          })),
      ),
    );
    expect(comFonteDoc3).toEqual([
      { regra: "PU-01", condicao: true },
      { regra: "PU-04", condicao: true },
      { regra: "RN-01", condicao: true },
      { regra: "RN-03", condicao: true },
      { regra: "RN-08", condicao: true },
      // RN-04 e RN-07: o campo não tem o dado como número ou opção (pendência do P40).
      { regra: "RN-04", condicao: false },
      { regra: "RN-07", condicao: false },
    ]);
  });
});

describe("DOC 1, entrevista pré-natal (PRD 9.1)", () => {
  const doc = definicoes.doc1;

  it("tem os blocos A a H", () => {
    expect(doc.blocos.map((b) => `${b.id} ${b.titulo}`)).toEqual([
      "A Origem",
      "B Dados da entrevista",
      "C Identificação",
      "D História obstétrica",
      "E História de amamentação",
      "F Expectativas",
      "G Temas essenciais abordados",
      "H Médicos e preferências",
    ]);
  });

  it("não traz as propostas da versão 2 (ficam num rascunho separado)", () => {
    const origem = doc.blocos[0]?.campos[0];
    expect(
      origem?.tipo === "opcao_unica" && origem.opcoes.map((o) => o.rotulo),
    ).toEqual([
      "Instagram",
      "Indicação de amigo",
      "Indicação médica",
      "Presente",
    ]);
    const texto = JSON.stringify(doc1).toLowerCase();
    expect(texto).not.toContain("internet ou site");
    expect(texto).not.toContain("ainda não sei");
  });

  it("não grava idade gestacional: o campo é calculado da DPP", () => {
    const ig = doc.blocos
      .find((b) => b.id === "B")
      ?.campos.find((c) => c.id === "idade_gestacional_atual");
    expect(ig?.tipo === "automatico" && ig.origem).toBe(
      "idade_gestacional_calculada",
    );
  });

  it("leva o período em ordem para consulta_prenatal.periodo_preferido, com os valores do enum", () => {
    const periodo = doc.blocos
      .find((b) => b.id === "H")
      ?.campos.find((c) => c.id === "preferencia_de_periodo");
    expect(periodo?.tipo).toBe("multipla");
    if (periodo?.tipo !== "multipla") return;
    expect(periodo.ordenada).toBe(true);
    expect(periodo.opcoes.map((o) => o.valor)).toEqual([
      "manha",
      "tarde",
      "noite_avaliar",
    ]);
    expect(periodo.destino).toBe("consulta_prenatal.periodo_preferido");
  });

  it("escolaridade em sete níveis", () => {
    const esc = doc.blocos
      .find((b) => b.id === "C")
      ?.campos.find((c) => c.id === "escolaridade");
    expect(esc?.tipo === "opcao_unica" && esc.opcoes).toHaveLength(7);
  });
});

describe("DOC 3, sinais de alerta (PRD 9.3)", () => {
  const catalogo = definicoes.doc3.catalogo_alertas;

  it("tem os 38 sinais, 12 + 7 + 13 + 6, com a severidade do PRD", () => {
    expect(catalogo?.grupos.map((g) => [g.id, g.sinais.length])).toEqual([
      ["puerpera", 12],
      ["saude_mental", 7],
      ["recem_nascido", 13],
      ["amamentacao", 6],
    ]);
    const imediatos = catalogo?.grupos.flatMap((g) =>
      g.sinais.filter((s) => s.severidade === "imediato").map((s) => s.codigo),
    );
    expect(imediatos).toEqual([
      "PU-01",
      "PU-02",
      "PU-03",
      "PU-04",
      "PU-05",
      "PU-06",
      "PU-07",
      "SM-01",
      "SM-02",
      "SM-03",
      "RN-01",
      "RN-02",
      "RN-03",
      "RN-04",
      "RN-05",
      "RN-06",
      "RN-07",
      "RN-08",
      "RN-09",
      "AM-01",
      "AM-02",
      "AM-03",
    ]);
  });

  it("tem o registro obrigatório de quatro campos e o seletor marcado [clínico]", () => {
    const registro = definicoes.doc3.blocos[0];
    expect(registro?.campos.map((c) => [c.rotulo, c.obrigatorio])).toEqual([
      ["Sinal identificado", true],
      ["Horário do acionamento", true],
      ["Orientação médica recebida", true],
      ["Conduta adotada", true],
    ]);
    expect(registro?.campos[0]?.clinico).toBe(true);
    const seletor = registro?.campos[0];
    expect(seletor?.tipo === "opcao_unica" && seletor.opcoes).toHaveLength(38);
  });
});

describe("DOC 4, mamada e laserterapia (PRD 9.4)", () => {
  const doc = definicoes.doc4;

  it("tem LATCH com cinco itens de 0 a 2, NTS de 0 a 5 e os quatro protocolos", () => {
    const latch = doc.blocos.find((b) => b.id === "latch");
    expect(
      latch?.campos.map((c) => [
        c.rotulo,
        c.tipo === "escala" && [c.min, c.max],
      ]),
    ).toEqual([
      ["Pega", [0, 2]],
      ["Deglutição audível", [0, 2]],
      ["Tipo de mamilo", [0, 2]],
      ["Conforto", [0, 2]],
      ["Colo", [0, 2]],
    ]);
    expect(latch?.ajuda).toContain(
      "0 a 7 apoio necessário, 8 a 10 amamentação eficaz",
    );
    const nts = doc.blocos.find((b) => b.id === "nts")?.campos[0];
    expect(nts?.tipo === "escala" && nts.pontos).toHaveLength(6);
    const laser = doc.blocos.find((b) => b.id === "laserterapia")?.campos[0];
    expect(
      laser?.tipo === "opcao_unica" && laser.opcoes.map((o) => o.rotulo),
    ).toEqual([
      "Analgesia",
      "Reparação",
      "Fotoativação e drenagem linfática",
      "ILIB",
    ]);
  });

  it("nasce com o ILIB em vermelho e marcado [clínico] para confirmar o texto", () => {
    const laser = doc.blocos.find((b) => b.id === "laserterapia")?.campos[0];
    const ilib =
      laser?.tipo === "opcao_unica"
        ? laser.opcoes.find((o) => o.valor === "ilib")
        : undefined;
    expect(ilib?.ajuda).toContain("Vermelho");
    expect(ilib?.clinico).toBe(true);
  });
});
