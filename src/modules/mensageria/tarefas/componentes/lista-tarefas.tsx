"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CircleCheck,
  ClockAlert,
  ListTodo,
  Sun,
} from "lucide-react";
import { XicaraQuente } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TileIcone } from "@/components/ui/tile-icone";
import type { GrupoTarefasComFreio } from "../dados";
import type { Tom } from "@/components/ui/tons";
import { CartaoTarefa, type TarefaFeita } from "./cartao-tarefa";

const TILE_BALDE: Record<
  GrupoTarefasComFreio["balde"],
  { tom: Tom | "branco"; icone: ReactNode }
> = {
  vencida: { tom: "branco", icone: <ClockAlert /> },
  vence_hoje: { tom: "dourado", icone: <Sun /> },
  a_vencer: { tom: "lavanda", icone: <CalendarDays /> },
  sem_prazo: { tom: "areia", icone: <ListTodo /> },
};

/** O que cada grupo de prazo é, em frase (tela Tarefas). */
const APOIO_BALDE: Record<GrupoTarefasComFreio["balde"], string> = {
  vencida: "O prazo já passou. Comece por estas.",
  vence_hoje: "Vencem até o fim do dia.",
  a_vencer: "Vencem nos próximos dias.",
  sem_prazo: "Não têm data para vencer. Faça quando der.",
};

/**
 * Tarefas agrupadas por vencimento (protótipo `comercial-inicio.html`,
 * seção "Tarefas de hoje", com "Feitas" no fim). Guarda as tarefas
 * concluídas nesta visita para a confirmação não sumir junto com o cartão
 * quando a tela revalida; a região é `role="status"`, lida pelo leitor de
 * tela sem roubar o foco.
 */
