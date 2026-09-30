import { z } from "zod";
import type { Json } from "@/lib/db/types";
import {
  FERRAMENTAS_COPILOTO,
  type NomeFerramentaCopiloto,
} from "@/lib/dados/tipos-relacao";
import { rotuloEstagio } from "@/modules/crm/pipeline/estagios";
import { ROTULO_ORIGEM } from "@/modules/relacao/rotulos";
import { formatarData, formatarMoeda } from "@/lib/formatacao";

/**
 * O conjunto fechado de funções de leitura que o copiloto pode chamar (P48).
 * O modelo escolhe uma destas cinco e devolve os parâmetros; o servidor
 * valida os parâmetros aqui e chama a função api.* de mesmo nome, sempre com
 * as permissões de quem perguntou. O modelo nunca escreve SQL e nenhuma
 * destas funções lê registro assistencial.
 */

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data aaaa-mm-dd");
const periodo = z.object({
  desde: data.nullish().transform((v) => v ?? null),
  ate: data.nullish().transform((v) => v ?? null),
});

export interface FerramentaCopiloto {
  nome: NomeFerramentaCopiloto;
  /** Para o modelo escolher (função e parâmetros). */
  descricao: string;
  esquema: z.ZodType<Record<string, Json>>;
  /** Esquema JSON dos parâmetros, no formato de function calling. */
  parametrosJson: Record<string, unknown>;
  /** Fatos em frases, calculados só do resultado (sem modelo). */
  resumir(resultado: Json): string[];
}

type Objeto = Record<string, Json | undefined>;
const objeto = (v: Json | undefined): Objeto =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : {};
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const numero = (v: Json | undefined): number => (typeof v === "number" ? v : 0);
const texto = (v: Json | undefined): string => (typeof v === "string" ? v : "");

const PORCENTO = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct = (v: number) => `${PORCENTO.format(v)}%`;
const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/** "em todo o período", "de 01/09/2026 a 30/09/2026", "desde ..." ou "até ...". */
export function frasePeriodo(r: Objeto): string {
  const desde = texto(r.desde);
  const ate = texto(r.ate);
  if (desde && ate) return `de ${formatarData(desde)} a ${formatarData(ate)}`;
  if (desde) return `desde ${formatarData(desde)}`;
  if (ate) return `até ${formatarData(ate)}`;
  return "em todo o período";
}

