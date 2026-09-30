"use client";

import * as React from "react";
import { useLayoutEffect, useRef } from "react";

/**
 * O meio da conversa: o topo (a transferência aberta, quem conduz, o
 * resumo da Isadora) e as mensagens.
 *
 * - Computador: o topo fica preso embaixo do cabeçalho, e só as mensagens
 *   rolam, abrindo no fim, como o WhatsApp Web.
 * - Celular: topo e mensagens rolam juntos, para a faixa da transferência
 *   nunca ficar cortada numa tela pequena. Com transferência aberta, a
 *   conversa abre no topo (a faixa primeiro); sem, abre no fim, na última
 *   mensagem.
 *
 * Volta ao fim quando chega mensagem nova (a quantidade muda depois de
 * enviar).
 */
export function CorpoConversa({
  topo,
  quantidade,
  comecarNoTopo,
  children,
}: {
  topo: React.ReactNode;
  /** Quantas mensagens há; quando muda, as mensagens descem até o fim. */
  quantidade: number;
  /** No celular, abre mostrando o topo (há transferência para agir). */
  comecarNoTopo: boolean;
  children: React.ReactNode;
}) {
  const externo = useRef<HTMLDivElement>(null);
  const mensagens = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Só uma das duas áreas rola em cada largura; na outra, a atribuição
    // não faz nada.
    const area = mensagens.current;
    if (area) area.scrollTop = area.scrollHeight;
    const tudo = externo.current;
    if (tudo && !comecarNoTopo) tudo.scrollTop = tudo.scrollHeight;
  }, [quantidade, comecarNoTopo]);

  return (
    <div
      ref={externo}
      className="bg-fundo min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden"
    >
      <div
        // No computador esta área rola quando cresce: recebe o foco para
        // rolar pelo teclado mesmo sem botão dentro (a perda vista por quem
        // não é da coordenação, por exemplo).
        tabIndex={0}
        role="region"
        aria-label="Transferência e quem conduz"
        className="flex flex-col gap-2 px-3 pt-3 empty:hidden focus-visible:outline-offset-[-2px] lg:max-h-[65%] lg:shrink-0 lg:overflow-y-auto lg:px-4 lg:pb-2"
      >
        {topo}
      </div>
      <div
        ref={mensagens}
        // Rola com o teclado (setas, Page Down) quando recebe o foco.
        tabIndex={0}
        role="region"
        aria-label="Mensagens da conversa"
        className="px-3 py-3 focus-visible:outline-offset-[-2px] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-6"
      >
        {children}
      </div>
    </div>
  );
}
