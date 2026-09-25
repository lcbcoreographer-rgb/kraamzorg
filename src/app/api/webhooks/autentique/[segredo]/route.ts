import "server-only";
import { buscarDocumento } from "@/lib/integracoes/autentique/cliente";
import { processarWebhookAutentique } from "@/lib/integracoes/autentique/webhook";
import { criarClienteServico } from "@/lib/db/cliente-servico";

/**
 * Webhook "documento finalizado" da Autentique (PRD 14, P31 item 3).
 * Segredo no caminho (`/api/webhooks/autentique/[segredo]`), comparado em
 * tempo constante com `AUTENTIQUE_WEBHOOK_SECRET`. O corpo do POST nunca
 * decide o estado: `processarWebhookAutentique` sempre reconsulta o
 * documento pela API antes de marcar o contrato como assinado, e é
 * idempotente (a gravação é condicional no banco).
 *
 * Falha de rede na reconsulta ou de banco na gravação responde 500 sem
 * detalhe, para a Autentique reenviar; nada é gravado pela metade.
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
    return Response.json({ ok: false }, { status: 500 });
  }

  const corpo: unknown = await request.json().catch(() => null);

  try {
    const supabase = criarClienteServico("webhook_autentique");
    const resultado = await processarWebhookAutentique(
      { segredoRecebido: segredo, corpo },
      {
        segredoEsperado,
        buscarDocumento: (documentoId) =>
          buscarDocumento({ token }, documentoId),
        buscarContratoPorDocumento: async (documentoId) => {
          const { data, error } = await supabase
            .from("contrato")
            .select("id, status")
            .eq("autentique_doc_id", documentoId)
            .maybeSingle();
          if (error) throw new Error("falha ao ler o contrato");
          return data;
        },
        marcarContratoAssinado: async (contratoId) => {
          // Condicional: só grava se ainda não estiver assinado, então dois
          // webhooks simultâneos nunca gravam duas vezes.
          const { data, error } = await supabase
            .from("contrato")
            .update({
              status: "assinado",
              assinado_em: new Date().toISOString(),
            })
            .eq("id", contratoId)
            .neq("status", "assinado")
            .select("id");
          if (error) throw new Error("falha ao gravar o contrato");
          // [conferir] disparo de `pos_assinatura`, transição da
          // oportunidade e PDF assinado no storage privado (P31 itens 3 e
          // 4) ficam com a trilha de venda; este webhook só garante que o
          // estado nunca muda sem reconsulta e nunca muda duas vezes.
          return (data?.length ?? 0) > 0;
        },
      },
    );

    return Response.json(
      { ok: resultado.mudouEstado },
      { status: resultado.status },
    );
  } catch {
    // Sem detalhe na resposta nem no log: o erro pode citar dado do
    // contrato (CLAUDE.md, nada de dado pessoal em log).
    return Response.json({ ok: false }, { status: 500 });
  }
}
