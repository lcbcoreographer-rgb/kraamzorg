import { describe, expect, it } from "vitest";
import {
  dadosNeonatalTeste,
  dadosPuerperalTeste,
  textosNeonatalTeste,
  textosPuerperalTeste,
} from "./__fixtures__/acompanhamento-sintetico";
import {
  auditarConteudo,
  textosDoConteudo,
  type ConteudoEvolucao,
} from "./conteudo";
import { montarConteudoNeonatal } from "./conteudo-neonatal";
import { montarConteudoPuerperal } from "./conteudo-puerperal";

function textoCorrido(conteudo: ConteudoEvolucao): string {
  return textosDoConteudo(conteudo).join("\n");
}

function secao(conteudo: ConteudoEvolucao, titulo: string) {
  return conteudo.secoes.find((s) => s.titulo === titulo);
}

describe("montarConteudoNeonatal: concordância de gênero", () => {
  it("menina: nada de 'filho', 'nascido', 'calmo' nem 'Normotérmico'", () => {
    const texto = textoCorrido(
      montarConteudoNeonatal(dadosNeonatalTeste(), textosNeonatalTeste),
    );
    expect(texto).toContain("nascida por parto cesárea");
    expect(texto).toContain("filha de Marina Teste Aurora");
    expect(texto).toContain("calma, ativa e reativa");
    expect(texto).toContain("Normotérmica");
    expect(texto).toContain("Eupneica");
    expect(texto).toContain("Genitália feminina");
    expect(texto).not.toMatch(/\bfilho\b|\bnascido\b|\bcalmo\b|Normotérmico/);
    expect(texto).not.toContain("testículos");
  });

  it("menino: forma masculina em todos os trechos", () => {
    const dados = dadosNeonatalTeste();
    dados.bebe.sexo = "masculino";
    const texto = textoCorrido(
      montarConteudoNeonatal(dados, textosNeonatalTeste),
    );
    expect(texto).toContain("nascido por parto cesárea");
    expect(texto).toContain("filho de Marina Teste Aurora");
    expect(texto).toContain("calmo, ativo e reativo");
    expect(texto).toContain("Genitália masculina");
    expect(texto).not.toMatch(/\bfilha\b|\bnascida\b|\bcalma\b/);
  });
});