export function ListaTarefas({
  grupos,
  titulo,
  idTitulo,
  icone,
  tomIcone = "areia",
  colunas = false,
  detalhada = false,
}: {
  grupos: GrupoTarefasComFreio[];
  /**
   * Título da seção que contém a lista (ex: "Tarefas de hoje", no Início).
   * Com um grupo só, vira um título único com a contagem ("Tarefas de
   * hoje · 4"), sem repetir "Vencem hoje" logo abaixo (voz.md, seção 5);
   * com mais de um, os grupos descem para h3.
   */
  titulo?: string;
  idTitulo?: string;
  /** Ícone do assunto no tile ao lado do título (direção "Colo", DESIGN.md 2.7). */
  icone?: ReactNode;
  /** Tom do tile do título: o mesmo do cartão-resumo que aponta para a seção. */
  tomIcone?: Tom;
  /**
   * Tela própria das tarefas: no computador, os cartões de cada grupo em
   * duas colunas (no Início a lista mora numa coluna estreita).
   */
  colunas?: boolean;
  /**
   * Tela Tarefas (pedido do dono em 30/09): uma tarefa por linha, cada uma
   * dizendo por que existe e o que fazer, com a ação à direita no
   * computador; cada grupo de prazo com uma frase que diz o que ele é.
   */
  detalhada?: boolean;
}) {
  const [feitas, setFeitas] = useState<TarefaFeita[]>([]);
  const aoFeita = useCallback((feita: TarefaFeita) => {
    setFeitas((anteriores) =>
      anteriores.some((f) => f.id === feita.id)
        ? anteriores
        : [...anteriores, feita],
    );
  }, []);

  const idsFeitos = new Set(feitas.map((f) => f.id));
  const visiveis = grupos
    .map((grupo) => ({
      ...grupo,
      tarefas: grupo.tarefas.filter((t) => !idsFeitos.has(t.id)),
    }))
    .filter((grupo) => grupo.tarefas.length > 0);

  const umGrupoSo = Boolean(titulo) && visiveis.length === 1;
  const TituloGrupo = titulo ? "h3" : "h2";

  return (
    <div className="flex flex-col gap-8">
      {titulo ? (
        <div className="-mb-5 flex items-center gap-3">
          {icone ? (
            <TileIcone tom={tomIcone} forma="quadrado">
              {icone}
            </TileIcone>
          ) : null}
          <h2
            id={idTitulo}
            className="font-titulo text-2 text-texto flex items-center gap-2"
          >
            {titulo}
            {umGrupoSo ? (
              <span className="rounded-pilula bg-areia text-apoio text-texto inline-flex min-h-7 min-w-7 items-center justify-center px-2 font-mono tabular-nums">
                <span className="sr-only">, </span>
                {visiveis[0]!.tarefas.length}
              </span>
            ) : null}
          </h2>
        </div>
      ) : null}
      {visiveis.length === 0 ? (
        <EstadoVazio
          nivelTitulo={titulo ? "h3" : "h2"}
          ilustracao={<XicaraQuente tamanho={104} />}
          titulo={
            feitas.length > 0 ? "Tudo feito por agora" : "Nenhuma tarefa agora"
          }
          texto="Quando a régua, uma cadência ou o freio abrirem uma tarefa para você, ela aparece aqui, por prioridade e prazo."
        />
      ) : (
        visiveis.map((grupo) => (
          <section
            key={grupo.balde}
            aria-labelledby={umGrupoSo ? idTitulo : `grupo-${grupo.balde}`}
          >
            {umGrupoSo ? null : (
              // Cada grupo com o tile do tempo que ele é (DESIGN.md, 6.1):
              // hoje é o agora, a vencer é agenda, sem prazo é o que já foi
              // guardado; vencidas ficam num tile branco, sem tom, porque
              // atraso é estado e o estado mora no prazo de cada cartão.
              <div className="mb-3 flex items-center gap-3">
                <TileIcone
                  tom={TILE_BALDE[grupo.balde].tom}
                  forma="quadrado"
                  className={
                    grupo.balde === "vencida"
                      ? "border-linha border"
                      : undefined
                  }
                >
                  {TILE_BALDE[grupo.balde].icone}
                </TileIcone>
                <TituloGrupo
                  id={`grupo-${grupo.balde}`}
                  className="font-titulo text-2 text-texto"
                >
                  {grupo.titulo}
                </TituloGrupo>
                <span className="rounded-pilula bg-areia text-apoio text-texto inline-flex min-h-7 items-center px-2.5 font-medium">
                  {grupo.tarefas.length === 1
                    ? "1 tarefa"
                    : `${grupo.tarefas.length} tarefas`}
                </span>
              </div>
            )}
            {detalhada && !umGrupoSo ? (
              <p className="text-apoio text-texto-2 -mt-1 mb-3">
                {APOIO_BALDE[grupo.balde]}
              </p>
            ) : null}
            <div
              className={
                colunas && !detalhada
                  ? "grid grid-cols-1 items-start gap-3 lg:grid-cols-2"
                  : "flex flex-col gap-3"
              }
            >
              {grupo.tarefas.map((tarefa) => (
                <CartaoTarefa
                  key={tarefa.id}
                  tarefa={tarefa}
                  aoFeita={aoFeita}
                  explicada={detalhada}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <section
        role="status"
        aria-label="Feitas agora"
        className="flex flex-col gap-2"
      >
        {feitas.length > 0 ? (
          <>
            <h2 className="text-apoio text-texto font-semibold">
              Feitas agora
            </h2>
            <ul className="flex flex-col gap-2">
              {feitas.map((feita) => (
                <li key={feita.id} className="flex items-start gap-2">
                  <CircleCheck
                    aria-hidden="true"
                    className="text-sucesso mt-0.5 size-4 shrink-0"
                    strokeWidth={1.75}
                  />
                  <span className="text-apoio text-texto-2">
                    <span className="text-texto font-semibold">
                      {feita.titulo}
                    </span>
                    <br />
                    {feita.detalhe}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
