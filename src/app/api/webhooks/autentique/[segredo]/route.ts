import "server-only";
import {
  baixarPdfAssinado,
  buscarDocumento,
} from "@/lib/integracoes/autentique/cliente";
import { processarWebhookAutentique } from "@/lib/integracoes/autentique/webhook";
import { caminhoContrato } from "@/lib/armazenamento/caminhos";
import { criarArmazenamentoSupabase } from "@/lib/armazenamento/supabase";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import { obterCobrador } from "@/lib/integracoes/fabrica";
import {
  contratoDoDocumento,
  gerarLinksDoContrato,
  registrarAssinatura,
  registrarSaudeWebhook,
  type ClienteRpc,
} from "@/lib/integracoes/servico-webhooks";

/**
 * Webhook "documento finalizado" da Autentique (PRD 14, P31 item 3).
 * Segredo no caminho (`/api/webhooks/autentique/[segredo]`), comparado em
 * tempo constante com `AUTENTIQUE_WEBHOOK_SECRET`. O corpo do POST nunca
 * decide o estado: `processarWebhookAutentique` sempre reconsulta o
 * documento pela API antes de marcar o contrato como assinado, e é
 * idempotente (`public.contrato_registrar_assinatura` não muda contrato já
 * assinado).
 *
 * Depois da assinatura: guarda o PDF assinado no storage privado (nome pelo
 * id do contrato), registra a assinatura (a automação `pos_assinatura`
 * cria a cobrança, sob o freio) e pede à InfinitePay o link de pagamento.
 * O link é o último passo e nunca derruba a resposta: o contrato já está
 * assinado, e o financeiro gera o link de novo na tela da cobrança.
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

  let saude: ClienteRpc | null = null;
  try {
    const supabase = criarClienteServico(
      "webhook_autentique",
    ) as unknown as ClienteRpc;
    saude = supabase;
    const armazenamento = criarArmazenamentoSupabase();
    let contratoId: string | null = null;

    const resultado = await processarWebhookAutentique(
      { segredoRecebido: segredo, corpo },
      {
        segredoEsperado,
        buscarDocumento: (documentoId) =>
          buscarDocumento({ token }, documentoId),
        buscarContratoPorDocumento: async (documentoId) => {
          const contrato = await contratoDoDocumento(supabase, documentoId);
          contratoId = contrato?.id ?? null;
          return contrato;
        },
        marcarContratoAssinado: async (id, documento) => {
          // O PDF assinado vem do link que a reconsulta devolveu. Se não
          // der para guardá-lo, a assinatura vale do mesmo jeito (é o
          // fato) e o banco avisa o comercial para guardar à mão.
          let caminho: string | null = null;
          if (documento.arquivoAssinadoUrl) {
            try {
              const pdf = await baixarPdfAssinado(documento.arquivoAssinadoUrl);
              const destino = caminhoContrato(id, true);
              await armazenamento.salvar(destino, pdf, "application/pdf", true);
              caminho = destino;
            } catch {
              caminho = null;
            }
          }
          return registrarAssinatura(supabase, documento.id, caminho);
        },
      },
    );

    if (
      contratoId &&
      (resultado.motivo === "assinado" || resultado.motivo === "ja_assinado")
    ) {
      try {
        await gerarLinksDoContrato(supabase, contratoId, () =>
          obterCobrador(new URL(request.url).origin),
        );
      } catch {
        // O link é refeito na tela da cobrança; a assinatura já está gravada.
      }
    }

    // Saúde (P14): só a chamada válida conta como acerto; 401 de segredo
    // errado não pode esconder um webhook parado.
    if (resultado.status === 200) {
      await registrarSaudeWebhook(supabase, "autentique", true);
    }
    return Response.json(
      { ok: resultado.mudouEstado },
      { status: resultado.status },
    );
  } catch {
    // Sem detalhe na resposta nem no log: o erro pode citar dado do
    // contrato (CLAUDE.md, nada de dado pessoal em log).
    if (saude) await registrarSaudeWebhook(saude, "autentique", false);
    return Response.json({ ok: false }, { status: 500 });
  }
}
