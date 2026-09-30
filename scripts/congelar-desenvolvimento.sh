#!/usr/bin/env bash
# Congelamento do desenvolvimento (P52, PROMPTS.md): confere as portas e, só
# quando pedido, cria a tag anotada da versão candidata NA MÁQUINA LOCAL.
#
# Nunca faz push, nunca mexe em `main` e nunca aplica migration. Por padrão é
# um ensaio (dry-run): mostra o que conferiria e o que faria.
#
# A data e a tag vêm de `parametro.congelamento_desenvolvimento` (o painel
# mostra a contagem). Este script não guarda esses valores: passe-os.
#
# Uso:
#   scripts/congelar-desenvolvimento.sh --tag v1.0.0-rc.1 --data 2026-11-13
#   scripts/congelar-desenvolvimento.sh --tag v1.0.0-rc.1 --data 2026-11-13 --criar-tag
#   scripts/congelar-desenvolvimento.sh --tag v1.0.0-rc.1 --data 2026-11-13 --com-testes
#
# Opções:
#   --tag NOME       tag da versão candidata (obrigatória)
#   --data AAAA-MM-DD  data do congelamento, só para a mensagem da tag (obrigatória)
#   --com-testes     roda lint, typecheck e testes antes de conferir
#   --criar-tag      cria a tag anotada local (sem isso, é ensaio)
#   --ramo NOME      ramo esperado para o congelamento (padrão: hml)
set -euo pipefail

TAG=""
DATA=""
CRIAR_TAG=0
COM_TESTES=0
RAMO_ESPERADO="hml"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --data) DATA="${2:-}"; shift 2 ;;
    --ramo) RAMO_ESPERADO="${2:-}"; shift 2 ;;
    --criar-tag) CRIAR_TAG=1; shift ;;
    --com-testes) COM_TESTES=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$TAG" ] || [ -z "$DATA" ]; then
  echo "Falta --tag e --data. Eles vêm de parametro.congelamento_desenvolvimento." >&2
  exit 2
fi
if ! printf '%s' "$DATA" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "A data precisa estar no formato AAAA-MM-DD." >&2
  exit 2
fi
if ! printf '%s' "$TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'; then
  echo "A tag precisa parecer uma versão, por exemplo v1.0.0-rc.1." >&2
  exit 2
fi

raiz="$(git rev-parse --show-toplevel)"
cd "$raiz"

falhas=0
ok() { printf '  ok     %s\n' "$1"; }
falha() { printf '  FALHA  %s\n' "$1"; falhas=$((falhas + 1)); }

echo "Congelamento do desenvolvimento: ${TAG} (${DATA})"
if [ "$CRIAR_TAG" -eq 1 ]; then
  echo "Modo: cria a tag local se tudo passar."
else
  echo "Modo: ensaio. Nada será criado."
fi
echo

echo "1. Estado do repositório"
ramo="$(git rev-parse --abbrev-ref HEAD)"
if [ "$ramo" = "$RAMO_ESPERADO" ]; then
  ok "ramo ${ramo}"
else
  falha "o ramo é ${ramo}; o congelamento sai de ${RAMO_ESPERADO}"
fi
if [ -z "$(git status --porcelain)" ]; then
  ok "árvore limpa"
else
  falha "há mudança não commitada"
fi
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  falha "a tag ${TAG} já existe"
else
  ok "a tag ${TAG} ainda não existe"
fi
if [ "$ramo" = "main" ]; then
  falha "main é produção e só recebe promoção de hml depois do aceite"
fi

echo
echo "2. Migrations e segredos"
ultima="$(ls supabase/migrations/*.sql | tail -n 1)"
ok "última migration: $(basename "$ultima")"
if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --no-banner >/dev/null 2>&1; then
    ok "gitleaks sem achado"
  else
    falha "gitleaks achou algo; corrija antes de congelar"
  fi
else
  echo "  aviso  gitleaks não está instalado; rode-o antes de congelar"
fi

if [ "$COM_TESTES" -eq 1 ]; then
  echo
  echo "3. Portas de qualidade"
  for comando in "pnpm lint" "pnpm typecheck" "pnpm test"; do
    if $comando >/dev/null 2>&1; then
      ok "$comando"
    else
      falha "$comando"
    fi
  done
  echo "  aviso  supabase test db e pnpm e2e:offline pedem Docker e o navegador; rode-os à parte"
else
  echo
  echo "3. Portas de qualidade"
  echo "  aviso  não rodei os testes (use --com-testes). Antes de congelar rode:"
  echo "         pnpm lint && pnpm typecheck && pnpm test"
  echo "         supabase test db   (ou supabase/sem-docker/scripts/testar.sh)"
  echo "         pnpm e2e:offline"
fi

echo
if [ "$falhas" -gt 0 ]; then
  echo "${falhas} conferência(s) falharam. Nada foi criado."
  exit 1
fi

if [ "$CRIAR_TAG" -eq 1 ]; then
  git tag -a "$TAG" -m "Versão candidata ${TAG}: congelamento do desenvolvimento em ${DATA}"
  echo "Tag ${TAG} criada localmente em $(git rev-parse --short HEAD)."
  echo "Para publicar, um passo à parte e controlado: git push origin ${TAG}"
else
  echo "Tudo certo. Para criar a tag local: repita com --criar-tag."
fi
