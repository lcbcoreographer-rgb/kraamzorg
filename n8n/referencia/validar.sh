#!/usr/bin/env bash
# validar.sh - importa um ou mais JSON de fluxo n8n num banco SQLite limpo
# e falha (exit != 0) se qualquer importacao der erro.
#
# Uso:
#   ./validar.sh arquivo1.json [arquivo2.json ...]
#
# Requisitos: n8n instalado (localmente em node_modules/.bin/n8n, ao lado
# deste script, ou via npx n8n caso a instalacao local nao exista).
#
# Cada arquivo é importado num N8N_USER_FOLDER (e portanto banco SQLite)
# temporario e proprio, criado e apagado na hora, para nao acumular
# workflow de uma importacao na proxima nem herdar estado de uma rodada
# anterior do script.

set -u

if [ "$#" -lt 1 ]; then
  echo "uso: $0 arquivo1.json [arquivo2.json ...]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -x "$SCRIPT_DIR/node_modules/.bin/n8n" ]; then
  N8N_BIN=("$SCRIPT_DIR/node_modules/.bin/n8n")
else
  echo "aviso: instalacao local de n8n nao encontrada em $SCRIPT_DIR/node_modules/.bin/n8n; tentando npx n8n" >&2
  N8N_BIN=(npx --yes n8n)
fi

export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_TEMPLATES_ENABLED=false
export DB_TYPE=sqlite
export N8N_RUNNERS_ENABLED=false

falhas=0
total=0

for arquivo in "$@"; do
  total=$((total + 1))
  if [ ! -f "$arquivo" ]; then
    echo "ERRO: arquivo nao encontrado: $arquivo" >&2
    falhas=$((falhas + 1))
    continue
  fi

  TMP_HOME="$(mktemp -d)"
  export N8N_USER_FOLDER="$TMP_HOME"

  echo "== importando: $arquivo (banco limpo em $TMP_HOME) =="
  if "${N8N_BIN[@]}" import:workflow --input="$arquivo"; then
    echo "-- ok: $arquivo"
  else
    echo "-- FALHOU: $arquivo" >&2
    falhas=$((falhas + 1))
  fi

  rm -rf "$TMP_HOME"
done

echo
echo "resumo: $((total - falhas))/$total arquivos importados sem erro"

if [ "$falhas" -gt 0 ]; then
  exit 1
fi
exit 0
