# Painel executivo: consulta de cada número

P52 · PRD 16.2 (Fase 3) · `api.painel_executivo(mes)` da migration `0026_gestao.sql`.

A diretoria responde às cinco perguntas sem pedir relatório a ninguém: comercial, marketing, operação, experiência e financeiro. Cada número abaixo tem a consulta que o calcula, a tela onde o mesmo número aparece e o teste que o confere contra a tabela de origem. Se um número do painel e o da tela de origem divergirem, o teste falha.

Os testes:

- **pgTAP** `supabase/tests/026_gestao.sql`, seção "P52": para cada número, uma consulta escrita à parte, direto nas tabelas, contra o que `api.painel_executivo` devolve. A linha `@indicadores:` do arquivo lista os 35 números; o teste `painel devolve exatamente os 35 indicadores` falha se o banco devolver um a mais ou a menos.
- **Vitest** `src/lib/gestao/painel.test.ts`: a mesma conta em TypeScript (a que o modo demonstração usa) sobre o mesmo cenário sintético, mais a conferência de que este documento, o registro `INDICADORES` (`src/lib/gestao/painel.ts`) e a linha `@indicadores:` do pgTAP têm os mesmos números.

Regras comuns:

- **Mês.** O painel é de um mês (`mes` é qualquer dia dele; padrão o mês atual em `America/Sao_Paulo`). Data de instante (`criado_em`, `assinado_em`, `realizada_em`, `pago_em`, `pesquisa_respondida_em`) entra pelo dia em São Paulo. Data de calendário (`visita.data`, `inicio_efetivo`, `despesa.data`) entra como está.
- **Só agregado.** O painel não devolve nome de família, dado assistencial nem texto de conversa. Só a diretoria abre (papel e AAL2 conferidos dentro da função).
- **Valor em centavos.** Percentual com uma casa decimal; sem denominador, o número é nulo e a tela diz que ainda não há base para calcular.
- **Metas** (`parametro.metas_kraamzorg`): 18 contratos por mês, 18 famílias por mês, R$ 75.600 de faturamento por mês e NPS 90. Progresso: contratos = `comercial.contratos_assinados`, famílias = `operacao.familias_iniciadas`, faturamento = `comercial.faturamento_centavos`, NPS = `experiencia.nps`.
- **Congelamento** (`parametro.congelamento_desenvolvimento`): data e tag da versão candidata; a função devolve os dias que faltam. O procedimento está em `docs/congelamento.md`.

## Comercial

Função: `privado.painel_comercial(de, ate_exclusivo)`. Tela de origem: pipeline (`/pipeline`) e sessões de venda (`/sessoes-venda`).

### `comercial.leads`

Famílias criadas no mês, sem as mescladas (`familia.mesclada_em_id is null`).

```sql
select count(*) from public.familia
where mesclada_em_id is null
  and (criado_em at time zone 'America/Sao_Paulo')::date >= :de
  and (criado_em at time zone 'America/Sao_Paulo')::date <  :ate;
```

### `comercial.sessoes_realizadas`

Sessões de venda com `status = 'realizada'` e `realizada_em` no mês.

```sql
select count(*) from public.sessao_venda
where status = 'realizada'
  and (realizada_em at time zone 'America/Sao_Paulo')::date >= :de
  and (realizada_em at time zone 'America/Sao_Paulo')::date <  :ate;
```

### `comercial.contratos_assinados`

Contratos com `status = 'assinado'` e `assinado_em` no mês.

```sql
select count(*) from public.contrato
where status = 'assinado'
  and (assinado_em at time zone 'America/Sao_Paulo')::date >= :de
  and (assinado_em at time zone 'America/Sao_Paulo')::date <  :ate;
```

### `comercial.conversao_pct`

Contratos assinados no mês sobre leads do mês, com uma casa. Nulo sem leads. É a conversão do mês (não acompanha a mesma coorte de famílias): serve para o ritmo, e a conversão por coorte fica na tela do pipeline.

```sql
round(100.0 * contratos_assinados / nullif(leads, 0), 1)
```

### `comercial.faturamento_centavos`

Valor menos desconto mais taxa de deslocamento dos contratos assinados no mês (a mesma conta de `privado.venda_conta` e da cobrança).

```sql
select coalesce(sum(valor_centavos - desconto_centavos + taxa_deslocamento_centavos), 0)
from public.contrato where status = 'assinado' and /* assinado_em no mês */;
```

### `comercial.ticket_medio_centavos`

Faturamento do mês sobre os contratos assinados no mês, arredondado. Nulo sem contrato.

## Marketing

Função: `privado.painel_marketing(de, ate_exclusivo)`. Tela de origem: financeiro (`/financeiro`) e despesas (`/financeiro/despesas`). O detalhe por campanha nasce do código de origem do link `wa.me` (P47); enquanto o P47 não grava o código, a lista de campanhas fica vazia.

### `marketing.leads_por_origem`

Os leads do mês agrupados por `familia.origem`, do maior para o menor.

### `marketing.custo_por_canal`

Despesas `marketing_anuncios` do mês, não removidas, agrupadas por `despesa.canal` (origem do lead a que o gasto se refere). Despesa sem canal aparece com canal nulo.

```sql
select canal, sum(valor_centavos) from privado.despesa
where removida_em is null and categoria = 'marketing_anuncios' and data >= :de and data < :ate
group by canal;
```

### `marketing.custo_total_centavos`

Soma das despesas de marketing e anúncios do mês.

