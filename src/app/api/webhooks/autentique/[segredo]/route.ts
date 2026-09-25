import "server-only";
import { buscarDocumento } from "@/lib/integracoes/autentique/cliente";
import { processarWebhookAutentique } from "@/lib/integracoes/autentique/webhook";
import { criarClienteServico } from "@/lib/db/cliente-servico";

/**
 * Webhook "documento finalizado" da Autentique (PRD 14, P31 item 3).
 * Segredo no caminho (`/api/webhooks/autentique/[segredo]`), comparado com
 * `AUTENTIQUE_WEBHOOK_SECRET`. O corpo do POST nunca decide o estado: a
 * lógica em `processarWebhookAutentique` sempre reconsulta o documento pela
 * API antes de marcar o contrato como assinado, e é idempotente.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ segredo: string }> },
): Promise<Response> {
  const { segredo } = await context.params;

  const token = process.env.AUTENTIQUE_API_TOKEN;
  const segredoEsperado = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  if (!token || !segredoEsperado) {
    // Sem credencial configurada, a rota nem tenta: erro de ambiente, não
    // de negócio (CLAUDE.md, segredo só em variável de ambiente).
    return Response.json(
      { ok: false, erro: "webhook não configurado" },
      { status: 500 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const sandbox = process.env.NEXT_PUBLIC_APP_ENV !== "producao";
  const supabase = criarClienteServico("webhook_autentique");

  const resultado = await processarWebhookAutentique(
    { segredoRecebido: segredo, corpo },
    {
      segredoEsperado,
      buscarDocumento: (documentoId) =>
        buscarDocumento({ token, sandbox }, documentoId),
      buscarContratoPorDocumento: async (documentoId) => {
        const { data } = await supabase
          .from("contrato")
          .select("id, status")
          .eq("autentique_doc_id", documentoId)
          .maybeSingle();
        return data;
      },
      marcarContratoAssinado: async (contratoId) => {
        await supabase
          .from("contrato")
          .update({ status: "assinado", assinado_em: new Date().toISOString() })
          .eq("id", contratoId);
        // [conferir] disparo de `pos_assinatura` e upload do PDF assinado
        // ao storage privado (P31 itens 3 e 4) ficam com a trilha de venda,
        // que gera o PDF e liga a automação; este webhook só garante que o
        // estado nunca muda sem reconsulta e nunca muda duas vezes.
      },
    },
  );

  return Response.json(
    { ok: resultado.mudouEstado },
    { status: resultado.status },
  );
}
