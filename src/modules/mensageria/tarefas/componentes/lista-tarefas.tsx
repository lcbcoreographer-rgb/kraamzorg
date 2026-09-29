"use client";

import { useCallback, useState } from "react";
import { CircleCheck } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { GrupoTarefasComFreio } from "../dados";
import { CartaoTarefa, type TarefaFeita } from "./cartao-tarefa";

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
        <h2
          id={idTitulo}
          className="font-titulo text-2 text-texto -mb-5 flex items-baseline gap-2"
        >
          {titulo}
          {umGrupoSo ? (
            <span className="text-texto-2 font-mono text-[length:inherit] tabular-nums">
              · {visiveis[0]!.tarefas.length}
            </span>
          ) : null}
        </h2>
      ) : null}
      {visiveis.length === 0 ? (
        <EstadoVazio
          nivelTitulo={titulo ? "h3" : "h2"}
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
              <div className="mb-3 flex items-baseline gap-3">
                <TituloGrupo
                  id={`grupo-${grupo.balde}`}
                  className="font-titulo text-2 text-texto"
                >
                  {grupo.titulo}
                </TituloGrupo>
                <span className="text-apoio text-texto-2">
                  {grupo.tarefas.length === 1
                    ? "1 tarefa"
                    : `${grupo.tarefas.length} tarefas`}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {grupo.tarefas.map((tarefa) => (
                <CartaoTarefa
                  key={tarefa.id}
                  tarefa={tarefa}
                  aoFeita={aoFeita}
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
