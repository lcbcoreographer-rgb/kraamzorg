import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { GrupoTarefasComFreio } from "../dados";
import { CartaoTarefa } from "./cartao-tarefa";

/**
 * Tarefas agrupadas por vencimento (protótipo `comercial-inicio.html`,
 * seção "Tarefas de hoje"). Server Component: só monta a lista; quem
 * interage (editar texto, enviar, concluir) é `CartaoTarefa`.
 */
export function ListaTarefas({ grupos }: { grupos: GrupoTarefasComFreio[] }) {
  if (grupos.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        titulo="Nenhuma tarefa agora"
        texto="Quando a régua, uma cadência ou o freio abrirem uma tarefa para você, ela aparece aqui, por prioridade e prazo."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {grupos.map((grupo) => (
        <section key={grupo.balde} aria-labelledby={`grupo-${grupo.balde}`}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 id={`grupo-${grupo.balde}`} className="font-titulo text-2 text-texto">
              {grupo.titulo}
            </h2>
            <span className="text-apoio text-texto-2">
              {grupo.tarefas.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {grupo.tarefas.map((tarefa) => (
              <CartaoTarefa key={tarefa.id} tarefa={tarefa} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
