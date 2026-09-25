"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TITULO_FILTRO } from "../../formatacao";
import type { ConversaComPausa, SituacaoConversa } from "../../tipos";
import { CartaoConversa } from "./cartao-conversa";

type Filtro = "todas" | SituacaoConversa;

const FILTROS: Filtro[] = ["todas", "isadora", "equipe", "pausada", "nao_lead"];

const VAZIO: Record<Filtro, { titulo: string; texto: string }> = {
  todas: {
    titulo: "Nenhuma conversa agora",
    texto:
      "Quando uma família nova escrever, a Isadora abre a conversa e ela aparece aqui.",
  },
  isadora: {
    titulo: "Nenhuma conversa com a Isadora agora",
    texto:
      "Quando uma família nova escrever, a Isadora abre a conversa e ela aparece aqui.",
  },
  equipe: {
    titulo: "Nenhuma conversa com a equipe",
    texto:
      "Quando você ou outra pessoa assumir uma conversa, ela aparece aqui até ser resolvida.",
  },
  pausada: {
    titulo: "Nenhuma conversa pausada",
    texto:
      "Quando uma transferência abrir ou alguém pausar a Isadora, a conversa aparece aqui com a hora em que ela volta.",
  },
  nao_lead: {
    titulo: "Nenhuma conversa de não lead",
    texto:
      "Candidatas, fornecedores e consultórios recebem um encaminhamento e aparecem aqui.",
  },
};

/**
 * Lista de conversas com filtro por situação (P27 item 1, protótipo
 * `comercial-conversas.html`, C5). O filtro é local: a lista completa já
 * chegou do servidor, e trocar de aba só troca o que aparece, sem recarregar
 * a tela (mesmo comportamento do protótipo).
 */
export function ListaConversas({
  conversas,
}: {
  conversas: ConversaComPausa[];
}) {
  const [filtro, definirFiltro] = useState<Filtro>("todas");

  const contagem = useMemo(() => {
    const n: Record<Filtro, number> = {
      todas: 0,
      isadora: 0,
      equipe: 0,
      pausada: 0,
      nao_lead: 0,
    };
    for (const c of conversas) {
      n.todas++;
      n[c.situacao]++;
    }
    return n;
  }, [conversas]);

  const visiveis = useMemo(
    () =>
      filtro === "todas"
        ? conversas
        : conversas.filter((c) => c.situacao === filtro),
    [conversas, filtro],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Botões de alternância (aria-pressed), não abas: o filtro só troca o
          que a lista mostra, sem painéis separados, e cada botão é um tab
          stop comum, sem exigir a navegação por setas do padrão de abas. */}
      <div
        role="group"
        aria-label="Mostrar conversas"
        className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
      >
        {FILTROS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filtro === item}
            onClick={() => definirFiltro(item)}
            className={`min-h-toque rounded-pilula border-borda-campo text-apoio inline-flex shrink-0 items-center gap-2 border-[1.5px] px-4 font-medium whitespace-nowrap ${
              filtro === item
                ? "border-acao bg-acao text-acao-texto"
                : "bg-superficie text-texto hover:bg-marinho-08"
            }`}
          >
            {TITULO_FILTRO[item]}
            <span className="font-mono tabular-nums">{contagem[item]}</span>
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          titulo={VAZIO[filtro].titulo}
          texto={VAZIO[filtro].texto}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visiveis.map((conversa) => (
            <CartaoConversa key={conversa.id} conversa={conversa} />
          ))}
        </div>
      )}
    </div>
  );
}
