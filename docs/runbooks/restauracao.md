# Runbook · Restauração de backup

Como restaurar o banco do Kraamzorg OS e, todo mês, provar que o backup restaura de verdade num projeto temporário. Base: PRD 21.2 ("Backup com teste periódico de restauração: backups diários do plano Pro; restauração testada todo mês num projeto temporário, com registro em docs/runbooks") e 21.3.

Um backup que nunca foi restaurado é uma esperança, não um backup. O teste mensal existe para descobrir o problema num dia calmo.

## 1. O que existe de backup

| O quê                                  | Como                                                                                          | Onde                                      |
| :------------------------------------- | :-------------------------------------------------------------------------------------------- | :---------------------------------------- |
| Banco Postgres de produção             | Backup diário do plano Pro do Supabase (retenção do plano)                                    | Painel do Supabase, Database, Backups     |
| Recuperação a um ponto no tempo (PITR) | Opcional, com custo extra (PRD 21.4) [confirmar: Leonardo, se contrata]                       | Painel do Supabase                        |
| Arquivos (Storage privado)             | **Não** entram no backup do banco                                                             | Bucket `documentos` e demais; ver seção 6 |
| Fluxos do n8n                          | Gerados por `n8n/build.mjs` a partir do repositório; nada a restaurar além do config do cofre | Repositório e cofre                       |
| Segredos                               | Cofre de senhas da Kraamzorg                                                                  | Cofre                                     |

RPO (quanto dado se aceita perder) e RTO (em quanto tempo volta) de partida: até 24 horas de dado e até 1 dia útil de retorno com o backup diário [confirmar: Leonardo]. Com PITR, o RPO cai para minutos.

## 2. Teste mensal de restauração (projeto temporário)

Faça no primeiro dia útil de cada mês, por alguém da Drop com um representante da Kraamzorg ciente. O projeto temporário guarda **dado real** enquanto existe: trate como produção.

1. **Criar** um projeto Supabase temporário, na conta da Kraamzorg, chamado `kraamzorg-restauracao-AAAAMM`, na mesma região da produção, no plano necessário. MFA ligado na conta. Acesso só de quem está executando o teste.
2. **Restaurar** o backup mais recente da produção nele. Duas formas, use a que o painel oferecer:
   - a opção de restaurar o backup para um projeto novo, quando disponível [confirmar no painel];
   - baixar o arquivo de backup e restaurar com `pg_restore` ou `psql` no banco do projeto temporário, usando a connection string do projeto temporário (do cofre; nunca no histórico do shell).
3. **Conferir** com a lista da seção 3. Anote a hora de início e de fim (isso é o RTO medido).
4. **Apagar** o projeto temporário no mesmo dia, ao terminar. Confirme no painel que ele não existe mais. Apague também qualquer arquivo de backup baixado.
5. **Registrar** o resultado na tabela da seção 7, no mesmo dia.

Regras do teste (LGPD, CLAUDE.md):

- Nenhum dado da restauração sai do projeto temporário: sem exportar tabela, sem print de tela com nome de família, sem colar consulta com resultado em chat ou pull request. Conferir é olhar **contagens** e **presença**, não linhas.
- Nome de paciente nunca em nome de arquivo, no nome do projeto ou no registro do teste.
- O projeto temporário não recebe tráfego, nem webhook, nem n8n. Nenhum serviço é apontado para ele.

## 3. Lista de conferência (só contagens)

Rode no projeto restaurado e compare com a produção do mesmo instante (mesma consulta, na produção, somente leitura). A diferença aceita é a do dia entre o backup e a consulta.

```sql
-- 1. as tabelas do PRD estão lá e com RLS ligada
select count(*) filter (where c.relrowsecurity) as com_rls, count(*) as total
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public','privado','agente','agente_n8n');

-- 2. volume das tabelas que importam (contagem, nunca linhas)
select 'familia' t, count(*) from public.familia
union all select 'pessoa', count(*) from public.pessoa
union all select 'contrato', count(*) from public.contrato
union all select 'visita', count(*) from public.visita
union all select 'registro_atendimento', count(*) from public.registro_atendimento
union all select 'registro_adendo', count(*) from public.registro_adendo
union all select 'mensagem', count(*) from public.mensagem
union all select 'log_auditoria', count(*) from public.log_auditoria;

-- 3. o registro assistencial continua imutável (o gatilho veio junto)
select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relname = 'registro_atendimento' and not t.tgisinternal;

-- 4. migrations: a última aplicada é a mesma da produção
select max(version) from supabase_migrations.schema_migrations;

-- 5. o agendador foi restaurado (no projeto temporário ele NÃO deve rodar, ver "Agendador" abaixo)
select jobname, schedule from cron.job order by jobname;
```

