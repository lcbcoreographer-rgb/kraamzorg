/**
 * Conteúdo da evolução neonatal (PRD 9.5, tabela "Evolução de Enfermagem
 * Neonatal"), um por bebê. Mesma disciplina do puerperal
 * (`conteudo-puerperal.ts`): dado calculável entra direto, texto que se
 * repete entre casos vem de `mensagem_modelo`.
 *
 * Concordância de gênero (PRD 9.5): todo trecho que descreve o bebê passa
 * por `preencherTextoPorSexo`, que usa `{chave}_masculino` ou
 * `{chave}_feminino` quando existe e a chave neutra só na falta dela. As
 * duas formas são escritas no seed, nunca no código: é assim que "filho",
 * "nascido", "calmo" e "eupneico" deixam de sair no masculino para uma
 * menina, o erro mais comum das evoluções reais (docs/analise-evolucoes.md).
 *
 * Chaves usadas em `textos` (todas aceitam o sufixo `_masculino`/`_feminino`):
 * - `evo_neo_identificacao` {sexo, dia_vida, tipo_parto, filiacao}
 * - `evo_neo_estado_geral` {reatividade, mucosas, temp_min, temp_max, fontanela}
 * - `evo_neo_ictericia` {zona, zona_maxima?, tendencia?, intensidade?}
 * - `evo_neo_respiratorio` {fr_min, fr_max, esforco}
 * - `evo_neo_cardiovascular` {fc_min, fc_max}
 * - `evo_neo_abdomen_coto` {estado_coto}
 * - `evo_neo_alimentacao_exclusivo` / `_misto` / `_complemento` {succao, complemento_ml?}
 * - `evo_neo_genitalia` (na prática sempre por sexo)
 * - `evo_neo_eliminacoes` (só quando diurese e evacuações estão presentes)
 * - `evo_neo_conclusao` {aleitamento, evolucao_peso, estado_ictericia}
 * - `evo_neo_conclusao_aleitamento_exclusivo` / `_misto` / `_complemento`
 * - `evo_neo_conclusao_peso_progressivo` / `_estavel` / `_perda`
 * - `evo_neo_conclusao_ictericia_ausente` / `_regressao` / `_presente`
 *
 * [clínico, K-01] Genitália, mucosas, fontanela, abdômen e SpO2 não têm
 * campo no checklist: aqui o texto-padrão aprovado entra no rascunho, e a
 * enfermeira edita na onda B antes da aprovação (`conteudo.ts`).
 */
import {
  campo,
  lista,
  paragrafo,
  type Bloco,
  type ConteudoEvolucao,
  type SecaoConteudo,
} from "./conteudo";
import { calcularCurvaPeso, calcularDiaDeVida } from "./curva-peso";
import { dataBr, faixaBr, numeroBr, zonaRomana } from "./formatar";
import { preencherTextoPorSexo, type Variaveis } from "./textos";
import type {
  DadosEvolucaoNeonatal,
  OrigemPesagem,
  TextosModelo,
  TipoParto,
} from "./tipos";

const ROTULO_TIPO_PARTO: Record<TipoParto, string> = {
  vaginal: "normal",
  cesarea: "cesárea",
};

const ROTULO_ORIGEM_PESAGEM: Record<OrigemPesagem, string> = {
  alta_hospitalar: "alta hospitalar",
  domicilio: "domicílio",
  pediatra: "pediatra",
};

const ROTULO_TENDENCIA: Record<
  NonNullable<NonNullable<DadosEvolucaoNeonatal["ictericia"]>["tendencia"]>,
  string
> = {
  estavel: "estável",
  regressao: "em regressão",
  progressao: "em progressão",
};

function gramas(valor: number): string {
  return `${numeroBr(valor)} g`;
}

