import { NextResponse } from "next/server";
import {
  controleAutorizado,
  ehHomologacao,
  respostaForaDeHomologacao,
  respostaSemSegredo,
} from "./_lib/guarda";
import { obterLojaTesteUazapi, reiniciarLojaTesteUazapi } from "./_lib/loja";

/**
 * Rota de captura da UAZAPI (PROMPTS.md P25 item 5, P27; `n8n/IMPORTAR.md`
 * e `n8n/src/lib/uazapi.mjs`): com `homologacao.envioSimulado` e
 * `homologacao.transcricaoSimulada` ligados, os fluxos 2 e 3 do n8n mandam
 * para cá, nos mesmos caminhos da UAZAPI real (`/send/text`,
 * `/send/media`, `/message/download`), sem credencial. Existe só em
 * homologação; fora dela, toda rota abaixo devolve 403 sem gravar nada.
 *
 * Este arquivo (a raiz `/api/teste/uazapi`) é o painel de conferência que
 * o roteiro de homologação (P28) usa: `GET` lista o que foi capturado,
 * `DELETE` limpa entre casos de teste. Os dois exigem o segredo das rotas
 * internas (`_lib/guarda.ts`).
 */

export async function GET(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  const loja = obterLojaTesteUazapi();
  return NextResponse.json({ envios: loja.envios });
}

export async function DELETE(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  reiniciarLojaTesteUazapi();
  return NextResponse.json({ ok: true });
}