const mesPorExtenso = (iso: string) => {
  const [ano, mes] = iso.split("-");
  const nomes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${nomes[Number(mes) - 1] ?? mes} de ${ano}`;
};

const esquemaPeriodoJson = {
  type: "object",
  properties: {
    desde: {
      type: ["string", "null"],
      description: "Primeiro dia do período, aaaa-mm-dd. Nulo = sem limite.",
    },
    ate: {
      type: ["string", "null"],
      description: "Último dia do período, aaaa-mm-dd. Nulo = sem limite.",
    },
  },
  additionalProperties: false,
};

export const CATALOGO: Record<NomeFerramentaCopiloto, FerramentaCopiloto> = {
  copiloto_pipeline: {
    nome: "copiloto_pipeline",
    descricao:
      "Quantas oportunidades há em cada estágio de um pipeline (1 = entrada e qualificação, 2 = venda e pré-atendimento).",
    esquema: z.object({
      pipeline: z.union([z.literal(1), z.literal(2)]).default(1),
    }),
    parametrosJson: {
      type: "object",
      properties: {
        pipeline: { type: "integer", enum: [1, 2], description: "1 ou 2." },
      },
      additionalProperties: false,
    },
    resumir(resultado) {
      const r = objeto(resultado);
      const pipeline = numero(r.pipeline) === 2 ? 2 : 1;
      const estagios = lista(r.estagios).map(objeto);
      const total = numero(r.total);
      const fatos = [
        `O pipeline ${pipeline} (${pipeline === 1 ? "entrada e qualificação" : "venda e pré-atendimento"}) tem ${plural(total, "oportunidade", "oportunidades")}.`,
      ];
      if (estagios.length > 0) {
        fatos.push(
          `Por estágio: ${estagios
            .map(
              (e) =>
                `${rotuloEstagio(pipeline, texto(e.estagio) as never)} ${numero(e.oportunidades)}`,
            )
            .join("; ")}.`,
        );
      }
      return fatos;
    },
  },

  copiloto_conversao: {
    nome: "copiloto_conversao",
    descricao:
      "Funil de conversão das famílias que entraram no período: leads, qualificados, sessões de venda realizadas, ganhos, perdidos e as taxas.",
    esquema: periodo,
    parametrosJson: esquemaPeriodoJson,
    resumir(resultado) {
      const r = objeto(resultado);
      const leads = numero(r.leads);
      if (leads === 0) return [`Nenhum lead entrou ${frasePeriodo(r)}.`];
      const fatos = [
        `${plural(leads, "lead entrou", "leads entraram")} ${frasePeriodo(r)}: ${numero(r.qualificados)} qualificados${typeof r.taxa_qualificacao_pct === "number" ? ` (${pct(r.taxa_qualificacao_pct)})` : ""}, ${numero(r.sessoes_realizadas)} com sessão de venda realizada e ${numero(r.ganhos)} com contrato${typeof r.taxa_ganho_pct === "number" ? ` (${pct(r.taxa_ganho_pct)})` : ""}.`,
      ];
      if (numero(r.perdidos) > 0)
        fatos.push(`${plural(numero(r.perdidos), "perdido", "perdidos")}.`);
      return fatos;
    },
  },

  copiloto_receita: {
    nome: "copiloto_receita",
    descricao:
      "Receita paga (pagamentos confirmados) no período, por mês, com o que segue em aberto e vencido. Só financeiro e diretoria têm acesso.",
    esquema: periodo,
    parametrosJson: esquemaPeriodoJson,
    resumir(resultado) {
      const r = objeto(resultado);
      const fatos = [
        `Pagamentos confirmados ${frasePeriodo(r)}: ${formatarMoeda(numero(r.pago_centavos))}, de ${plural(numero(r.contratos_pagos), "contrato", "contratos")}.`,
      ];
      const meses = lista(r.por_mes).map(objeto);
      if (meses.length > 1) {
        fatos.push(
          `Por mês: ${meses.map((m) => `${mesPorExtenso(texto(m.mes))} ${formatarMoeda(numero(m.pago_centavos))}`).join("; ")}.`,
        );
      }
      fatos.push(
        `Em aberto: ${formatarMoeda(numero(r.em_aberto_centavos))}; vencido: ${formatarMoeda(numero(r.vencido_centavos))}.`,
      );
      return fatos;
    },
  },

  copiloto_ocupacao: {
    nome: "copiloto_ocupacao",
    descricao:
      "Ocupação projetada da capacidade por praça e semana, a partir de uma segunda-feira (padrão: a semana atual), por até 26 semanas.",
    esquema: z.object({
      semana_desde: data.nullish().transform((v) => v ?? null),
      semanas: z
        .number()
        .int()
        .min(1)
        .max(26)
        .nullish()
        .transform((v) => v ?? 8),
    }),
    parametrosJson: {
      type: "object",
      properties: {
        semana_desde: {
          type: ["string", "null"],
          description:
            "Segunda-feira inicial, aaaa-mm-dd. Nulo = semana atual.",
        },
        semanas: {
          type: ["integer", "null"],
          description: "Quantas semanas mostrar, de 1 a 26. Padrão 8.",
        },
      },
      additionalProperties: false,
    },
    resumir(resultado) {
      const r = objeto(resultado);
      const itens = lista(r.itens).map(objeto);
      const alerta = typeof r.alerta_pct === "number" ? r.alerta_pct : null;
      if (itens.length === 0)
        return [
          `Sem ocupação projetada a partir de ${formatarData(texto(r.de))}.`,
        ];
      const maior = itens.reduce((a, b) =>
        numero(b.ocupacao_pct) > numero(a.ocupacao_pct) ? b : a,
      );
      const fatos = [
        `Ocupação projetada por ${plural(numero(r.semanas), "semana", "semanas")} a partir de ${formatarData(texto(r.de))}: a maior é ${pct(numero(maior.ocupacao_pct))}, em ${texto(maior.regiao)}, na semana de ${formatarData(texto(maior.semana))}.`,
      ];
      if (alerta !== null) {
        const acima = itens.filter((i) => numero(i.ocupacao_pct) >= alerta);
        fatos.push(
          acima.length === 0
            ? `Nenhuma praça chega ao limite de alerta de ${pct(alerta)}.`
            : `Chegam ao limite de alerta de ${pct(alerta)}: ${acima.map((i) => `${texto(i.regiao)} na semana de ${formatarData(texto(i.semana))} (${pct(numero(i.ocupacao_pct))})`).join("; ")}.`,
        );
      }
      return fatos;
    },
  },

  copiloto_leads_origem: {
    nome: "copiloto_leads_origem",
    descricao:
      "Leads, qualificados e ganhos por origem (Instagram, anúncios, indicação, site...) das famílias que entraram no período.",
    esquema: periodo,
    parametrosJson: esquemaPeriodoJson,
    resumir(resultado) {
      const r = objeto(resultado);
      const itens = lista(r.itens).map(objeto);
      if (itens.length === 0) return [`Nenhum lead entrou ${frasePeriodo(r)}.`];
      const total = itens.reduce((s, i) => s + numero(i.leads), 0);
      return [
        `${plural(total, "lead entrou", "leads entraram")} ${frasePeriodo(r)}.`,
        `Por origem: ${itens
          .map(
            (i) =>
              `${ROTULO_ORIGEM[texto(i.origem) as keyof typeof ROTULO_ORIGEM] ?? texto(i.origem)} ${numero(i.leads)} (${numero(i.qualificados)} qualificados, ${numero(i.ganhos)} com contrato)`,
          )
          .join("; ")}.`,
      ];
    },
  },
};

export function ehFerramenta(nome: string): nome is NomeFerramentaCopiloto {
  return (FERRAMENTAS_COPILOTO as readonly string[]).includes(nome);
}
