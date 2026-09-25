import "server-only";
import { ErroRepositorio } from "../erros";
import type { TarefasRepositorio } from "../repositorios";
import type { FiltroTarefas, Tarefa } from "../tipos";
import { exigir, type ContextoSupabase } from "./comum";

export function criarTarefasSupabase({ cliente, usuarioId }: ContextoSupabase): TarefasRepositorio {
  return {
    async listarTarefas(filtro: FiltroTarefas = {}) {
      let consulta = cliente
        .from("tarefa")
        .select(
          "id, tipo, titulo, prioridade, status, vence_em, familia_id, responsavel_id, papel_responsavel, payload, criado_em, familia:familia_id ( nome_exibicao )",
        )
        .order("prioridade", { ascending: false })
        .order("vence_em", { ascending: true, nullsFirst: false });
      if (filtro.status?.length) consulta = consulta.in("status", filtro.status);
      if (filtro.familiaId) consulta = consulta.eq("familia_id", filtro.familiaId);
      if (filtro.minhas && usuarioId) consulta = consulta.eq("responsavel_id", usuarioId);

      const linhas = exigir(await consulta, "tarefas");
      return linhas.map(
        (t): Tarefa => ({
          id: t.id,
          tipo: t.tipo,
          titulo: t.titulo,
          prioridade: t.prioridade,
          status: t.status,
          venceEm: t.vence_em,
          familiaId: t.familia_id,
          nomeFamilia: t.familia?.nome_exibicao ?? null,
          responsavelId: t.responsavel_id,
          papelResponsavel: t.papel_responsavel,
          payload: t.payload,
          criadoEm: t.criado_em,
        }),
      );
    },

    async concluirTarefa(tarefaId) {
      if (!usuarioId) throw new ErroRepositorio("sem_permissao", "concluir tarefa sem sessão");
      exigir(
        await cliente
          .from("tarefa")
          .update({
            status: "concluida",
            concluida_em: new Date().toISOString(),
            concluida_por: usuarioId,
          })
          .eq("id", tarefaId),
        "concluir tarefa",
      );
    },
  };
}
