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

# -----------------------------------------------------------------------------
# Extensão falsa "pg_net", instalada no diretório de extensões do Postgres
# desta máquina, não no banco. Esta máquina não tem a biblioteca real do
# pg_net (sem rede para baixar); sem isto, "create extension if not exists
# pg_net;" da migration 0001 do projeto (PRD 6.0) falharia com "extension
# pg_net is not available". Passo idempotente (sobrescreve os dois arquivos
# toda vez, conteúdo sempre igual) e não mexe em nenhuma migration
# versionada: só grava dois arquivos de definição de extensão (.control e
# --1.0.sql) no lugar onde o Postgres já procura extensão instalada. O SQL
# dentro do .sql é o mesmo stub de sempre (schema net, net._chamadas,
# net.http_post/http_get) -- só passou a chegar via "create extension" em vez
# de SQL solto em camada-supabase.sql. Detalhe em supabase/sem-docker/README.md.
PG_EXTENSION_DIR="$(como_pg "$PG_BIN/pg_config" --sharedir)/extension"
echo "sem-docker: instalando extensão falsa pg_net em $PG_EXTENSION_DIR"

cat > "$PG_EXTENSION_DIR/pg_net.control" <<-'CONTROL'
	# sem-docker: extensão falsa de pg_net, só para "create extension if not exists pg_net;"
	# (PRD 6.0) não falhar nesta máquina, que não tem a biblioteca real do pg_net instalada.
	# Ver supabase/sem-docker/README.md e o comentário no topo do arquivo .sql desta extensão.
	comment = 'stub sem-docker de pg_net: nao faz chamada HTTP nenhuma, so grava em net._chamadas (ver supabase/sem-docker/README.md)'
	default_version = '1.0'
	relocatable = false
	schema = net
	CONTROL

cat > "$PG_EXTENSION_DIR/pg_net--1.0.sql" <<-'SQLSTUB'
	-- =============================================================================
	-- Extensão falsa "pg_net" para supabase/sem-docker
	--
	-- Esta máquina não tem a biblioteca real do pg_net instalada (sem rede para
	-- baixar). Este arquivo existe só para que "create extension if not exists
	-- pg_net;", que a migration 0001 do projeto executa (PRD 6.0), tenha uma
	-- extensão de verdade para instalar em vez de falhar com "extension pg_net
	-- is not available". scripts/iniciar.sh grava este arquivo e o .control
	-- irmão aqui antes do primeiro "create extension pg_net" rodar (passo
	-- idempotente, não mexe na migration versionada do projeto).
	--
	-- O conteúdo abaixo é o MESMO stub que a camada sem-docker sempre teve: não
	-- faz nenhuma chamada HTTP de verdade, só grava o que seria enviado em
	-- net._chamadas, para os testes conferirem.
	--
	-- Diferença do pg_net real: é síncrono (devolve o id na hora) e não tem fila
	-- nem worker em background, então nunca existe net._http_response. Detalhado
	-- em supabase/sem-docker/README.md.
	-- =============================================================================

	create table if not exists net._chamadas (
	  id            bigserial primary key,
	  metodo        text not null check (metodo in ('GET', 'POST')),
	  url           text not null,
	  corpo         jsonb,
	  parametros    jsonb,
	  cabecalhos    jsonb,
	  timeout_ms    integer,
	  chamado_por   text not null default current_user,
	  chamado_em    timestamptz not null default clock_timestamp()
	);
	comment on table net._chamadas is 'sem-docker: histórico das chamadas que passariam por net.http_post/net.http_get, só para os testes conferirem o que seria enviado (método, url, corpo, quem chamou). Não existe no pg_net real.';

	grant select, insert on net._chamadas to postgres, service_role;
	grant usage, select on all sequences in schema net to postgres, service_role;

	create or replace function net.http_post(
	  url                  text,
	  body                 jsonb default null,
	  params               jsonb default '{}'::jsonb,
	  headers              jsonb default '{"Content-Type": "application/json"}'::jsonb,
	  timeout_milliseconds integer default 5000
	)
	returns bigint
	language plpgsql
	as $STUB$
	declare
	  id_chamada bigint;
	begin
	  insert into net._chamadas (metodo, url, corpo, parametros, cabecalhos, timeout_ms)
	  values ('POST', url, body, params, headers, timeout_milliseconds)
	  returning id into id_chamada;
	  return id_chamada;
	end;
	$STUB$;
	comment on function net.http_post(text, jsonb, jsonb, jsonb, integer) is 'sem-docker: mesma assinatura de net.http_post do pg_net. Não sai da máquina; grava em net._chamadas e devolve um id sequencial na hora (o pg_net real devolve o id de uma fila processada em background).';

	create or replace function net.http_get(
	  url                  text,
	  params               jsonb default '{}'::jsonb,
	  headers              jsonb default '{}'::jsonb,
	  timeout_milliseconds integer default 5000
	)
	returns bigint
	language plpgsql
	as $STUB$
	declare
	  id_chamada bigint;
	begin
	  insert into net._chamadas (metodo, url, corpo, parametros, cabecalhos, timeout_ms)
	  values ('GET', url, null, params, headers, timeout_milliseconds)
	  returning id into id_chamada;
	  return id_chamada;
	end;
	$STUB$;
	comment on function net.http_get(text, jsonb, jsonb, integer) is 'sem-docker: mesma assinatura de net.http_get do pg_net. Não sai da máquina; grava em net._chamadas.';

	revoke execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) from public;
	revoke execute on function net.http_get(text, jsonb, jsonb, integer)        from public;
	grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) to postgres, service_role;
	grant execute on function net.http_get(text, jsonb, jsonb, integer)        to postgres, service_role;
	SQLSTUB

echo "sem-docker: extensão falsa pg_net instalada"

if pg_esta_no_ar; then
  echo "sem-docker: servidor já está no ar na porta $PGPORT"
else
  como_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/servidor.log" -o "-p $PGPORT" start -w
  echo "sem-docker: servidor no ar na porta $PGPORT (log em $PGDATA/servidor.log)"
fi

echo "sem-docker: pronto. Próximo passo: scripts/resetar.sh"
