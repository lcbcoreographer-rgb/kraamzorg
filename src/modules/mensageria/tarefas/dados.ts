import "server-only";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { agruparTarefas } from "./agrupar";
import { criarVerificadorFreio } from "./verificador-freio";
import type { GrupoTarefas, TarefaTela } from "./tipos";

export interface TarefaComFreio extends TarefaTela {
  /** false quando o freio bloqueia a família (não mostra "Abrir no WhatsApp"). */
  podeEnviarMensagem: boolean;
  motivoBloqueio: string | null;
}

export interface GrupoTarefasComFreio extends Omit<GrupoTarefas, "tarefas"> {
  tarefas: TarefaComFreio[];
}

export interface TarefasTela {
  grupos: GrupoTarefasComFreio[];
  total: number;
  usuarioId: string | null;
}

/**
 * Tarefas da pessoa logada (P18 item 2): as suas (responsável direto) e as
 * do papel sem responsável definido ainda, abertas ou em andamento,
 * agrupadas por vencimento e checadas contra o freio (PRD 8.3: "família em
 * bloqueio_total não gera link"). A diretoria e a fundação decidem em
 * `TarefasRepositorio.listarTarefas` quem vê o quê (RLS/demonstração); esta
 * função só formata o que chega para a tela.
 */
export async function listarTarefasTela(agora: Date = new Date()): Promise<TarefasTela> {
  const [{ tarefas }, sessao] = await Promise.all([obterRepositorios(), obterSessao()]);
  const lista = await tarefas.listarTarefas({ status: ["aberta", "em_andamento"] });
  const grupos = agruparTarefas(lista, agora);
  const verificar = criarVerificadorFreio();

  const gruposComFreio: GrupoTarefasComFreio[] = await Promise.all(
    grupos.map(async (grupo) => ({
      balde: grupo.balde,
      titulo: grupo.titulo,
      tarefas: await Promise.all(
        grupo.tarefas.map(async (tarefa): Promise<TarefaComFreio> => {
          if (!tarefa.temAcaoWhatsApp) {
            return { ...tarefa, podeEnviarMensagem: false, motivoBloqueio: null };
          }
          const verificacao = await verificar({
            familiaId: tarefa.familiaId ?? undefined,
            categoria: "conteudo",
          });
          return {
            ...tarefa,
            podeEnviarMensagem: verificacao.pode,
            motivoBloqueio: verificacao.pode ? null : verificacao.motivo,
          };
        }),
      ),
    })),
  );

  return {
    grupos: gruposComFreio,
    total: lista.length,
    usuarioId: sessao?.usuarioId ?? null,
  };
}
