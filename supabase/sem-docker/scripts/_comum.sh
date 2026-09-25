#!/usr/bin/env bash
# Variáveis e funções compartilhadas por iniciar.sh, resetar.sh, testar.sh e
# parar.sh. Não roda sozinho: cada script faz "source" deste arquivo.
#
# Variáveis de ambiente aceitas (todas com um padrão):
#   PG_BIN            caminho dos binários do Postgres 16 (padrão: /usr/lib/postgresql/16/bin)
#   PG_USER_OS        usuário do sistema operacional dono do cluster (padrão: postgres)
#   PGDATA            diretório de dados do cluster, fora do repositório (padrão: /tmp/kz-pg)
#   PGPORT            porta do servidor (padrão: 54329)
#   DB_NAME           nome do banco da aplicação (padrão: kraamzorg)
#   MIGRATIONS_DIR    pasta com as migrations a aplicar, em ordem de nome (padrão: supabase/migrations do repositório)
#   TESTS_DIR         pasta com os testes pgTAP (padrão: supabase/tests do repositório)
#   SEED_SQL          arquivo de seed opcional (padrão: supabase/seed.sql do repositório)

set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_USER_OS="${PG_USER_OS:-postgres}"
PGDATA="${PGDATA:-/tmp/kz-pg}"
PGPORT="${PGPORT:-54329}"
DB_NAME="${DB_NAME:-kraamzorg}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEM_DOCKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SEM_DOCKER_DIR/../.." && pwd)"

CAMADA_SQL="$SEM_DOCKER_DIR/camada-supabase.sql"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"
TESTS_DIR="${TESTS_DIR:-$REPO_ROOT/supabase/tests}"
SEED_SQL="${SEED_SQL:-$REPO_ROOT/supabase/seed.sql}"

# roda um comando como o dono do cluster (PG_USER_OS). initdb e o servidor
# recusam rodar como root, de propósito (é o próprio Postgres que recusa).
# Se já formos PG_USER_OS, roda direto, sem sudo.
como_pg() {
  if [ "$(id -un)" = "$PG_USER_OS" ]; then
    "$@"
  else
    sudo -u "$PG_USER_OS" -- "$@"
  fi
}

# psql como postgres (papel do banco), contra o servidor local, parando no
# primeiro erro e devolvendo a mensagem do Postgres. Uso: psql_pg <banco> [args do psql...]
psql_pg() {
  local banco="$1"; shift
  como_pg "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$banco" "$@"
}

pg_esta_no_ar() {
  como_pg "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1
}
