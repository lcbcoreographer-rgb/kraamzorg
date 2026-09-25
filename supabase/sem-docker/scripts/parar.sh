#!/usr/bin/env bash
# Para o servidor Postgres local do supabase/sem-docker, se estiver no ar.
# Não apaga PGDATA: rodar scripts/iniciar.sh de novo religa o mesmo cluster.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "sem-docker: não há cluster em $PGDATA, nada para parar"
  exit 0
fi

if pg_esta_no_ar; then
  como_pg "$PG_BIN/pg_ctl" -D "$PGDATA" stop -m fast
  echo "sem-docker: servidor parado"
else
  echo "sem-docker: servidor já estava parado"
fi
