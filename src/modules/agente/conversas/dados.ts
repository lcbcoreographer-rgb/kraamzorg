import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { FiltroConversas } from "@/lib/dados/tipos";
import { paraConversaComPausa } from "../formatacao";
import { pausaMotivoDemonstracao, pausaMotivosReais } from "../repositorio";
import type { ConversaComPausa } from "../tipos";

/**
 * Lista de conversas (P27 item 1, protótipo `comercial-conversas.html`,
 * C5): em que mão está cada uma, com filtro por situação. A contagem de
 * cada filtro vem de pedir a lista completa uma vez (o volume de conversas
 * de uma operação deste porte cabe inteiro na tela, como o protótipo já
 * assume ao trazer "todas" como aba inicial).
 */
export async function listarConversasTela(
  agora: Date = new Date(),
): Promise<ConversaComPausa[]> {
  const [conversas, transferenciasAbertas] = await Promise.all([
    agente.listarConversas({ limite: 200 }),
    agente.listarTransferencias({ status: ["aberto", "assumido"] }),
  ]);

  // Mensagem de saúde ou de estado sensível não aparece como prévia nesta
  // lista (DESIGN.md, telas.md C5): a fila e a conversa já avisam.
  const motivosSensiveisPorConversa = new Set(
    transferenciasAbertas
      .filter((t) => ["saude", "perda", "estado_sensivel_escreveu"].includes(t.motivo))
      .map((t) => t.conversaId)
      .filter((id): id is string => Boolean(id)),
  );

  const motivos =
    modoDados() === "demonstracao"
      ? Object.fromEntries(
          conversas.map((c) => [c.id, pausaMotivoDemonstracao(c.id)]),
        )
      : await pausaMotivosReais(
          conversas.filter((c) => c.agentePausadoAte).map((c) => c.id),
        );

  const previas = await Promise.all(
    conversas.map(async (c) => {
      if (motivosSensiveisPorConversa.has(c.id)) return null;
      const mensagens = await agente.mensagensDaConversa(c.id);
      const ultima = mensagens.at(-1);
      return ultima ? { conteudo: ultima.conteudo, enviadoPor: ultima.enviadoPor } : null;
    }),
  );

  return conversas.map((c, i) =>
    paraConversaComPausa(c, motivos[c.id] ?? null, previas[i] ?? null, agora),
  );
}

export type { FiltroConversas };
