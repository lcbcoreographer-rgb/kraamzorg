"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { SinoCalmo } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { cn } from "@/lib/utils";
import { TITULO_FILTRO } from "../../formatacao";
import type { ConversaComPausa, SituacaoConversa } from "../../tipos";
import { CartaoConversa } from "./cartao-conversa";

type Filtro = "todas" | SituacaoConversa;

const FILTROS: Filtro[] = [
  "todas",
  "isadora",
  "equipe",
  "pausada",
  "freio",
  "nao_lead",
];

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
  freio: {
    titulo: "Nenhuma família com freio",
    texto:
      "Quando alguém da equipe aciona o freio de uma família, a conversa dela aparece aqui, só com resposta da equipe, pelo nome.",
  },
  nao_lead: {
    titulo: "Nenhuma conversa de não lead",
    texto:
      "Candidatas, fornecedores e consultórios recebem um encaminhamento e aparecem aqui.",
  },
};

/**
 * Tom de cada filtro pelo que ele é (DESIGN.md, 2.5): a Isadora conduzindo
 * é o agora, a equipe são pessoas, a pausa é tempo. Freio e não lead ficam
 * em branco com contorno.
 */
const FUNDO_FILTRO: Record<Filtro, string> = {
  todas: "bg-areia-clara",
  isadora: "bg-dourado-claro",
  equipe: "bg-argila-clara",
  pausada: "bg-lavanda-clara",
  freio: "bg-superficie border border-linha",
  nao_lead: "bg-superficie border border-linha",
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
      freio: 0,
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
    <div className="flex flex-col gap-6">
      {/* Números que filtram (direção "Colo", DESIGN.md 2.3 e 2.5): cada
          situação é um bloco com o número grande e o tom de quem está com a
          conversa. Botões de alternância (aria-pressed), não abas: o filtro
          só troca o que a lista mostra, sem painéis separados. O rótulo vem
          antes do número no DOM, para o nome acessível começar por ele
          ("Pausadas 1"); o número aparece em cima por `flex-col-reverse`.
          Freio e não lead ficam sem tom (momento sensível e fora do
          comercial). */}
      <div
        role="group"
        aria-label="Mostrar conversas"
        className="tablet:grid-cols-6 grid grid-cols-3 gap-2"
      >
        {FILTROS.map((item) => {
          const ativo = filtro === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={ativo}
              onClick={() => definirFiltro(item)}
              className={cn(
                "rounded-3 ease-estado flex min-h-20 flex-col-reverse items-start justify-end gap-1 px-3.5 py-3 text-left transition-[background-color,box-shadow,transform] duration-140 active:scale-[0.98]",
                ativo
                  ? "bg-acao text-acao-texto shadow-1"
                  : cn(FUNDO_FILTRO[item], "text-texto hover:shadow-1"),
              )}
            >
              <span className="text-mini leading-tight font-semibold">
                {TITULO_FILTRO[item]}
              </span>
              <span className="font-titulo text-numero-sm font-medium tabular-nums">
                {contagem[item]}
              </span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={
            filtro === "freio" ? undefined : <SinoCalmo tamanho={104} />
          }
          semTom={filtro === "freio"}
          titulo={VAZIO[filtro].titulo}
          texto={VAZIO[filtro].texto}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {visiveis.map((conversa) => (
            <CartaoConversa key={conversa.id} conversa={conversa} />
          ))}
        </div>
      )}
    </div>
  );
}
