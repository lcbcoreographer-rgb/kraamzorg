import "server-only";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import {
  assinaturaValida,
  extrairStatus,
  responderDesafio,
} from "@/lib/integracoes/whatsapp/webhook";
import {
  registrarSaudeWebhook,
  registrarStatusEntrega,
  type ClienteRpc,
} from "@/lib/integracoes/servico-webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook da Cloud API do WhatsApp (P18b item 4, PRD 14): estado de entrega
 * das mensagens que o app e o n8n mandaram (enviada, entregue, lida,
 * falhou), gravado em `privado.mensagem_status` por
 * `public.mensagem_registrar_status`.
 *
 * GET: desafio de inscrição da Meta, conferido com `WHATSAPP_VERIFY_TOKEN`
 * em tempo constante. POST: só com a assinatura `X-Hub-Signature-256` certa
 * (HMAC-SHA256 do corpo bruto com `WHATSAPP_APP_SECRET`); sem o segredo
 * configurado, tudo é recusado. Mensagem recebida da família NÃO passa por
 * aqui (a ingestão do fluxo 3 é outra entrada); só os `statuses` são lidos.
 * Idempotente: a Meta repete envio, e cada estado entra uma vez por mensagem.
 * Nunca escreve telefone, texto ou corpo em log; o telefone do destinatário
 * nem sai da função que lê a carga.
 *
 * Erro de banco responde 500 sem detalhe para a Meta reenviar.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const desafio = responderDesafio(
    url.searchParams,
    process.env.WHATSAPP_VERIFY_TOKEN,
  );
  if (desafio === null) return new Response("forbidden", { status: 403 });
  return new Response(desafio, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const bruto = await request.text();
  if (
    !assinaturaValida(
      bruto,
      request.headers.get("x-hub-signature-256"),
      process.env.WHATSAPP_APP_SECRET,
    )
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let carga: unknown = null;
  try {
    carga = JSON.parse(bruto);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const estados = extrairStatus(carga);
  if (estados.length === 0) {
    return Response.json({ ok: true, gravados: 0 });
  }

  let cliente: ClienteRpc;
  try {
    cliente = criarClienteServico("webhook_whatsapp") as unknown as ClienteRpc;
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }

  try {
    let gravados = 0;
    for (const estado of estados) {
      if (await registrarStatusEntrega(cliente, estado)) gravados += 1;
    }
    await registrarSaudeWebhook(cliente, "whatsapp", true);
    return Response.json({ ok: true, gravados });
  } catch {
    await registrarSaudeWebhook(cliente, "whatsapp", false);
    return Response.json({ ok: false }, { status: 500 });
  }
}
