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
 * -- Atenção ao modelo (0003): `oportunidade` tem uma linha por família
 * -- (índice único parcial) que muda de pipeline 1 para 2 na mesma linha;
 * -- quem já foi para o pipeline 2 não aparece mais com pipeline = 1.
 *
 * -- Qualificados que recebem valor e PDF: % das oportunidades que
 * -- chegaram a qualificado (ou já passaram ao pipeline 2) com
 * -- pdf_enviado_em preenchido.
 * select
 *   count(*) filter (where pdf_enviado_em is not null) * 100.0 / nullif(count(*), 0)
 * from oportunidade
 * where (pipeline = 2 or estagio_p1 in
 *         ('qualificado','sessao_venda_agendada','sessao_venda_realizada'))
 *   and criado_em between :desde and :ate;
 *
 * -- Conversas com a Edilaine registradas: % das oportunidades
 * -- qualificadas (mesmo recorte acima) com sessao_venda registrada e com
 * -- data (agendada_para ou realizada_em).
 * select
 *   count(*) filter (where exists (
 *     select 1 from sessao_venda sv
 *     where sv.familia_id = o.familia_id
 *       and coalesce(sv.realizada_em, sv.agendada_para) is not null
 *   )) * 100.0 / nullif(count(*), 0)
 * from oportunidade o
 * where (o.pipeline = 2 or o.estagio_p1 in
 *         ('qualificado','sessao_venda_agendada','sessao_venda_realizada'))
 *   and o.criado_em between :desde and :ate;
 *
 * -- Follow-up após o PDF: % das oportunidades com pdf_enviado_em em que a
 * -- família não respondeu e houve saída depois do silêncio (retomada da
 * -- Isadora ou tarefa D+3/D+14 cumprida). Aproximação por mensagem de
 * -- saída posterior ao PDF; a medida exata da "cadência completa" pede o
 * -- histórico de automacao_execucao (followup_d1) e de tarefa
 * -- (followup_comercial), a combinar com a trilha do banco.
 * select
 *   count(*) filter (where existe_followup) * 100.0 / nullif(count(*), 0)
 * from (
 *   select o.id,
 *     exists (
 *       select 1 from mensagem m
 *       join conversa c on c.id = m.conversa_id
 *       where c.familia_id = o.familia_id and m.direcao = 'saida'
 *         and m.enviada_em > o.pdf_enviado_em + interval '1 hour'
 *     ) as existe_followup
 *   from oportunidade o
 *   where o.pdf_enviado_em is not null
 *     and o.criado_em between :desde and :ate
 * ) base;
 *
 * -- Conversão de leads: % das oportunidades do período que chegaram a
 * -- ganho ou adiante no pipeline 2 (sem perdido, cancelado, distrato).
 * select
 *   count(*) filter (where pipeline = 2 and estagio_p2 not in
 *     ('proposta_enviada','em_negociacao','perdido','cancelado','distrato'))
 *   * 100.0 / nullif(count(*), 0)
 * from oportunidade
 * where criado_em between :desde and :ate;
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
export function periodoPadrao(agora: Date = new Date()): {
  desde: string;
  ate: string;
} {
  const diaBrasilia = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const desdeData = new Date(agora.getTime() - 30 * 24 * 60 * 60_000);
  return { desde: diaBrasilia(desdeData), ate: diaBrasilia(agora) };
}
