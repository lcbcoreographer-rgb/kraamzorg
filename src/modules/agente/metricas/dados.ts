import "server-only";
import { obterMetricas } from "../repositorio";
import type { MetricasAgente } from "../tipos";

/**
 * Métricas do agente (P27 item 5, PRD 11.12): tempo da primeira resposta,
 * leads que respondem à abertura, qualificados que recebem valor e PDF,
 * conversas com a Edilaine registradas, follow-up após o PDF, conversão de
 * leads e condições fora da tabela. Todas saem do banco (`mensagem`,
 * `oportunidade`, `handoff`, `sessao_venda`, `condicao_comercial`, PRD
 * 11.12) por uma função `api.metricas_agente(desde, ate)` que ainda não
 * existe (0012 a 0014, ver `repositorio.ts`); as consultas abaixo são a
 * proposta para essa função, uma por indicador.
 *
 * ```sql
 * -- Tempo da primeira resposta: da primeira mensagem de entrada de uma
 * -- conversa lead até a primeira saída (Isadora ou humano), em minutos.
 * select avg(extract(epoch from (primeira_saida.enviada_em - primeira_entrada.enviada_em)) / 60)
 * from conversa c
 * join lateral (
 *   select enviada_em from mensagem where conversa_id = c.id and direcao = 'entrada'
 *   order by enviada_em limit 1
 * ) primeira_entrada on true
 * join lateral (
 *   select enviada_em from mensagem where conversa_id = c.id and direcao = 'saida'
 *     and enviada_em > primeira_entrada.enviada_em
 *   order by enviada_em limit 1
 * ) primeira_saida on true
 * where c.classificacao in ('lead','cliente','nao_classificado')
 *   and c.criado_em between :desde and :ate;
 *
 * -- Leads que respondem à abertura: % de conversas lead com pelo menos
 * -- uma mensagem de entrada (a família escreveu de volta).
 * select
 *   count(*) filter (where existe_entrada) * 100.0 / nullif(count(*), 0)
 * from (
 *   select c.id,
 *     exists (select 1 from mensagem m where m.conversa_id = c.id and m.direcao = 'entrada') as existe_entrada
 *   from conversa c
 *   where c.classificacao in ('lead','cliente','nao_classificado')
 *     and c.criado_em between :desde and :ate
 * ) base;
 *
 * -- Qualificados que recebem valor e PDF: % de oportunidades que saem de
 * -- 'novo' com pdf_enviado_em preenchido.
 * select
 *   count(*) filter (where pdf_enviado_em is not null) * 100.0 / nullif(count(*), 0)
 * from oportunidade
 * where pipeline = 1 and estagio_p1 is distinct from 'novo'
 *   and criado_em between :desde and :ate;
 *
 * -- Conversas com a Edilaine registradas: % de oportunidades qualificadas
 * -- com pelo menos uma sessao_venda registrada (agendada ou realizada).
 * select
 *   count(distinct sv.familia_id) * 100.0 / nullif(count(distinct o.familia_id), 0)
 * from oportunidade o
 * left join sessao_venda sv on sv.familia_id = o.familia_id
 * where o.pipeline = 1 and o.estagio_p1 in
 *   ('qualificado','sessao_venda_agendada','sessao_venda_realizada')
 *   and o.criado_em between :desde and :ate;
 *
 * -- Follow-up após o PDF: % de oportunidades com pdf_enviado_em que têm
 * -- handoff ou mensagem de saída depois do envio (a régua rodou).
 * select
 *   count(*) filter (where existe_followup) * 100.0 / nullif(count(*), 0)
 * from (
 *   select o.id, o.pdf_enviado_em,
 *     exists (
 *       select 1 from mensagem m
 *       join conversa c on c.id = m.conversa_id
 *       where c.familia_id = o.familia_id and m.direcao = 'saida'
 *         and m.enviada_em > o.pdf_enviado_em
 *     ) as existe_followup
 *   from oportunidade o
 *   where o.pdf_enviado_em is not null
 *     and o.criado_em between :desde and :ate
 * ) base;
 *
 * -- Conversão de leads: % de oportunidades do pipeline 1 que chegam a
 * -- pipeline 2 (qualquer estagio_p2 preenchido).
 * select
 *   count(*) filter (where existe_p2) * 100.0 / nullif(count(*), 0)
 * from (
 *   select o.id,
 *     exists (
 *       select 1 from oportunidade o2
 *       where o2.familia_id = o.familia_id and o2.pipeline = 2
 *     ) as existe_p2
 *   from oportunidade o
 *   where o.pipeline = 1 and o.criado_em between :desde and :ate
 * ) base;
 *
 * -- Condições fora da tabela: contratos com desconto_pct diferente do que
 * -- condicao_comercial permite sem aprovação, ou sem desconto_aprovado_por.
 * select count(*)
 * from oportunidade
 * where desconto_pct > 0 and desconto_aprovado_por is null
 *   and criado_em between :desde and :ate;
 * ```
 */
export async function obterMetricasTela(
  desde: string,
  ate: string,
): Promise<MetricasAgente> {
  return obterMetricas(desde, ate);
}

/** Últimos 30 dias, no fuso de Brasília (padrão da tela). */
export function periodoPadrao(agora: Date = new Date()): { desde: string; ate: string } {
  const ate = agora.toISOString().slice(0, 10);
  const desdeData = new Date(agora);
  desdeData.setDate(desdeData.getDate() - 30);
  return { desde: desdeData.toISOString().slice(0, 10), ate };
}