### `marketing.receita_por_origem`

Cobranças pagas no mês (`pago_em` em São Paulo), pelo valor pago, agrupadas pela origem da família do contrato.

```sql
select f.origem, sum(coalesce(c.valor_pago_centavos, c.valor_centavos))
from public.cobranca c
join public.contrato k on k.id = c.contrato_id
join public.familia f on f.id = k.familia_id
where c.status = 'paga' and /* pago_em no mês */
group by f.origem;
```

### `marketing.receita_por_campanha`

O mesmo, agrupado por `familia.codigo_origem` (só quem tem código).

## Operação

Função: `privado.painel_operacao(de, ate_exclusivo)` e `privado.capacidade_semanal` (P45). Tela de origem: agenda (`/agenda`) e capacidade (`/capacidade`).

### `operacao.familias_ativas`

Famílias com acompanhamento em `ativo`, `em_execucao`, `ultima_visita_realizada` ou `pendencias`, hoje.

```sql
select count(distinct familia_id) from public.acompanhamento
where estado in ('ativo', 'em_execucao', 'ultima_visita_realizada', 'pendencias');
```

### `operacao.familias_iniciadas`

Famílias cujo acompanhamento começou no mês (`acompanhamento.inicio_efetivo`, um fato). É o número da meta de famílias por mês.

### `operacao.visitas_realizadas`

Visitas em `concluida`, `ficha_pendente`, `ficha_entregue` ou `encerrada` com `visita.data` no mês.

### `operacao.ocorrencias_abertas`

Ocorrências fora de `resolvida` e `encerrada`, hoje.

### `operacao.capacidade_semanas`

Quantas semanas a capacidade mostra (`parametro.capacidade_semanas_painel`, 8).

### `operacao.capacidade`

Uma linha por região e semana, das próximas semanas a partir da segunda-feira da semana de hoje: ocupação, probabilidade de passar do limite, cobertura de backup e nível. É o resultado de `privado.capacidade_semanal`, o mesmo que a tela de capacidade mostra.

### `operacao.semanas_em_sobrevenda`

Linhas de `operacao.capacidade` com nível `sobrevenda` (probabilidade de passar o limite de famílias por semana igual ou maior que `parametro.sobrevenda_prob_pct`).

### `operacao.semanas_em_atencao`

Linhas com nível `atencao` (ocupação igual ou maior que `parametro.capacidade_alerta_pct`, ou cobertura de backup sem a reserva).

## Experiência

Função: `privado.painel_experiencia(de, ate_exclusivo)`. A tela de pesquisa e NPS é do P42; até ela existir, o número se confere contra `pos_venda`.

### `experiencia.respostas`

Pesquisas respondidas no mês com nota (`nps`) e classificação.

```sql
select count(*) from public.pos_venda
where nps is not null and classificacao is not null and /* pesquisa_respondida_em no mês */;
```

### `experiencia.promotores`

As respondidas do mês com `classificacao = 'promotor'`.

### `experiencia.detratores`

As respondidas do mês com `classificacao = 'detrator'`.

### `experiencia.amostra_minima`

`parametro.painel_executivo.nps_amostra_minima` (5). Com menos respostas que isso o NPS não vira número, porque uma porcentagem sobre poucas respostas exagera.

### `experiencia.nps`

`round(100 * (promotores - detratores) / respostas)`. Nulo abaixo da amostra mínima.

### `experiencia.indicacoes`

Famílias criadas no mês (sem as mescladas) com origem `indicacao_medica`, `indicacao_cliente` ou `indicacao_amigo`. O relatório por médico e por família promotora é do P50.

### `experiencia.depoimentos`

Pesquisas respondidas no mês com `depoimento_autorizado = true`.

## Financeiro

Funções: `privado.dre_mes`, `privado.inadimplencia_resumo`, `privado.previsao_recebimentos` (P46). Tela de origem: financeiro (`/financeiro`). O painel chama as mesmas funções da tela, por isso os números não podem divergir.

### `financeiro.recebimentos_centavos`

Receita do DRE do mês, em regime de caixa: cobranças pagas no mês (`pago_em` em São Paulo), pelo valor pago. Estornada e cancelada não contam.

### `financeiro.custos_centavos`

Despesas do mês (`privado.despesa.data`), sem as removidas. Inclui o pagamento da equipe (categoria `equipe_assistencial`).

### `financeiro.resultado_centavos`

Recebimentos menos custos.

### `financeiro.margem_pct`

Resultado sobre recebimentos, uma casa. Nula sem recebimento no mês.

### `financeiro.inadimplencia_pct`

Vencido em aberto sobre o emitido até hoje. Emitido é o que já venceu ou foi pago: pagas e em aberto com vencimento até hoje, sem cancelada e estornada. Nula sem nada emitido.

### `financeiro.vencido_centavos`

Cobranças `aberta` ou `vencida` com vencimento anterior a hoje.

### `financeiro.previsao_a_vencer_centavos`

Cobranças em aberto que vencem de hoje até o fim do último mês da previsão (`parametro.financeiro.previsao_meses`, 3). Só cobrança que já existe: contrato assinado sem cobrança ainda não entra.

### `financeiro.previsao_atrasadas_centavos`

Cobranças em aberto que já venceram: o mesmo número do vencido, mostrado junto da previsão.

### `financeiro.faturamento_centavos`

O faturamento do comercial (contratos assinados no mês), repetido aqui para a diretoria comparar com os recebimentos.
