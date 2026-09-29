import type { MetricasAgente } from "../tipos";

/**
 * Números do mês da Isadora em frase (DESIGN.md, 11.10 "Painel que fala";
 * voz.md, seção 5). Uma linha por métrica: a frase com o número, a meta ao
 * lado e, quando a meta é mensurável, uma palavra de estado. Nenhuma grade
 * de KPI e nenhuma cor sem regra: `abaixo` e `na_meta` só existem porque a
 * meta do PRD 11.12 diz onde o número deveria estar.
 *
 * As metas repetem o PRD 11.12 e ainda moram aqui, como já moravam no
 * painel antigo; a pendência de levá-las para `parametro` está registrada
 * no retorno da sessão (docs/sessoes/acolhimento.md).
 */
export const METAS_AGENTE = {
  leadsQueRespondemPct: 85,
  qualificadosComValorEPdfPct: 100,
  conversasComEdilaineRegistradasPct: 100,
  followupAposPdfPct: 100,
  conversaoLeadsPct: 7,
} as const;

export type EstadoMeta = "na_meta" | "abaixo" | "sem_dado" | "sem_regra";

export interface LinhaMetrica {
  chave: string;
  /** Frase com o número; `numero` é o trecho que vai em mono. */
  antes: string;
  numero: string | null;
  depois: string;
  meta: string;
  estado: EstadoMeta;
  /** Nota de amostra pequena, quando o limiar existe e a base é menor. */
  nota?: string;
}

function porcento(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function estadoMinimo(valor: number | null, minimo: number): EstadoMeta {
  if (valor === null) return "sem_dado";
  return valor >= minimo ? "na_meta" : "abaixo";
}

export function linhasMetricas(
  m: MetricasAgente,
  /** `parametro` do limiar de amostra; null quando não existe ou não se lê. */
  limiarAmostra: number | null,
): LinhaMetrica[] {
  const linhas: LinhaMetrica[] = [];

  linhas.push(
    m.tempoPrimeiraRespostaMinutos === null
      ? {
          chave: "primeira_resposta",
          antes: "Sem dado da primeira resposta no período.",
          numero: null,
          depois: "",
          meta: "Meta: imediata",
          estado: "sem_dado",
        }
      : {
          chave: "primeira_resposta",
          antes: "A primeira resposta saiu em ",
          numero: `${m.tempoPrimeiraRespostaMinutos} min`,
          depois: ", em média.",
          meta: "Meta: imediata",
          estado: "sem_regra",
        },
  );

  const pctLinha = (
    chave: keyof typeof METAS_AGENTE,
    valor: number | null,
    frase: (numero: string) => [string, string],
    semDado: string,
    meta: string,
    zero?: string,
  ): LinhaMetrica => {
    if (valor === null) {
      return {
        chave,
        antes: semDado,
        numero: null,
        depois: "",
        meta,
        estado: "sem_dado",
      };
    }
    if (valor === 0 && zero) {
      return {
        chave,
        antes: zero,
        numero: null,
        depois: "",
        meta,
        estado: estadoMinimo(valor, METAS_AGENTE[chave]),
      };
    }
    const [antes, depois] = frase(porcento(valor));
    return {
      chave,
      antes,
      numero: porcento(valor),
      depois,
      meta,
      estado: estadoMinimo(valor, METAS_AGENTE[chave]),
    };
  };

  linhas.push(
    pctLinha(
      "leadsQueRespondemPct",
      m.leadsQueRespondemPct,
      () => ["", " dos leads responderam à mensagem de abertura."],
      "Sem dado de resposta à mensagem de abertura no período.",
      "Meta: 85% ou mais",
      "Nenhum lead respondeu à mensagem de abertura.",
    ),
  );
  linhas.push(
    pctLinha(
      "qualificadosComValorEPdfPct",
      m.qualificadosComValorEPdfPct,
      () => ["", " dos qualificados receberam valor e apresentação."],
      "Nenhuma família qualificada no período.",
      "Meta: todos",
      "Nenhum qualificado recebeu valor e apresentação.",
    ),
  );
  linhas.push(
    pctLinha(
      "conversasComEdilaineRegistradasPct",
      m.conversasComEdilaineRegistradasPct,
      () => ["", " das conversas com a Edilaine foram registradas, com data."],
      "Nenhuma conversa com a Edilaine prevista no período.",
      "Meta: todas, com data",
      "Nenhuma conversa com a Edilaine registrada no período.",
    ),
  );
  linhas.push(
    pctLinha(
      "followupAposPdfPct",
      m.followupAposPdfPct,
      () => ["", " das apresentações enviadas tiveram retomada."],
      "Nenhuma apresentação enviada no período.",
      "Meta: cadência completa em todas",
      "Nenhuma apresentação enviada teve retomada.",
    ),
  );

  const conversao = pctLinha(
    "conversaoLeadsPct",
    m.conversaoLeadsPct,
    () => [
      "",
      ` dos ${m.leadsTotal} ${m.leadsTotal === 1 ? "lead" : "leads"} do período fecharam contrato.`,
    ],
    "Sem dado de conversão no período.",
    "Meta: 7% ou mais",
    `Nenhum dos ${m.leadsTotal} leads do período fechou contrato.`,
  );
  // Abaixo do limiar de amostra, a porcentagem exagera (DESIGN.md, 11.10):
  // a frase já traz a contagem de leads, e a nota explica o porquê.
  if (
    limiarAmostra !== null &&
    m.conversaoLeadsPct !== null &&
    m.leadsTotal < limiarAmostra
  ) {
    conversao.nota = `Amostra pequena: com ${m.leadsTotal} ${m.leadsTotal === 1 ? "lead" : "leads"}, um contrato a mais ou a menos muda muito a porcentagem.`;
  }
  linhas.push(conversao);

  linhas.push(
    m.condicoesForaDaTabela === 0
      ? {
          chave: "condicoes",
          antes: "Nenhuma condição fora da tabela sem aprovação.",
          numero: null,
          depois: "",
          meta: "Meta: só com aprovação registrada",
          estado: "na_meta",
        }
      : {
          chave: "condicoes",
          antes: "",
          numero: String(m.condicoesForaDaTabela),
          depois:
            m.condicoesForaDaTabela === 1
              ? " condição fora da tabela sem aprovação registrada."
              : " condições fora da tabela sem aprovação registrada.",
          meta: "Meta: só com aprovação registrada",
          estado: "abaixo",
        },
  );

  return linhas;
}
