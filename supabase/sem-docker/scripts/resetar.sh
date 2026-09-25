#!/usr/bin/env bash
# Recria o banco do zero: apaga e cria de novo o banco $DB_NAME, aplica
# camada-supabase.sql, depois todas as migrations de MIGRATIONS_DIR em ordem
# de nome, depois os seeds (SEED_SQL ou [db.seed] de supabase/config.toml). Para no primeiro erro, com a mensagem
# do próprio Postgres (psql -v ON_ERROR_STOP=1).
#
# A pasta de migrations pode vir por variável de ambiente (MIGRATIONS_DIR) ou
# como primeiro parâmetro deste script:
#   scripts/resetar.sh
#   scripts/resetar.sh /tmp/kz-fumaca/migrations
#   MIGRATIONS_DIR=/tmp/kz-fumaca/migrations scripts/resetar.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

if [ "${1:-}" != "" ]; then
  MIGRATIONS_DIR="$1"
fi

if ! pg_esta_no_ar; then
  echo "sem-docker: servidor não está no ar em 127.0.0.1:$PGPORT. Rode scripts/iniciar.sh primeiro." >&2
  exit 1
fi

echo "sem-docker: recriando o banco '$DB_NAME'"
psql_pg postgres -c \
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB_NAME' and pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
psql_pg postgres -c "drop database if exists $DB_NAME;"
psql_pg postgres -c "create database $DB_NAME;"

echo "sem-docker: aplicando camada-supabase.sql (papéis, auth, extensions, net, vault, pg_cron)"
psql_pg "$DB_NAME" -f "$CAMADA_SQL"

shopt -s nullglob
migracoes=("$MIGRATIONS_DIR"/*.sql)
if [ ${#migracoes[@]} -eq 0 ]; then
  echo "sem-docker: nenhuma migration em $MIGRATIONS_DIR (esperado enquanto supabase/migrations estiver vazia)"
else
  for arquivo in $(printf '%s\n' "${migracoes[@]}" | sort); do
    echo "sem-docker: aplicando migration $(basename "$arquivo")"
    psql_pg "$DB_NAME" -f "$arquivo"
  done
fi

# Seeds: SEED_SQL, ou [db.seed] sql_paths de supabase/config.toml (a mesma
# lista do "supabase db reset"), ou supabase/seed.sql. Ver listar_seeds em
# _comum.sh.
aplicou_seed=0
while IFS= read -r seed; do
  if [ -f "$seed" ]; then
    echo "sem-docker: aplicando seed ($seed)"
    psql_pg "$DB_NAME" -f "$seed"
    aplicou_seed=1
  else
    echo "sem-docker: seed $seed não existe, pulando"
  fi
done < <(listar_seeds)
if [ "$aplicou_seed" -eq 0 ]; then
  echo "sem-docker: nenhum seed aplicado"
fi

echo "sem-docker: banco '$DB_NAME' pronto"
