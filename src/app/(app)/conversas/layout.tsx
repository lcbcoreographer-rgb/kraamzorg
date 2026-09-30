import type { ReactNode } from "react";
import { Suspense } from "react";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { listarConversasTela } from "@/modules/agente/conversas/dados";
import {
  DuasColunasConversas,
  ListaConversasNaTela,
} from "@/modules/agente/conversas/componentes/duas-colunas";
import { listarFilaTela } from "@/modules/agente/transferencias/dados";
import type {
  ConversaComPausa,
  TransferenciaTela,
} from "@/modules/agente/tipos";

/**
 * Conversas em duas colunas, como o WhatsApp Web (pedido do dono em
 * 30/09): a lista mora no layout e fica de pé enquanto a pessoa troca de
 * conversa; a conversa aberta (`[id]`) ou o pedido sem conversa
 * (`transferencia/[id]`) vem ao lado. As transferências moram aqui dentro:
 * "Esperando alguém" é a antiga fila, e a transferência aberta aparece no
 * topo da conversa. Dono: P27.
 */
export default async function LayoutConversas({
  children,
}: {
  children: ReactNode;
}) {
  await exigirSessao("/conversas");
  return (
    <DuasColunasConversas
      lista={
        <Suspense fallback={<EsqueletoLista />}>
          <ListaDoServidor />
        </Suspense>
      }
    >
      {children}
    </DuasColunasConversas>
  );
}

async function ListaDoServidor() {
  let conversas: ConversaComPausa[] | null = null;
  let fila: TransferenciaTela[] = [];
  try {
    [conversas, fila] = await Promise.all([
      listarConversasTela(),
      listarFilaTela(),
    ]);
  } catch {
    conversas = null;
  }

  if (!conversas) {
    return (
      <div className="flex flex-col gap-4 pt-3 lg:px-4 lg:pt-5">
        <h1 className="font-titulo text-display text-texto font-normal">
          Conversas
        </h1>
        <FaixaAlerta
          variante="erro"
          titulo="Não foi possível carregar as conversas agora"
        >
          Confira a conexão e recarregue a página. Se continuar, avise a equipe
          técnica.
        </FaixaAlerta>
      </div>
    );
  }
  return <ListaConversasNaTela conversas={conversas} fila={fila} />;
}

/**
 * Carregando a lista (telas.md C5, estado "carregando"): o título, a busca,
 * os filtros em pílula e as linhas com o avatar, sem spinner. Sem animação
 * quando a pessoa pediu menos movimento.
 */
function EsqueletoLista() {
  return (
    <div
      role="status"
      aria-label="Carregando as conversas"
      className="lg:bg-superficie lg:rounded-3 flex flex-col gap-3 pt-3 motion-safe:animate-pulse lg:h-full lg:px-4 lg:pt-5"
    >
      <div className="bg-marinho-14 rounded-pilula h-8 w-40" />
      <div className="bg-marinho-08 rounded-pilula min-h-toque" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-areia-clara rounded-pilula min-h-toque w-28"
          />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="bg-argila-clara rounded-pilula size-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="bg-marinho-14 rounded-pilula h-4 w-3/5" />
            <div className="bg-marinho-08 rounded-pilula h-3.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
