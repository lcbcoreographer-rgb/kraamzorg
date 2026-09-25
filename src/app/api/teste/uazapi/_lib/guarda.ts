import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * A rota de captura só existe para o teste de fumaça e o roteiro de
 * homologação da Isadora rodarem com `homologacao.envioSimulado` e
 * `homologacao.transcricaoSimulada` (n8n/IMPORTAR.md, P25 item 5): fora de
 * homologação ela é recusada, nunca captura nada em silêncio. A checagem é
 * por `NEXT_PUBLIC_APP_ENV` (o mesmo sinal de ambiente que
 * `src/lib/dados/modo.ts` usa para o modo demonstração), não por
 * `KZ_DADOS`: esta rota não fala com o banco. `VERCEL_ENV=production` é a
 * segunda trava: um deploy de produção nunca abre a captura, mesmo com a
 * variável do app configurada errado.
 */
export function ehHomologacao(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_ENV === "homologacao" &&
    process.env.VERCEL_ENV !== "production"
  );
}

export function respostaForaDeHomologacao(): NextResponse {
  return NextResponse.json(
    {
      erro: "A rota de captura da UAZAPI só existe em homologação (NEXT_PUBLIC_APP_ENV=homologacao). Nada foi gravado.",
    },
    { status: 403 },
  );
}

/**
 * Os caminhos que imitam a UAZAPI (`send/text`, `send/media`,
 * `message/download`) aceitam o n8n sem credencial, de propósito: o token
 * da instância nunca sai do cofre em homologação (`n8n/src/lib/uazapi.mjs`).
 * Já o painel de conferência (listar e limpar o que foi capturado) e o
 * registro de transcrições são do roteiro de teste (P28), não do n8n:
 * esses exigem o segredo das rotas internas (`INTERNAL_ROUTES_SECRET`, no
 * cabeçalho `x-kz-interno-secret`), comparado em tempo constante como em
 * `/api/interno/notificar`. Sem isso, qualquer pessoa com a URL de
 * homologação leria as mensagens capturadas.
 */
export function controleAutorizado(requisicao: Request): boolean {
  const esperado = process.env.INTERNAL_ROUTES_SECRET;
  const recebido = requisicao.headers.get("x-kz-interno-secret");
  if (!esperado || !recebido) return false;
  const hashEsperado = createHash("sha256").update(esperado).digest();
  const hashRecebido = createHash("sha256").update(recebido).digest();
  return timingSafeEqual(hashEsperado, hashRecebido);
}

export function respostaSemSegredo(): NextResponse {
  return NextResponse.json(
    {
      erro: "O painel da captura exige o segredo das rotas internas (x-kz-interno-secret). Nada foi lido nem alterado.",
    },
    { status: 401 },
  );
}
