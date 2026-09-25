#!/usr/bin/env bash
# Reseta o banco (scripts/resetar.sh) e roda pg_prove em TESTS_DIR/*.sql
# contra ele. Devolve o código de saída do pg_prove: 0 se todos os testes
# passarem, diferente de zero se algum falhar.
#
# A pasta de testes pode vir por variável de ambiente (TESTS_DIR) ou como
# primeiro parâmetro deste script; a pasta de migrations continua vindo por
# MIGRATIONS_DIR ou variável de ambiente (repassada para resetar.sh):
#   scripts/testar.sh
#   scripts/testar.sh /tmp/kz-fumaca/tests
#   MIGRATIONS_DIR=/tmp/kz-fumaca/migrations TESTS_DIR=/tmp/kz-fumaca/tests scripts/testar.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

if [ "${1:-}" != "" ]; then
  TESTS_DIR="$1"
fi

echo "sem-docker: preparando o banco (reset completo) antes de testar"
MIGRATIONS_DIR="$MIGRATIONS_DIR" DB_NAME="$DB_NAME" PGPORT="$PGPORT" PGDATA="$PGDATA" \
  "$SCRIPT_DIR/resetar.sh"

shopt -s nullglob
testes=("$TESTS_DIR"/*.sql)
if [ ${#testes[@]} -eq 0 ]; then
  echo "sem-docker: nenhum teste .sql em $TESTS_DIR" >&2
  exit 1
fi

echo "sem-docker: rodando pg_prove em $TESTS_DIR ($(printf '%s\n' "${testes[@]}" | wc -l) arquivo(s))"
como_pg /usr/bin/pg_prove \
  --host 127.0.0.1 --port "$PGPORT" --dbname "$DB_NAME" --username postgres \
  --verbose \
  $(printf '%s\n' "${testes[@]}" | sort)
