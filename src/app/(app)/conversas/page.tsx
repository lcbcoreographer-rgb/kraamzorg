import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { listarConversasTela } from "@/modules/agente/conversas/dados";
import { ListaConversas } from "@/modules/agente/conversas/componentes/lista-conversas";
import type { ConversaComPausa } from "@/modules/agente/tipos";

export const metadata: Metadata = { title: "Conversas · Kraamzorg OS" };

/**
 * Conversas com a Isadora, filtráveis por situação (P27 item 1, PRD 11.3 e
 * 11.4; protótipo `comercial-conversas.html`, C5). Dono: P27.
 */
export default async function PaginaConversas() {
  await exigirSessao("/conversas");

  let conversas: ConversaComPausa[] | null = null;
  try {
    conversas = await listarConversasTela();
  } catch {
    conversas = null;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Conversas"
        subtitulo="Em que mão está cada conversa: com a Isadora, com a equipe, pausada ou fora do comercial."
      />
      <div className="pt-6">
        {conversas ? (
          <ListaConversas conversas={conversas} />
        ) : (
          <FaixaAlerta variante="imediato" titulo="Não foi possível carregar as conversas agora">
            Confira a conexão e recarregue a página. Se continuar, avise a equipe técnica.
          </FaixaAlerta>
        )}
      </div>
    </>
  );
}
