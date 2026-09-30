"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { FolhaLupa, SinoCalmo } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { cn } from "@/lib/utils";
import { TITULO_FILTRO } from "../../formatacao";
import type { ConversaComPausa, TransferenciaTela } from "../../tipos";
import {
  filtrarLinhas,
  FILTROS_LISTA,
  linhaDoFiltro,
  montarLinhas,
  type FiltroLista,
  type LinhaLista as Linha,
} from "../lista";
import { LinhaLista } from "./linha-lista";

const ROTULO_FILTRO: Record<FiltroLista, string> = {
  ...TITULO_FILTRO,
  esperando: "Esperando alguém",
  isadora: "Com a Isadora",
};

const VAZIO: Record<FiltroLista, { titulo: string; texto: string }> = {
  todas: {
    titulo: "Nenhuma conversa agora",
    texto:
      "Quando uma família nova escrever, a Isadora abre a conversa e ela aparece aqui.",
  },
  esperando: {
    titulo: "Ninguém esperando agora",
    texto:
      "A Isadora continua a triagem e avisa aqui quando alguém quiser contratar, marcar a conversa ou falar com uma pessoa.",
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

function hrefDaLinha(linha: Linha, filtro: FiltroLista): string {
  const base =
    linha.tipo === "conversa"
      ? `/conversas/${linha.conversa.id}`
      : `/conversas/transferencia/${linha.pedido.id}`;
  return filtro === "todas" ? base : `${base}?filtro=${filtro}`;
}

function chaveSelecionada(selecionada: string | null | undefined) {
  if (!selecionada) return null;
  return selecionada.startsWith("transferencia/")
    ? `p:${selecionada.slice("transferencia/".length)}`
    : `c:${selecionada}`;
}

export interface ListaConversasProps {
  conversas: ConversaComPausa[];
  /** A fila de transferências (prazo, aviso ao grupo, pedido sem conversa). */
  fila?: TransferenciaTela[];
  /**
   * Filtro vindo da URL (`?filtro=`). Com ele, a lista é controlada pela
   * URL e `aoTrocarFiltro` atualiza o endereço; sem ele, o filtro mora no
   * estado local (teste, uso isolado).
   */
  filtro?: FiltroLista;
  aoTrocarFiltro?: (filtro: FiltroLista) => void;
  /**
   * O que está aberto ao lado: o id da conversa, ou
   * `transferencia/<id>` para um pedido sem conversa.
   */
  selecionada?: string | null;
}

/**
 * Lista de conversas em duas colunas, como o WhatsApp Web (pedido do dono
 * em 30/09). Busca por nome ou telefone, filtros em pílula com a contagem
 * e uma linha por conversa. "Esperando alguém" é a antiga fila de
 * transferências, na ordem da fila; prioridade máxima esperando alguém
 * fica sempre no topo e nunca some por filtro (fluxos.md, fluxo E).
 */
export function ListaConversas({
  conversas,
  fila = [],
  filtro: filtroControlado,
  aoTrocarFiltro,
  selecionada,
}: ListaConversasProps) {
  const [filtroLocal, definirFiltroLocal] = useState<FiltroLista>("todas");
  const [busca, definirBusca] = useState("");
  const filtro = filtroControlado ?? filtroLocal;
  // A hora de agora fica presa na montagem, para a prévia não mudar entre
  // o servidor e o navegador.
  const [agora] = useState(() => new Date());

  const { linhas: todas, ordemFila } = useMemo(
    () => montarLinhas(conversas, fila),
    [conversas, fila],
  );
  const { fixadas, linhas, contagem } = useMemo(
    () => filtrarLinhas(todas, filtro, busca, ordemFila),
    [todas, filtro, busca, ordemFila],
  );
  const chaveAberta = chaveSelecionada(selecionada);

  // O filtro ativo sempre à vista: a fileira de pílulas rola de lado, e
  // quem chega por um link ("Com a equipe", "Esperando alguém") precisa
  // ver qual está marcado.
  const pilulas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grupo = pilulas.current;
    const ativo = grupo?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!grupo || !ativo) return;
    const fora =
      ativo.offsetLeft < grupo.scrollLeft ||
      ativo.offsetLeft + ativo.offsetWidth >
        grupo.scrollLeft + grupo.clientWidth;
    if (fora) {
      grupo.scrollLeft =
        ativo.offsetLeft - (grupo.clientWidth - ativo.offsetWidth) / 2;
    }
  }, [filtro]);

  function escolher(proximo: FiltroLista) {
    if (aoTrocarFiltro) aoTrocarFiltro(proximo);
    if (filtroControlado === undefined) definirFiltroLocal(proximo);
  }

  const buscando = busca.trim().length > 0;
  // As fixadas contam como do filtro quando são dele ("Esperando alguém",
  // "Todas"): aí o vazio não aparece embaixo delas.
  const vazio =
    linhas.length === 0 &&
    !fixadas.some((linha) => linhaDoFiltro(linha, filtro));

  return (
    <div className="lg:bg-superficie lg:rounded-3 lg:shadow-1 flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 pt-3 pb-4 lg:px-4 lg:pt-5 lg:pb-3">
        <h1 className="font-titulo text-display text-texto font-normal">
          Conversas
        </h1>
        <div className="relative">
          <label htmlFor="busca-conversas" className="sr-only">
            Buscar conversa por nome ou telefone
          </label>
          <Search
            aria-hidden="true"
            className="text-texto-2 pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            strokeWidth={1.75}
          />
          <input
            id="busca-conversas"
            type="search"
            value={busca}
            onChange={(evento) => definirBusca(evento.target.value)}
            placeholder="Buscar por nome ou telefone"
            autoComplete="off"
            className="rounded-pilula border-borda-campo bg-superficie text-corpo text-texto placeholder:text-texto-3 min-h-toque hover:border-marinho-72 w-full border-[1.5px] pr-4 pl-11"
          />
        </div>
        {/* Filtros em pílula que rolam de lado (DESIGN.md, 3: só listas de
            abas e chips rolam de lado). Botões de alternância
            (aria-pressed), não abas: o filtro só troca o que a lista
            mostra. O rótulo vem antes do número, para o nome acessível
            começar por ele ("Pausadas 1"). */}
        <div
          ref={pilulas}
          role="group"
          aria-label="Mostrar conversas"
          className="relative -mx-4 flex [scrollbar-width:thin] gap-2 overflow-x-auto px-4 pb-1"
        >
          {FILTROS_LISTA.map((item) => {
            const ativo = item === filtro;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={ativo}
                onClick={() => escolher(item)}
                className={cn(
                  "rounded-pilula text-apoio ease-estado min-h-toque inline-flex shrink-0 items-center gap-2 px-4 font-semibold whitespace-nowrap transition-colors duration-140",
                  ativo
                    ? "bg-acao text-acao-texto"
                    : "bg-areia-clara text-texto hover:bg-areia",
                )}
              >
                {ROTULO_FILTRO[item]}
                <span className="text-mini font-mono font-medium tabular-nums">
                  {contagem[item]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-superficie rounded-3 flex flex-col p-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:rounded-none lg:bg-transparent lg:px-2 lg:pt-0 lg:pb-2">
        {fixadas.length > 0 ? (
          <ul
            aria-label="Prioridade máxima esperando alguém"
            className="flex flex-col gap-1"
          >
            {fixadas.map((linha) => (
              <LinhaLista
                key={linha.chave}
                linha={linha}
                href={hrefDaLinha(linha, filtro)}
                selecionada={linha.chave === chaveAberta}
                agora={agora}
                motivoFixada={
                  filtro !== "todas" && !linhaDoFiltro(linha, filtro)
                    ? "Prioridade máxima: fica no topo em qualquer filtro."
                    : undefined
                }
              />
            ))}
          </ul>
        ) : null}

        {linhas.length > 0 ? (
          <ul
            aria-label={ROTULO_FILTRO[filtro]}
            className={cn("flex flex-col gap-1", fixadas.length > 0 && "mt-1")}
          >
            {linhas.map((linha) => (
              <LinhaLista
                key={linha.chave}
                linha={linha}
                href={hrefDaLinha(linha, filtro)}
                selecionada={linha.chave === chaveAberta}
                agora={agora}
              />
            ))}
          </ul>
        ) : null}

        {vazio ? (
          <EstadoVazio
            nivelTitulo="h2"
            className={cn(
              "lg:flex-col lg:items-start lg:gap-4",
              fixadas.length > 0 && "mt-2",
            )}
            ilustracao={
              filtro === "freio" ? undefined : buscando ? (
                <FolhaLupa tamanho={96} />
              ) : (
                <SinoCalmo tamanho={96} />
              )
            }
            semTom={filtro === "freio"}
            titulo={
              buscando
                ? "Nenhuma conversa com esse nome ou telefone"
                : VAZIO[filtro].titulo
            }
            texto={
              buscando
                ? "Confira a grafia ou busque pelos últimos números do telefone."
                : VAZIO[filtro].texto
            }
          />
        ) : null}
      </div>
    </div>
  );
}