export function montarConteudoNeonatal(
  dados: DadosEvolucaoNeonatal,
  textos: TextosModelo,
): ConteudoEvolucao {
  const sexo = dados.bebe.sexo;
  const texto = (chave: string, variaveis: Variaveis = {}) =>
    preencherTextoPorSexo(chave, textos, sexo, variaveis);
  const secoes: SecaoConteudo[] = [];

  secoes.push({
    titulo: "Período de acompanhamento",
    blocos: [
      paragrafo(
        `${dataBr(dados.periodo.inicio)} a ${dataBr(dados.periodo.fim)} (Kraamzorg Brasil)`,
      ),
    ],
  });

  const identificacao: Bloco[] = [];
  if (dados.bebe.nome) identificacao.push(campo("RN", dados.bebe.nome));
  identificacao.push(
    paragrafo(
      texto("evo_neo_identificacao", {
        sexo,
        dia_vida: calcularDiaDeVida(
          dados.bebe.dataNascimento,
          dados.periodo.fim,
        ),
        tipo_parto: ROTULO_TIPO_PARTO[dados.bebe.tipoParto],
        filiacao: dados.filiacao.join(" e "),
      }),
    ),
    campo("Data do documento", dataBr(dados.dataEmissao)),
  );
  secoes.push({ titulo: "Identificação", blocos: identificacao });

  const curva = calcularCurvaPeso(
    dados.bebe.pesoNascimentoG,
    dados.bebe.dataNascimento,
    dados.pesagens,
  );
  const blocosPeso: Bloco[] = [
    campo(
      "Peso ao nascer",
      `${gramas(curva.pesoNascimentoG)} (${dataBr(dados.bebe.dataNascimento)})`,
    ),
  ];
  for (const ponto of curva.pontos) {
    if (ponto.origem === "nascimento") continue;
    blocosPeso.push(
      campo(
        `Peso em ${dataBr(ponto.data)}`,
        `${gramas(ponto.pesoG)} (${ROTULO_ORIGEM_PESAGEM[ponto.origem]}), dia de vida ${ponto.diaVida}`,
      ),
    );
  }
  blocosPeso.push(
    campo(
      "Menor peso",
      `${gramas(curva.menorPesoG)} em ${dataBr(curva.dataMenorPeso)}, dia de vida ${curva.diaVidaMenorPeso}`,
    ),
    campo(
      "Perda em relação ao nascimento",
      `${numeroBr(curva.perdaPercentual)}%`,
    ),
  );
  if (curva.diasEntreMenorEFinal > 0) {
    blocosPeso.push(
      campo(
        "Ganho desde o menor peso",
        `${gramas(curva.ganhoAbsolutoG)} em ${curva.diasEntreMenorEFinal} dias; ganho médio de ${numeroBr(curva.ganhoMedioDiarioGDia)} g/dia`,
      ),
    );
  }
  secoes.push({ titulo: "Curva de peso", blocos: blocosPeso });

  secoes.push({
    titulo: "Estado geral",
    blocos: [
      paragrafo(
        texto("evo_neo_estado_geral", {
          reatividade: dados.estadoGeral.reatividade,
          mucosas: dados.estadoGeral.mucosas,
          temp_min: numeroBr(dados.estadoGeral.temperatura.min),
          temp_max: numeroBr(dados.estadoGeral.temperatura.max),
          fontanela: dados.estadoGeral.fontanela,
        }),
      ),
    ],
  });

  const ictericia = dados.ictericia;
  if (ictericia) {
    const variaveis: Variaveis = { zona: zonaRomana(ictericia.zonaKramer) };
    const blocos: Bloco[] = [];
    if (ictericia.zonaMaxima !== undefined) {
      variaveis.zona_maxima = zonaRomana(ictericia.zonaMaxima);
    }
    if (ictericia.tendencia !== undefined) {
      variaveis.tendencia = ROTULO_TENDENCIA[ictericia.tendencia];
    }
    if (ictericia.intensidade !== undefined) {
      variaveis.intensidade = ictericia.intensidade;
    }
    blocos.push(paragrafo(texto("evo_neo_ictericia", variaveis)));
    if (ictericia.zonaMaxima !== undefined) {
      blocos.push(
        campo("Zona máxima de Kramer", zonaRomana(ictericia.zonaMaxima)),
      );
    }
    blocos.push(
      campo("Zona final de Kramer", zonaRomana(ictericia.zonaKramer)),
    );
    if (ictericia.tendencia !== undefined) {
      blocos.push(campo("Tendência", ROTULO_TENDENCIA[ictericia.tendencia]));
    }
    secoes.push({ titulo: "Icterícia", blocos });
  }

  secoes.push({
    titulo: "Sistema respiratório",
    blocos: [
      paragrafo(
        texto("evo_neo_respiratorio", {
          fr_min: numeroBr(dados.respiratorio.fr.min),
          fr_max: numeroBr(dados.respiratorio.fr.max),
          esforco: dados.respiratorio.esforco,
        }),
      ),
    ],
  });

  const blocosCardio: Bloco[] = [
    paragrafo(
      texto("evo_neo_cardiovascular", {
        fc_min: numeroBr(dados.cardiovascular.fc.min),
        fc_max: numeroBr(dados.cardiovascular.fc.max),
      }),
    ),
  ];
  if (dados.cardiovascular.spo2) {
    blocosCardio.push(campo("SpO2", `${faixaBr(dados.cardiovascular.spo2)}%`));
  }
  secoes.push({ titulo: "Aparelho cardiovascular", blocos: blocosCardio });

  const blocosCoto: Bloco[] = [
    paragrafo(
      texto("evo_neo_abdomen_coto", {
        estado_coto: dados.abdomeCoto.estadoCoto,
      }),
    ),
  ];
  if (dados.abdomeCoto.dataQueda) {
    blocosCoto.push(campo("Queda do coto", dataBr(dados.abdomeCoto.dataQueda)));
  }
  secoes.push({ titulo: "Abdômen e coto umbilical", blocos: blocosCoto });

  const alimentacao = dados.alimentacao;
  const variaveisAlimentacao: Variaveis = { succao: alimentacao.succao };
  if (alimentacao.complementoMl !== undefined) {
    variaveisAlimentacao.complemento_ml = numeroBr(alimentacao.complementoMl);
  }
  const blocosAlimentacao: Bloco[] = [
    paragrafo(
      texto(`evo_neo_alimentacao_${alimentacao.tipo}`, variaveisAlimentacao),
    ),
  ];
  if (alimentacao.complementoMl !== undefined) {
    blocosAlimentacao.push(
      campo("Complemento", `${numeroBr(alimentacao.complementoMl)} ml`),
    );
  }
  secoes.push({ titulo: "Alimentação", blocos: blocosAlimentacao });

  // Eliminações: a frase-padrão ("diurese e evacuações presentes") só
  // quando as duas estão presentes; qualquer ausência sai como dado, para
  // o documento nunca afirmar e negar a mesma coisa.
  const { diurese, evacuacoes } = dados.genitaliaEliminacoes;
  const blocosGenitalia: Bloco[] = [paragrafo(texto("evo_neo_genitalia"))];
  if (diurese && evacuacoes) {
    blocosGenitalia.push(paragrafo(texto("evo_neo_eliminacoes")));
  } else {
    blocosGenitalia.push(
      campo("Diurese", diurese ? "presente" : "ausente"),
      campo("Evacuações", evacuacoes ? "presentes" : "ausentes"),
    );
  }
  secoes.push({ titulo: "Genitália e eliminações", blocos: blocosGenitalia });

  if (dados.orientacoesCondutas.length > 0) {
    secoes.push({
      titulo: "Orientações e condutas",
      blocos: [lista(dados.orientacoesCondutas)],
    });
  }

  const conclusao = dados.conclusao;
  const blocosConclusao: Bloco[] = [
    paragrafo(
      texto("evo_neo_conclusao", {
        aleitamento: texto(
          `evo_neo_conclusao_aleitamento_${conclusao.aleitamento}`,
        ),
        evolucao_peso: texto(`evo_neo_conclusao_peso_${conclusao.ganhoPeso}`),
        estado_ictericia: texto(
          `evo_neo_conclusao_ictericia_${conclusao.ictericia}`,
        ),
      }),
    ),
  ];
  if (conclusao.vinculoTexto) {
    blocosConclusao.push(paragrafo(conclusao.vinculoTexto));
  }
  secoes.push({ titulo: "Conclusão", blocos: blocosConclusao });

  if (dados.contatoPediatra) {
    secoes.push({
      titulo: "Contato médico",
      blocos: [campo("Pediatra", dados.contatoPediatra.nome)],
    });
  }

  const { nome, especialidade, conselho, conselhoUf, conselhoNumero } =
    dados.profissional;
  return {
    tipo: "neonatal",
    secoes,
    assinatura: { nome, especialidade, conselho, conselhoUf, conselhoNumero },
  };
}
