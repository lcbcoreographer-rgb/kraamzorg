"use client";

import * as React from "react";
import {
  usePathname,
  useSearchParams,
  useSelectedLayoutSegments,
} from "next/navigation";
import { cn } from "@/lib/utils";
import { lerFiltro, type FiltroLista } from "../lista";
import { ListaConversas, type ListaConversasProps } from "./lista-conversas";

/**
 * Conversas em duas colunas, como o WhatsApp Web (pedido do dono em
 * 30/09). No computador, a lista à esquerda e a conversa aberta à direita,
 * as duas com rolagem própria e da altura da tela. No celular, a lista em
 * tela cheia; ao tocar numa linha, a conversa abre em tela cheia por cima
 * (com o voltar no cabeçalho), sem a navegação em pílula, como no
 * aplicativo do WhatsApp.
 *
 * O que está aberto vem do segmento da rota (`/conversas/<id>` ou
 * `/conversas/transferencia/<id>`), lido aqui no cliente porque o layout
 * não re-renderiza ao trocar de conversa.
 */
export function DuasColunasConversas({
  lista,
  children,
}: {
  lista: React.ReactNode;
  children: React.ReactNode;
}) {
  const aberta = useSelectedLayoutSegments().length > 0;
  return (
    <div className="lg:mt-3 lg:-mb-9 lg:grid lg:h-[calc(100dvh-24px)] lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-3">
      {/* Com a conversa em tela cheia no celular, a lista (e o título dela)
          some; o título da tela continua para o leitor de tela. */}
      {aberta ? <h1 className="sr-only lg:hidden">Conversas</h1> : null}
      <div className={cn("lg:flex lg:min-h-0 lg:flex-col", aberta && "hidden")}>
        {lista}
      </div>
      <div
        className={cn(
          "lg:static lg:z-auto lg:flex lg:min-h-0 lg:flex-col lg:bg-transparent",
          aberta
            ? "bg-fundo fixed inset-0 z-[var(--z-folha)] flex flex-col"
            : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A lista ligada à URL: o filtro mora em `?filtro=` (a antiga rota
 * `/transferencias` chega em `?filtro=esperando`) e segue junto quando a
 * pessoa abre uma conversa. Trocar de filtro não recarrega a tela: só
 * troca o endereço (`history.replaceState`, que o roteador do Next
 * acompanha).
 */
export function ListaConversasNaTela(
  props: Omit<ListaConversasProps, "filtro" | "aoTrocarFiltro" | "selecionada">,
) {
  const parametros = useSearchParams();
  const caminho = usePathname();
  const segmentos = useSelectedLayoutSegments();
  const filtro = lerFiltro(parametros.get("filtro"));

  function aoTrocarFiltro(proximo: FiltroLista) {
    const novos = new URLSearchParams(parametros.toString());
    if (proximo === "todas") novos.delete("filtro");
    else novos.set("filtro", proximo);
    const busca = novos.toString();
    window.history.replaceState(
      null,
      "",
      busca ? `${caminho}?${busca}` : caminho,
    );
  }

  return (
    <ListaConversas
      {...props}
      filtro={filtro}
      aoTrocarFiltro={aoTrocarFiltro}
      selecionada={segmentos.join("/") || null}
    />
  );
}
