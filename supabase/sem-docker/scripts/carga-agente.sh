#!/usr/bin/env bash
# Carga básica no caminho de banco do webhook do agente (PROMPTS.md P53
# item 4): 20 mensagens simultâneas de 20 números diferentes, cada uma
# percorrendo registrar_mensagem, checar_termos_alerta, pode_responder,
# contexto_conversa e pode_enviar como n8n_agente. Falha se alguma
# transação der erro ou se a latência máxima passar de CARGA_MAX_MS
# (padrão 2000 ms). Só no banco local sem Docker (dado sintético).
#
# Uso:
#   supabase/sem-docker/scripts/carga-agente.sh
#   CLIENTES=20 CARGA_MAX_MS=2000 PGPORT=54430 supabase/sem-docker/scripts/carga-agente.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_comum.sh"

CLIENTES="${CLIENTES:-20}"
CARGA_MAX_MS="${CARGA_MAX_MS:-2000}"
ROTEIRO="$SEM_DOCKER_DIR/carga/agente-mensagem.sql"
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

echo "carga: $CLIENTES mensagens simultâneas de números diferentes (porta $PGPORT)"
(cd "$LOG_DIR" && "$PG_BIN/pgbench" -h 127.0.0.1 -p "$PGPORT" -U postgres -n \
  -c "$CLIENTES" -j "$CLIENTES" -t 1 -r -l -f "$ROTEIRO" "$DB_NAME") | tee "$LOG_DIR/saida.txt"

falhas=$(grep -E "number of failed transactions" "$LOG_DIR/saida.txt" | grep -oE "[0-9]+" | head -1 || echo 0)
feitas=$(grep -E "number of transactions actually processed" "$LOG_DIR/saida.txt" | grep -oE "[0-9]+" | head -1)
max_us=$(cat "$LOG_DIR"/pgbench_log.* | awk '{ if ($3 > m) m = $3 } END { print m + 0 }')
max_ms=$((max_us / 1000))
echo "carga: $feitas de $CLIENTES processadas, $falhas com erro, latência máxima ${max_ms} ms"

conversas=$("$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB_NAME" -Atc \
  "select count(distinct conversa_id) from public.mensagem where wa_message_id like 'P53-CARGA-%'")
echo "carga: $conversas conversas distintas com mensagem da carga"

if [ "$feitas" != "$CLIENTES" ] || [ "${falhas:-0}" != "0" ] || [ "$max_ms" -gt "$CARGA_MAX_MS" ] || [ "$conversas" -lt "$CLIENTES" ]; then
  echo "carga: REPROVADA"
  exit 1
fi
echo "carga: APROVADA"
