import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { agruparTarefas, textoPrazo } from "./agrupar";
import { codigoSensivel, criarVerificadorFreio } from "./verificador-freio";
import {
  categoriaDaTarefa,
  paraTarefaTela,
  type GrupoTarefas,
  type TarefaTela,
} from "./tipos";

export interface TarefaComFreio extends TarefaTela {
  /** false quando o freio bloqueia a família (não mostra "Abrir no WhatsApp"). */
  podeEnviarMensagem: boolean;
  motivoBloqueio: string | null;
  /** true quando o bloqueio é do freio ou de `nao_contatar` (tom ameixa, PRD 8.3). */
  bloqueioSensivel: boolean;
  /**
   * "vence em 22 min", "até 24/09/2026, 17:00". Calculado no servidor, junto
   * com o agrupamento, para a tela não divergir da hidratação.
   */
  prazo: string | null;
}

export interface GrupoTarefasComFreio extends Omit<GrupoTarefas, "tarefas"> {
  tarefas: TarefaComFreio[];
}

export interface TarefasTela {
  grupos: GrupoTarefasComFreio[];
  total: number;
}

const STATUS_ABERTOS = ["aberta", "em_andamento"] as const;

/**
 * Tarefas da pessoa logada (P18 item 2): as suas (responsável direto) e as
 * do papel sem responsável definido ainda, abertas ou em andamento. Quem vê
 * o quê é decisão da RLS de `tarefa` (0007) e do repositório de
 * demonstração, que aplica a mesma regra; esta função agrupa por
 * vencimento e checa o freio de cada família antes de a tela mostrar o
 * link (PRD 8.3: "família em bloqueio_total não gera link").
 */
export async function listarTarefasTela(
  agora: Date = new Date(),
): Promise<TarefasTela> {
  const { tarefas } = await obterRepositorios();
  const lista = await tarefas.listarTarefas({ status: [...STATUS_ABERTOS] });
  const grupos = agruparTarefas(lista, agora);
  const verificar = criarVerificadorFreio();

  const gruposComFreio: GrupoTarefasComFreio[] = await Promise.all(
    grupos.map(async (grupo) => ({
      balde: grupo.balde,
      titulo: grupo.titulo,
      tarefas: await Promise.all(
        grupo.tarefas.map(async (tarefa): Promise<TarefaComFreio> => {
          const prazo = textoPrazo(tarefa.venceEm, agora);
          if (!tarefa.temAcaoWhatsApp) {
            return {
              ...tarefa,
              prazo,
              podeEnviarMensagem: false,
              motivoBloqueio: null,
              bloqueioSensivel: false,
            };
          }
          const verificacao = await verificar({
            familiaId: tarefa.familiaId ?? undefined,
            categoria: categoriaDaTarefa(tarefa.mensagem),
            canal: "manual",
          });
          return {
            ...tarefa,
            prazo,
            podeEnviarMensagem: verificacao.pode,
            motivoBloqueio: verificacao.pode ? null : verificacao.motivo,
            bloqueioSensivel:
              !verificacao.pode && codigoSensivel(verificacao.codigo),
          };
        }),
      ),
    })),
  );

  return { grupos: gruposComFreio, total: lista.length };
}

/**
 * A tarefa aberta, lida de novo no servidor com a sessão de quem pediu
 * (RLS). O "Enviei" usa isto para tirar família, telefone e categoria do
 * banco, nunca de campo escondido do formulário, que qualquer pessoa pode
 * trocar no navegador para escapar do freio de outra família.
 */
export async function obterTarefaAberta(
  tarefaId: string,
): Promise<TarefaTela | null> {
  const { tarefas } = await obterRepositorios();
  const lista = await tarefas.listarTarefas({ status: [...STATUS_ABERTOS] });
  const tarefa = lista.find((t) => t.id === tarefaId);
  return tarefa ? paraTarefaTela(tarefa) : null;
}