describe("montarConteudoNeonatal: dados e formatação", () => {
  const conteudo = montarConteudoNeonatal(
    dadosNeonatalTeste(),
    textosNeonatalTeste,
  );
  const texto = textoCorrido(conteudo);

  it("dia de vida contado com o nascimento como dia 0 (K-11): 04/09 a 11/09 é o 7º dia", () => {
    expect(texto).toContain("7º dia de vida");
  });

  it("datas em dd/mm/aaaa e números com vírgula e ponto de milhar", () => {
    expect(texto).toContain("05/09/2026 a 11/09/2026 (Kraamzorg Brasil)");
    expect(texto).toContain("3.400 g (04/09/2026)");
    expect(texto).toContain("36,3 a 37,1 °C");
    expect(texto).toContain("7,4%");
    expect(texto).toContain("230 g em 5 dias; ganho médio de 46 g/dia");
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("icterícia com zona em romano, zona máxima e tendência, sem intensidade presumida", () => {
    expect(texto).toContain(
      "Icterícia leve em zona I de Kramer, em regressão.",
    );
    expect(texto).toContain("II");
    const dados = dadosNeonatalTeste();
    dados.ictericia = { zonaKramer: 2, tendencia: "regressao" };
    // O modelo usa {intensidade}; sem o dado, falha em vez de inventar "leve".
    expect(() => montarConteudoNeonatal(dados, textosNeonatalTeste)).toThrow(
      /intensidade/,
    );
  });

  it("SpO2 do RN (sem campo no checklist, K-01) só aparece quando informada", () => {
    expect(texto).not.toContain("SpO2");
    const dados = dadosNeonatalTeste();
    dados.cardiovascular.spo2 = { min: 96, max: 99 };
    expect(
      textoCorrido(montarConteudoNeonatal(dados, textosNeonatalTeste)),
    ).toContain("96 a 99%");
  });

  it("eliminações: sem diurese, o documento não diz 'diurese e evacuações presentes'", () => {
    const dados = dadosNeonatalTeste();
    dados.genitaliaEliminacoes = { diurese: false, evacuacoes: true };
    const conteudoSemDiurese = montarConteudoNeonatal(
      dados,
      textosNeonatalTeste,
    );
    const trecho = textosDoConteudo({
      ...conteudoSemDiurese,
      secoes: [secao(conteudoSemDiurese, "Genitália e eliminações")!],
    }).join("\n");
    expect(trecho).not.toContain("Diurese e evacuações presentes");
    expect(trecho).toContain("ausente");
  });

  it("conclusão monta aleitamento, peso e icterícia a partir das chaves aprovadas", () => {
    expect(texto).toContain(
      "em aleitamento materno exclusivo, apresentando ganho de peso progressivo, com icterícia em regressão",
    );
  });

  it("assinatura com especialidade legível, nunca o valor cru de profissional.funcao", () => {
    expect(conteudo.assinatura.especialidade).toBe("Enfermeira obstetra");
    expect(texto).not.toContain("enfermeira_obstetrica");
  });

  it("o conteúdo montado passa na auditoria de texto", () => {
    expect(auditarConteudo(conteudo)).toEqual([]);
  });
});

describe("montarConteudoPuerperal", () => {
  const conteudo = montarConteudoPuerperal(
    dadosPuerperalTeste(),
    textosPuerperalTeste,
  );
  const texto = textoCorrido(conteudo);

  it("dia de puerpério calculado com o parto como dia 0", () => {
    expect(texto).toContain("Paciente no 7º dia de puerpério");
  });

  it("cesárea: lista de alertas com o item de ferida operatória e a seção de ferida", () => {
    const orientacoes = secao(conteudo, "Orientações de alta e conduta")!;
    const listaAlertas = orientacoes.blocos.find((b) => b.tipo === "lista");
    expect(listaAlertas).toBeDefined();
    if (listaAlertas?.tipo !== "lista") return;
    expect(listaAlertas.itens[0]).toContain("ferida operatória");
    // quatro alertas-padrão e o item personalizado, numa lista só
    expect(listaAlertas.itens).toHaveLength(5);
    expect(secao(conteudo, "Ferida operatória")).toBeDefined();
  });

  it("parto vaginal: nem item nem seção de ferida operatória", () => {
    const dados = dadosPuerperalTeste();
    dados.historico.tipoParto = "vaginal";
    dados.feridaOperatoria = undefined;
    const vaginal = montarConteudoPuerperal(dados, textosPuerperalTeste);
    expect(textoCorrido(vaginal)).not.toContain("ferida operatória");
    expect(secao(vaginal, "Ferida operatória")).toBeUndefined();
  });

  it("lesão com lado concordando com o local ('mamilo esquerdo') e dias em D", () => {
    expect(texto).toContain("em mamilo esquerdo, identificada no D2");
    expect(texto).toContain("D1, D2, D3");
  });

  it("encaminhamento de saúde mental aparece quando marcado", () => {
    expect(texto).toContain("equipe de saúde mental");
  });

  it("SpO2 materna e aspecto dos lóquios (sem campo no checklist, K-01) ficam de fora quando não informados", () => {
    expect(texto).not.toContain("SpO2");
    expect(texto).not.toContain("aspecto");
  });

  it("valores em formato brasileiro e datas sem ISO", () => {
    expect(texto).toContain("36,2 a 36,9 °C");
    expect(texto).toContain("20/09/2026");
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("auditarConteudo", () => {
  it("acusa travessão vindo de texto livre da enfermeira", () => {
    const dados = dadosPuerperalTeste();
    dados.evolucaoGeralTextoLivre = "Refere cansaço \u2014 sono fragmentado.";
    const conteudo = montarConteudoPuerperal(dados, textosPuerperalTeste);
    expect(auditarConteudo(conteudo)).toHaveLength(1);
  });

  it("acusa variável que sobrou sem preencher", () => {
    const dados = dadosPuerperalTeste();
    dados.evolucaoGeralTextoLivre = "Texto com {chave} esquecida.";
    const conteudo = montarConteudoPuerperal(dados, textosPuerperalTeste);
    expect(auditarConteudo(conteudo)).toHaveLength(1);
  });
});
