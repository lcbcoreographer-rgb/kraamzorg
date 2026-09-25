#!/usr/bin/env bash
# Sobe o Postgres local sem Docker que a camada supabase/sem-docker usa para
# migrations e testes pgTAP. Idempotente: se o cluster já existe, não refaz
# o initdb; se o servidor já está no ar, não tenta subir de novo.
#
# Uso:
#   scripts/iniciar.sh
#   PGDATA=/tmp/outro-lugar PGPORT=54330 scripts/iniciar.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

if [ -f "$PGDATA/PG_VERSION" ]; then
  echo "sem-docker: cluster já existe em $PGDATA"
else
  echo "sem-docker: criando cluster em $PGDATA (porta $PGPORT, dono $PG_USER_OS)"
  mkdir -p "$PGDATA"
  chown "$PG_USER_OS":"$PG_USER_OS" "$PGDATA" 2>/dev/null || true

  como_pg "$PG_BIN/initdb" -D "$PGDATA" --username=postgres --auth=trust --encoding=UTF8

  # Configurações que este cluster precisa e que só dá pra aplicar antes do
  # primeiro start (não são coisa que SQL muda em quente):
  #   - listen_addresses e port: os scripts conectam por TCP em 127.0.0.1,
  #     nunca por socket Unix (evita limite de tamanho de caminho quando
  #     PGDATA fica num diretório longo, como no teste de fumaça).
  #   - shared_preload_libraries e cron.database_name: pg_cron precisa dos
  #     dois definidos antes do servidor subir pela primeira vez (ver
  #     camada-supabase.sql, seção 7).
  #   - fsync/full_page_writes/synchronous_commit desligados: acelera o
  #     ciclo resetar+testar, que recria o banco inteiro a cada chamada.
  #     Nunca faça isso num banco que precisa sobreviver a uma queda de
  #     energia -- aqui não precisa, resetar.sh sempre recria do zero.
  cat >> "$PGDATA/postgresql.conf" <<-CONF

	# --- ajustes supabase/sem-docker (escritos por scripts/iniciar.sh) ---
	listen_addresses = 'localhost'
	port = $PGPORT
	shared_preload_libraries = 'pg_cron'
	cron.database_name = '$DB_NAME'
	fsync = off
	full_page_writes = off
	synchronous_commit = off
	CONF
fi

if pg_esta_no_ar; then
  echo "sem-docker: servidor já está no ar na porta $PGPORT"
else
  como_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/servidor.log" -o "-p $PGPORT" start -w
  echo "sem-docker: servidor no ar na porta $PGPORT (log em $PGDATA/servidor.log)"
fi

echo "sem-docker: pronto. Próximo passo: scripts/resetar.sh"
