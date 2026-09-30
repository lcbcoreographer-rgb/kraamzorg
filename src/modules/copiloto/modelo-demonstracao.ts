import { atalhosDePeriodo } from "@/modules/marketing/periodo";
import type { EscolhaDoModelo, ModeloCopiloto } from "./orquestrador";
import { normalizar } from "./orquestrador";

/**
 * Modelo de demonstração do copiloto: NÃO é IA. Escolhe a função por palavras
 * da pergunta e monta o período por regras simples, e a "frase" é a lista de
 * fatos. Existe para o copiloto rodar e ser testado em desenvolvimento sem
 * chave nem custo (KZ_DADOS=demonstracao) e para os testes de aceite provarem
 * o caminho inteiro (catálogo, permissões, fatos, registro). Em produção e
 * homologação quem responde é o modelo da OpenAI (modelo-openai.ts), ou nada,
 * se a chave não estiver configurada.
 */
const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
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

const dois = (n: number) => String(n).padStart(2, "0");
const ultimoDia = (ano: number, mes: number) =>
  new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** Período dito na pergunta; nulos quando nenhum foi dito. */
export function periodoDaPergunta(
  pergunta: string,
  hoje: string,
): { desde: string | null; ate: string | null } {
  const t = normalizar(pergunta);
  const ano = Number(hoje.slice(0, 4));
  const atalhos = atalhosDePeriodo(hoje);
  if (/mes passado|mes anterior/.test(t)) return atalhos.mesPassado;
  if (/este mes|neste mes|mes atual|no mes/.test(t)) return atalhos.esteMes;
  if (/este ano|neste ano/.test(t))
    return { desde: `${ano}-01-01`, ate: `${ano}-12-31` };
  const indice = MESES.findIndex((m) => t.includes(m));
  if (indice >= 0) {
    const mes = indice + 1;
    return {
      desde: `${ano}-${dois(mes)}-01`,
      ate: `${ano}-${dois(mes)}-${dois(ultimoDia(ano, mes))}`,
    };
  }
  return { desde: null, ate: null };
}

export function criarModeloDemonstracao(): ModeloCopiloto {
  const semUso = { entrada: 0, saida: 0 };
  return {
    async escolher({ pergunta, hoje }): Promise<EscolhaDoModelo> {
      const t = normalizar(pergunta);
      const periodo = periodoDaPergunta(pergunta, hoje);
      if (
        /receita|faturamento|faturou|recebido|pagamento|vencid|em aberto/.test(
          t,
        )
      ) {
        return {
          tipo: "ferramenta",
          ferramenta: "copiloto_receita",
          parametros: periodo,
          uso: semUso,
        };
      }
      if (/ocupacao|capacidade|lotacao|vagas|sobrevenda/.test(t)) {
        return {
          tipo: "ferramenta",
          ferramenta: "copiloto_ocupacao",
          parametros: {},
          uso: semUso,
        };
      }
      if (/origem|canal|instagram|anuncio|google|indicacao|de onde/.test(t)) {
        return {
          tipo: "ferramenta",
          ferramenta: "copiloto_leads_origem",
          parametros: periodo,
          uso: semUso,
        };
      }
      if (
        /conversao|funil|taxa|qualificad|leads?\b|ganhos?|perdid|contratos?/.test(
          t,
        )
      ) {
        return {
          tipo: "ferramenta",
          ferramenta: "copiloto_conversao",
          parametros: periodo,
          uso: semUso,
        };
      }
      if (/pipeline|estagio|oportunidade|etapa/.test(t)) {
        return {
          tipo: "ferramenta",
          ferramenta: "copiloto_pipeline",
          parametros: {
            pipeline: /pipeline 2|venda|proposta|contrato gerado/.test(t)
              ? 2
              : 1,
          },
          uso: semUso,
        };
      }
      return {
        tipo: "recusa",
        motivo: "fora do que o copiloto consulta",
        uso: semUso,
      };
    },
    async redigir({ fatos }) {
      return { texto: fatos.join(" "), uso: semUso };
    },
  };
}
