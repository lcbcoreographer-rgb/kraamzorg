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
#   SEED_SQL          seed a aplicar depois das migrations: um arquivo, ou vários separados por
#                     ":" (padrão: a lista de [db.seed] sql_paths de supabase/config.toml, a mesma
#                     que "supabase db reset" usa; sem config.toml, supabase/seed.sql)

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
SEED_SQL="${SEED_SQL:-}"
CONFIG_TOML="$REPO_ROOT/supabase/config.toml"

# Lista, uma por linha, os arquivos de seed a aplicar, na ordem:
#   1. SEED_SQL definido: os caminhos dele (separados por ":"), como vieram;
#   2. senão, [db.seed] sql_paths de supabase/config.toml, relativos à pasta
#      supabase/ (mesma regra da CLI do Supabase), com glob expandido; com
#      "enabled = false" em [db.seed], nenhum;
#   3. sem config.toml, supabase/seed.sql.
# Não é um leitor de TOML genérico: entende o formato que o config.toml
# deste projeto usa (sql_paths = [ "a", "b" ], numa linha ou em várias).
listar_seeds() {
  if [ -n "$SEED_SQL" ]; then
    printf '%s\n' "$SEED_SQL" | tr ':' '\n' | sed '/^$/d'
    return
  fi
  if [ ! -f "$CONFIG_TOML" ]; then
    printf '%s\n' "$REPO_ROOT/supabase/seed.sql"
    return
  fi
  local base caminho
  base="$(dirname "$CONFIG_TOML")"
  awk '
    /^[[:space:]]*\[/ { secao = $0; gsub(/[[:space:]]/, "", secao); dentro = (secao == "[db.seed]"); lendo = 0; next }
    !dentro { next }
    /^[[:space:]]*enabled[[:space:]]*=[[:space:]]*false/ { desligado = 1; next }
    /^[[:space:]]*sql_paths[[:space:]]*=/ { lendo = 1 }
    lendo {
      linha = $0; sub(/#.*/, "", linha)
      while (match(linha, /"[^"]*"/)) { n++; caminhos[n] = substr(linha, RSTART + 1, RLENGTH - 2); linha = substr(linha, RSTART + RLENGTH) }
      if ($0 ~ /\]/) lendo = 0
    }
    END { if (!desligado) for (i = 1; i <= n; i++) print caminhos[i] }
  ' "$CONFIG_TOML" | while IFS= read -r caminho; do
    caminho="${caminho#./}"
    # glob expandido a partir de supabase/ (sem casamento: fica o nome literal,
    # e resetar.sh avisa que o arquivo não existe)
    ( cd "$base" && for f in $caminho; do printf '%s\n' "$base/$f"; done )
  done
}

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