**Agendador.** Desligue o agendador no projeto temporário logo após a restauração (`select cron.unschedule(jobname) from cron.job;`), para o recálculo diário e as automações não tentarem enviar mensagem nem tarefa a partir de uma cópia. Isto vale antes de qualquer outra coisa: o projeto temporário nunca envia nada a ninguém.
**Vault e o HMAC do log.** O log de auditoria grava as colunas sensíveis como `[oculto]` mais um HMAC-SHA256 com chave no Supabase Vault (`privado.auditar`). Confirme se a chave sobrevive à restauração: chame uma função que grave no log num registro de teste do projeto temporário e veja se o HMAC é calculado sem erro. **Se a chave do Vault não vier junto**, a restauração de produção exige recadastrar o segredo antes de abrir o sistema: os HMACs antigos deixam de ser verificáveis com a chave nova, e o log só deve ser lido como prova depois de registrar essa quebra. [confirmar com o suporte da Supabase como o Vault se comporta na restauração; registrar a resposta aqui.]

Critério de aprovação do teste: itens 1 a 4 iguais aos da produção (dentro da diferença do dia), a pergunta do Vault respondida, o RTO medido dentro do que a seção 1 aceita.

## 4. Restauração de verdade (incidente)

Só por decisão da diretoria (Leonardo), porque perde os dados novos desde o backup.

1. Avise a equipe: o sistema fica fora do ar. Ponha a página de manutenção ou desligue o domínio na Vercel.
2. Pare tudo que escreve: `agente_modo` em `desligado`, desligue os fluxos do n8n de produção, pause os webhooks (Autentique, InfinitePay, WhatsApp).
3. Restaure o backup escolhido (ou o ponto no tempo, com PITR) pelo painel do Supabase. A restauração no mesmo projeto substitui o banco.
4. Rode as conferências da seção 3, agora na produção.
5. Reaplique as migrations mais novas que o backup, se houver, na ordem (`supabase db push` depois de revisão).
6. Reative na ordem inversa: banco, app, webhooks, n8n, agente (`agente_modo` volta com a aprovação do Leonardo).
7. Conte quem perdeu o quê: consulte o `log_auditoria` do dia e as tarefas para saber o que precisa ser refeito. Registro assistencial feito em campo sem sinal sobe de novo pelo aparelho (fila offline), o que reduz a perda.
8. Abra a nota de incidente (`incidente.md`). Perda de dado de família é comunicada à Kraamzorg em até 24 horas.

## 5. Ordem de prioridade se o tempo for curto

1. Banco de produção (registro assistencial e contratos).
2. Segredos do cofre.
3. Storage (PDFs de contrato e comprovantes).
4. Fluxos do n8n (regeneram do repositório).

## 6. Storage não vem no backup do banco

Os arquivos privados (PDF do contrato, comprovante de baixa, áudio de visita) ficam no Storage. O backup do banco só guarda os caminhos. Para o teste mensal, confira que os caminhos gravados em `contrato.pdf_path` seguem o padrão e que os arquivos existem no bucket de produção (contagem de objetos por bucket, sem abrir nenhum). Uma cópia periódica do bucket para um segundo local é decisão da Kraamzorg [confirmar: Leonardo]; enquanto não houver, o risco fica registrado aqui.

## 7. Registro dos testes

Uma linha por teste, no mesmo dia. Sem nome de paciente.

| Mês                              | Data | Quem executou | Backup restaurado (data e hora) | RTO medido | Itens 1 a 4 | Vault/HMAC | Projeto temporário apagado | Problemas e o que foi feito |
| :------------------------------- | :--- | :------------ | :------------------------------ | :--------- | :---------- | :--------- | :------------------------- | :-------------------------- |
| (primeiro teste ainda não feito) |      |               |                                 |            |             |            |                            |                             |

## 8. Ensaio local (sem dado real)

Antes do primeiro teste com o backup de produção, o roteiro das seções 2 e 3 roda inteiro na máquina de desenvolvimento, com o seed sintético, pelo script `supabase/sem-docker/scripts/restaurar-teste.sh`:

1. `supabase/sem-docker/scripts/resetar.sh` recria o banco do zero (camada, migrations e seed).
2. O script faz o backup (`pg_dump`), restaura num banco novo `<banco>_restauracao` (o "projeto temporário"), sem o pg_cron, para a cópia não agendar nada.
3. Roda a lista de conferência (`supabase/sem-docker/restauracao/conferencia.sql`, as consultas da seção 3 mais contagem de funções de `api` e de políticas) na origem e na cópia, e exige resultado idêntico.
4. Confere a Vault e o HMAC do log: a cópia calcula o mesmo HMAC que a origem e uma mudança de teste grava log com HMAC (desfeita no rollback).
5. Apaga o banco temporário e o arquivo de backup ao sair, e mostra o tempo total.

```bash
PGDATA=/tmp/kz-pg PGPORT=54329 supabase/sem-docker/scripts/resetar.sh
PGDATA=/tmp/kz-pg PGPORT=54329 supabase/sem-docker/scripts/restaurar-teste.sh
```

O ensaio não substitui o teste mensal: ele não passa pelo backup do plano Pro, a camada sem Docker não tem `supabase_migrations.schema_migrations` (item 4) e a Vault local é um stub que guarda a chave dentro do banco, então o HMAC igual aqui não responde a pergunta da Vault real da seção 3.

| Data       | Quem              | Resultado                                                                                                                                                    |
| :--------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30/09/2026 | Drop (sessão P53) | Aprovado: 88/88 tabelas com RLS, contagens da seção 3 iguais, 189 funções de `api` e 156 políticas iguais, agendador fora da cópia, HMAC igual, cerca de 1 s |
