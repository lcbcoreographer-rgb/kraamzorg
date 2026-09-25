# P20 · Motor de automações e régua de nutrição (parte de banco)

Data: 25/09/2026 (relatório escrito na integração da trilha de banco)
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`. `0012_automacoes.sql` e `supabase/tests/012_automacoes.sql` ainda não têm commit (esta rodada não faz commit).

## Feito

1. **Segredo `automacao_interno_token` no Vault**, criado só quando falta
   (mesmo desenho do `auditoria_hmac`).
2. **`privado.chamar_rota_automacao`**: único ponto do motor que chama
   `net.http_post`; base da rota em `parametro.automacao_rota_interna` e
   token do Vault no cabeçalho; sem um dos dois, recusa.
3. **Materializadores com deduplicação**: `retorno_combinado`,
   `lembrete_sessao` (véspera), `pagamento_atrasado`, `sessao_sem_agenda`
   (`parametro.sessao_sem_agenda_horas`) e `agendar_followup_d1` (só agenda:
   o n8n consome por `agente.followups_devidos`, P22), com
   `agente_followup_horas`, fora de `humano_comercial` e de transferência
   aberta, cancelando o agendamento velho quando a família responde de novo.
4. **`privado.aplicar_acao_automacao`**: `criar_tarefa`, `notificar*` e
   `chamar_rota_interna`; ação não reconhecida é gancho vazio, nunca erro.
5. **`privado.processar_automacoes()`** no `pg_cron` a cada 5 minutos:
   materializa, chama `privado.pode_executar` (P09) para cada execução
   devida, aplica as ações e marca executada ou abortada.
6. **`privado.recalculo_regua_nutricao()`** e
   **`privado.recalculo_alerta_34s()`**: etapas do recálculo diário (0011),
   uma tarefa por família por mudança de faixa, respeitando freio e
   `nao_contatar`, só para quem já escreveu.
7. **`privado.retencao_diaria()`** (O-06), cron diário próprio:
   `chat_memoria` vencida; mensagem, handoff e conversa de família sem
   contrato 24 meses depois de `perdido` ou `nao_qualificado`; ip do log
   pela `privado.anonimizar_ip_log_auditoria` do P05. Grava só contagens.
8. Seed: `sessao_sem_agenda_horas` e `automacao_rota_interna`.
9. Teste `012_automacoes.sql` (54 asserções): família em `atencao` sem
   tarefa de régua, uma tarefa só por mudança de faixa, execução externa
   abortada quando o estado muda entre o agendamento e o envio, lead
   fictício vencido apagado pela retenção e o recente preservado, cron
   registrado, privilégios. `011_ocupacao.sql` passou a esperar `ok` em
   `regua_nutricao` e `alerta_34s`.

## Ficou de fora (e por quê)

- Tela de automações da diretoria (ligar e desligar, execuções e abortos):
  sessão de tela.
- Rota `/api/interno/automacao` do app, que reconsulta o freio antes de
  sair: sessão de app. O valor de `automacao_interno_token` precisa ser o
  mesmo que a rota confere (`supabase/LIGAR.md`, passo 6).
- `followup_d3_d14`, `contratar_sem_transferencia` e `prenatal_urgente`:
  gancho vazio, porque falta um marco que o schema ainda não grava de forma
  inequívoca (inventar um relógio arriscaria SLA fantasma ou handoff fora da
  matriz do P22).
- `contrato_fechado`, `pos_assinatura` e `pagamento_confirmado`: ganchos
  vazios que o P30 a P32 preenchem.

## Decisões tomadas nesta sessão

- Régua e alerta de 34 semanas entram como etapas do recálculo diário, sem
  segundo agendamento; a retenção tem cron próprio.
- "Véspera da sessão" é regra estrutural do capítulo 23.2; "24 h sem
  agenda" é limite ajustável e vai para `parametro`.
- Tentativa registrada, mesmo abortada pelo freio, consome o fato: a fila
  não enche de novo a cada 5 minutos.
- `alerta_34s` e `prenatal_urgente` seguem com `ativa = false` no seed até
  o módulo de pré-natal (Fase 2).
- Retenção apaga filhos antes do pai (`chat_memoria`, `mensagem`,
  `handoff`, `conversa`).
- O P22 redefiniu `privado.agendar_followup_d1` para deduplicar por
  qualquer status (sem editar a 0012), senão um follow-up cancelado seria
  recriado a cada 5 minutos.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- Prazos de `parametro.retencao` (O-06) [decisão: Leonardo e jurídico].
- Marcos para `followup_d3_d14`, `contratar_sem_transferencia` e
  `prenatal_urgente`.
- Rota `/api/interno/automacao` e o nome da variável do token no app.

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
