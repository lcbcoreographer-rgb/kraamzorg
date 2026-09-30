#!/usr/bin/env bash
# Ensaio local do teste de restauração (docs/runbooks/restauracao.md, seções 2
# e 3; PROMPTS.md P53 item 3), no banco sem Docker com o seed sintético:
#
#   1. backup: pg_dump do banco pronto (formato custom, arquivo temporário);
#   2. restauração num banco novo, "<banco>_restauracao", como o projeto
#      temporário do runbook. O pg_cron fica de fora (ele só roda no banco de
#      cron.database_name), o que já cumpre a regra "o projeto temporário
#      nunca envia nada a ninguém";
#   3. conferência da seção 3 (só contagens) na origem e na cópia, que
#      precisam ser iguais;
#   4. Vault e HMAC: a cópia calcula o mesmo HMAC que a origem e grava log de
#      auditoria com HMAC numa mudança de teste (desfeita no rollback);
#   5. o banco temporário e o arquivo de backup são apagados, e o tempo total
#      (RTO do ensaio) é mostrado.
#
# O que não se ensaia aqui (depende do painel do Supabase): a restauração pelo
# backup diário do plano Pro, supabase_migrations.schema_migrations (a camada
# sem Docker não tem) e se a chave da Vault real sobrevive (item [confirmar]
# do runbook). Nunca aponte este script para produção.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

COPIA="${DB_NAME}_restauracao"
CONFERENCIA="$SEM_DOCKER_DIR/restauracao/conferencia.sql"
TMP="$(mktemp -d)"
PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 -X -q -At)

limpar() {
  "$PG_BIN/dropdb" -h 127.0.0.1 -p "$PGPORT" -U postgres --if-exists "$COPIA" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpar EXIT

inicio=$(date +%s)
echo "restauração: backup de '$DB_NAME'"
"$PG_BIN/pg_dump" -h 127.0.0.1 -p "$PGPORT" -U postgres -Fc -f "$TMP/backup.dump" "$DB_NAME"

echo "restauração: banco temporário '$COPIA' (sem pg_cron)"
"$PG_BIN/dropdb" -h 127.0.0.1 -p "$PGPORT" -U postgres --if-exists "$COPIA"
"$PG_BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U postgres "$COPIA"
"$PG_BIN/pg_restore" -l "$TMP/backup.dump" \
  | grep -vE "EXTENSION - pg_cron|EXTENSION pg_cron|SCHEMA cron|TABLE DATA cron |SEQUENCE SET cron " > "$TMP/lista.txt"
"$PG_BIN/pg_restore" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$COPIA" \
  --exit-on-error -L "$TMP/lista.txt" "$TMP/backup.dump"

echo "restauração: conferência (seção 3 do runbook, só contagens)"
"${PSQL[@]}" -F ' | ' -d "$DB_NAME" -f "$CONFERENCIA" > "$TMP/origem.txt"
"${PSQL[@]}" -F ' | ' -d "$COPIA" -f "$CONFERENCIA" > "$TMP/copia.txt"
cat "$TMP/copia.txt"
if ! diff -u "$TMP/origem.txt" "$TMP/copia.txt"; then
  echo "restauração: REPROVADA (a cópia difere da origem)"
  exit 1
fi

jobs_origem=$("${PSQL[@]}" -d "$DB_NAME" -c "select count(*) from cron.job")
tem_cron_copia=$("${PSQL[@]}" -d "$COPIA" -c "select count(*) from pg_namespace where nspname = 'cron'")
echo "restauração: agendador na origem com $jobs_origem tarefas; na cópia, schema cron presente: $tem_cron_copia (esperado 0)"
if [ "$tem_cron_copia" != "0" ]; then
  echo "restauração: REPROVADA (o agendador veio para a cópia)"
  exit 1
fi

echo "restauração: Vault e HMAC do log"
hmac_origem=$("${PSQL[@]}" -d "$DB_NAME" -c "select privado.hmac_auditoria('conferencia-p53')")
hmac_copia=$("${PSQL[@]}" -d "$COPIA" -c "select privado.hmac_auditoria('conferencia-p53')")
log_hmac=$("${PSQL[@]}" -d "$COPIA" <<'SQL'
begin;
update public.familia set bairro = coalesce(bairro, '') || ' (conferência)'
 where id = (select id from public.familia order by id limit 1);
select count(*) from public.log_auditoria
 where entidade = 'familia' and criado_em >= now() - interval '1 minute'
   and valor_depois ? '_hmac';
rollback;
SQL
)
log_hmac=$(echo "$log_hmac" | tail -n 1)
if [ -z "$hmac_origem" ] || [ "$hmac_origem" != "$hmac_copia" ] || [ "${log_hmac:-0}" -lt 1 ]; then
  echo "restauração: REPROVADA (HMAC da cópia não confere ou o log não gravou HMAC)"
  exit 1
fi
echo "restauração: HMAC igual na origem e na cópia; mudança de teste gravou log com HMAC"

fim=$(date +%s)
echo "restauração: APROVADA em $((fim - inicio)) s (RTO do ensaio local); banco temporário e backup apagados ao sair"
