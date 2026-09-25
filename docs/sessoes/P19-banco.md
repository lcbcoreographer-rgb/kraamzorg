# P19 · Ocupação projetada e recálculo diário (parte de banco)

Data: 25/09/2026 (relatório escrito na integração da trilha de banco)
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`. `0011_ocupacao.sql` e `supabase/tests/011_ocupacao.sql` entraram no commit de segurança `905fc88`; o ajuste do 011 feito pelo P20 ainda não tem commit.

## Feito

1. **`public.ocupacao_projetada`** (view `security_invoker`, PRD 6.9): para
   cada contrato ativo, início distribuído de forma uniforme na janela da
   DPP (`parametro.janela_dpp_dias`), dias de atendimento somados por
   semana (segunda-feira) e região, divididos pela capacidade (limite de
   famílias da região vezes sete dias). Saída: região, semana, ocupação em
   %, famílias. Sem `grant` para o app.
2. **`privado.disponibilidade(dpp, regiao_id)`**: `disponivel` quando todas
   as semanas prováveis estão abaixo de `capacidade_alerta_pct`,
   `confirmar_com_equipe` no resto e sempre que falta dado. Base de
   `agente.verificar_disponibilidade` (P21) e do componente
   `dpp_com_capacidade` da pontuação.
3. **`privado.recalculo_diario()`** no `pg_cron` às 10:00 UTC (7h em
   Brasília): cada módulo registra a própria etapa
   (`privado.recalculo_<etapa>`), a que ainda não existe fica como etapa
   vazia, erro isolado numa etapa não derruba as outras, e o resultado fica
   em `privado.recalculo_execucao` e `privado.recalculo_etapa` (RLS ligada,
   sem política nem `grant`).
4. Teste `011_ocupacao.sql` (28 asserções): cenário sintético de São Paulo
   (e um de Londrina) com início conhecido, início pela alta, janela
   uniforme, janela a partir do nascimento, e os contratos que não contam;
   percentuais conferidos à mão; disponibilidade; etapas; job do `pg_cron`.
   Desde o P20, `regua_nutricao` e `alerta_34s` aparecem como `ok`.

## Ficou de fora (e por quê)

- Radar das próximas 8 semanas por região e o cron visível em `/api/saude`:
  telas e rotas do app (P19 e P14). A leitura virá por uma função `api`
  com a regra "diretoria e coordenação" (ADR 0002).

## Decisões tomadas nesta sessão

- "Contrato ativo": fora de cancelado e distrato, família não mesclada,
  acompanhamento não terminado; rascunho e enviado contam (na dúvida, a vaga
  está ocupada: o erro caro é a sobrevenda).
- Fato vence estimativa: com início conhecido (`inicio_efetivo`,
  `data_inicio_efetivo` ou `data_alta`), peso 1 nesse dia; sem ele, janela
  uniforme; com nascimento registrado, a janela começa no nascimento.
- Capacidade = `limite_familias_semana` × 7.
- Disponível só se todas as semanas prováveis estão abaixo do limite; sem
  DPP, região ou parâmetro, `confirmar_com_equipe` (o agente nunca promete
  vaga sem dado).
- O horário das 10:00 UTC é regra do PRD 10.2, não parâmetro.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- Limite de alerta de ocupação e capacidade por região (C-03) [confirmar:
  Leonardo e Edilaine].
- Função `api` do radar e rota `/api/saude` (P19 tela, P14).

## Como testar

Sem Docker (esta máquina), na raiz do repositório:

```bash
cd supabase/sem-docker
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/iniciar.sh    # sobe o Postgres 16 local (idempotente)
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/testar.sh     # reset do zero + seeds do config.toml + pg_prove
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/parar.sh
cd ../..
node supabase/checar-seed.mjs
```

Um arquivo só, depois de um `scripts/resetar.sh` (o `000_harness.sql` cria o
schema `testes` que os outros usam):

```bash
sudo -u postgres pg_prove --host 127.0.0.1 --port 54342 --dbname kraamzorg --username postgres \
  supabase/tests/000_harness.sql supabase/tests/ARQUIVO.sql
```

Com Docker (prova final antes de qualquer `db push`, `supabase/LIGAR.md`):

```bash
supabase start
supabase db reset     # migrations + [db.seed] de supabase/config.toml
supabase test db
```

## Resultado dos invariantes

Reset do zero e suíte inteira na integração da trilha de banco (porta 54342,
`PGDATA=/tmp/kz-pg-final`, seeds de `[db.seed]`): `Files=17, Tests=1971,
Result: PASS`. Invariante 1 (máquinas de estado): `006_maquinas_estado.sql`
verde. Invariante 2 (permissões): `007_permissoes.sql` e `015_crm_apoio.sql`
verdes. Invariante 3 (freio): `009_freio.sql` verde. Invariante 4
(sincronização offline) é do app (P12, `pnpm e2e:offline`) e não foi rodado
nesta integração, que só mexeu no banco.
