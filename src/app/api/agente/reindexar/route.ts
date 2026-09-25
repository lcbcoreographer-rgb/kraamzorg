import { NextResponse } from "next/server";
import { precisaMfa } from "@/lib/auth/acesso";
import { obterSessao } from "@/lib/auth/sessao";

/**
 * Rota do app que chama o webhook de reindexação do fluxo 1 (PROMPTS.md
 * P26 item 3: "rota do app que chama o webhook de reindexação, o botão
 * vem no P27"; botão "Reindexar" em `/agente`).
 *
 * O segredo do webhook do n8n (`webhooks.fluxo1Reindexar` do config,
 * `n8n/IMPORTAR.md`) mora só no caminho da URL, numa variável de ambiente
 * de servidor (`N8N_WEBHOOK_REINDEXAR_URL`, nunca `NEXT_PUBLIC_*`): o
 * navegador nunca vê essa URL, só chama esta rota, que a repassa. Sem a
 * variável configurada (ambiente local, sem instância de n8n), a rota
 * devolve um erro claro em vez de tentar adivinhar um endereço.
 */
export async function POST() {
  // `obterSessao` (não `exigirSessao`): uma rota de API devolve JSON com o
  // código HTTP certo, não redireciona para /entrar (o cliente é um
  // `fetch` do botão "Reindexar", não uma navegação).
  const sessao = await obterSessao();
  if (!sessao || !sessao.ativo || sessao.papeis.length === 0) {
    return NextResponse.json(
      { erro: "Sem sessão. Entre de novo e tente outra vez." },
      { status: 401 },
    );
  }
  const podeReindexar =
    sessao.papeis.includes("comercial") ||
    sessao.papeis.includes("coordenacao") ||
    sessao.papeis.includes("diretoria");
  if (!podeReindexar) {
    return NextResponse.json(
      { erro: "Sem permissão para reindexar." },
      { status: 403 },
    );
  }
  // Mesma regra de AAL2 das telas (PRD 13, 21.2): quem tem papel que exige
  // MFA e ainda não confirmou o código não aciona nada por aqui.
  if (precisaMfa(sessao)) {
    return NextResponse.json(
      { erro: "Confirme o código do aplicativo (MFA) e tente de novo." },
      { status: 403 },
    );
  }

  const url = process.env.N8N_WEBHOOK_REINDEXAR_URL;
  if (!url) {
    return NextResponse.json(
      {
        erro: "A reindexação ainda não está configurada neste ambiente (falta N8N_WEBHOOK_REINDEXAR_URL). Avise a equipe técnica.",
      },
      { status: 503 },
    );
  }

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        acionado_por: sessao.usuarioId,
        em: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resposta.ok) {
      return NextResponse.json(
        { erro: `O webhook de reindexação recusou (HTTP ${resposta.status}).` },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { erro: "Não foi possível falar com o webhook de reindexação agora." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
