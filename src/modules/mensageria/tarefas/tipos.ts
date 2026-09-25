import { Constants, type Json } from "@/lib/db/types";
import type { CategoriaAutomacao } from "@/lib/messaging";
import type {
  Prioridade,
  StatusTarefa,
  Tarefa,
  TipoTarefa,
} from "@/lib/dados/tipos";

/**
 * Contrato do `payload` da tarefa (PRD 6.4: "texto sugerido, link wa.me,
 * contexto"). Quem cria a tarefa (a régua e as demais automações, P20,
 * ainda não construído) grava esses campos; esta tela só lê e deixa
 * editar o texto antes de abrir o WhatsApp. Nenhum campo aqui é
 * obrigatório: uma tarefa sem `textoSugerido` (por exemplo "Justificar o
 * freio", tipo "outro") é tratada como tarefa interna, sem WhatsApp.
 */
export interface PayloadTarefaMensagem {
  textoSugerido?: string;
  telefoneE164?: string;
  /** Chave de `mensagem_modelo` que originou o texto (auditoria). */
  mensagemChave?: string;
  /**
   * Categoria da automação que criou a tarefa (PRD 8.2). Decide o que o
   * freio deixa passar: `operacional` segue em `atencao`, `conteudo` e
   * `marketing` não. Sem categoria válida, vale `conteudo`, a mais restrita
   * das que falam com a família no dia a dia.
   */
  categoria?: CategoriaAutomacao;
  contexto?: string;
}

const CATEGORIAS: readonly string[] =
  Constants.public.Enums.categoria_automacao;

function lerCategoria(valor: unknown): CategoriaAutomacao | undefined {
  return typeof valor === "string" && CATEGORIAS.includes(valor)
    ? (valor as CategoriaAutomacao)
    : undefined;
}

/** Categoria usada no freio para esta tarefa (padrão conservador: conteudo). */
export function categoriaDaTarefa(
  mensagem: PayloadTarefaMensagem,
): CategoriaAutomacao {
  return mensagem.categoria ?? "conteudo";
}

/**
 * A tarefa é "Justificar o freio" (`privado.acionar_freio`, PRD 8.3)? Sem
 * texto sugerido (é interna, tipo "outro"): a tela não pode tratá-la como
 * as demais tarefas internas, com um "Concluir" liso, porque concluir sem
 * escrever o motivo não é aceitável (crítica do CRM, P1 item 11).
 */
export function ehJustificarFreio(payload: Json): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  return (payload as Record<string, unknown>).acao === "justificar_freio";
}

export function lerPayloadTarefa(payload: Json): PayloadTarefaMensagem {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const registro = payload as Record<string, unknown>;
  const texto = registro.textoSugerido ?? registro.texto_sugerido;
  const telefone = registro.telefoneE164 ?? registro.telefone_e164;
  const chave = registro.mensagemChave ?? registro.mensagem_chave;
  const contexto = registro.contexto;
  const lido: PayloadTarefaMensagem = {
    textoSugerido:
      typeof texto === "string" && texto.trim() ? texto : undefined,
    telefoneE164:
      typeof telefone === "string" && telefone.trim() ? telefone : undefined,
    mensagemChave:
      typeof chave === "string" && chave.trim() ? chave : undefined,
    contexto:
      typeof contexto === "string" && contexto.trim() ? contexto : undefined,
  };
  const categoria = lerCategoria(registro.categoria);
  if (categoria) lido.categoria = categoria;
  return lido;
}

/** Tarefa com o payload já decodificado, pronta para a tela. */
export interface TarefaTela extends Tarefa {
  mensagem: PayloadTarefaMensagem;
  /** true quando dá para montar o link do WhatsApp (tem texto e telefone). */
  temAcaoWhatsApp: boolean;
}

export function paraTarefaTela(tarefa: Tarefa): TarefaTela {
  const mensagem = lerPayloadTarefa(tarefa.payload);
  return {
    ...tarefa,
    mensagem,
    temAcaoWhatsApp: Boolean(mensagem.textoSugerido && mensagem.telefoneE164),
  };
}

export type BaldeVencimento =
  "vencida" | "vence_hoje" | "a_vencer" | "sem_prazo";

export interface GrupoTarefas {
  balde: BaldeVencimento;
  titulo: string;
  tarefas: TarefaTela[];
}

export const ORDEM_PRIORIDADE: Record<Prioridade, number> = {
  normal: 0,
  alta: 1,
  maxima: 2,
};

export const ROTULO_TIPO_TAREFA: Record<TipoTarefa, string> = {
  nutricao_contato: "Contato da régua de nutrição",
  followup_comercial: "Follow-up comercial",
  agendar_sessao: "Agendar sessão com a Edilaine",
  enviar_formulario_contrato: "Formulário do contrato",
  checkin_dpp: "Check-in da data prevista",
  agendar_prenatal: "Agendar o pré-natal online",
  designar_profissional: "Designar profissional",
  obter_contato_medico: "Obter contato do médico",
  emitir_evolucao: "Emitir evolução",
  escuta_neutro: "Escuta neutra",
  enviar_pesquisa: "Enviar pesquisa de satisfação",
  enviar_guia: "Enviar guia",
  cobranca_atraso: "Cobrança em atraso",
  documento_vencendo: "Documento vencendo",
  outro: "Outra tarefa",
};

export function apenasAbertas(tarefas: Tarefa[]): Tarefa[] {
  const abertos: StatusTarefa[] = ["aberta", "em_andamento"];
  return tarefas.filter((t) => abertos.includes(t.status));
}
