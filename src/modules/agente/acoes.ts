"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  marcarNaoLead,
  pausarConversa,
  reenviarNotificacaoHandoff,
  resolverTransferencia,
  retomarAgenteComercial,
  retomarPausaManual,
} from "./repositorio";
import { CLASSIFICACOES_NAO_LEAD } from "./loja-extra";

/**
 * Ações do agente no CRM (P27 item 1 e 2, protótipos `comercial-conversas`,
 * `comercial-conversa` e `comercial-inicio`): assumir e resolver
 * transferência, pausar e retomar a Isadora, marcar como não lead. Uma
 * sessão só (`"use server"`) para as três telas (`conversas`,
 * `transferencias` e a rota `[id]`), porque a mesma ação nasce em mais de
 * um lugar (por exemplo "Assumir conversa" está na fila e na lista).
 */

export interface EstadoAcaoAgente {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialAgente: EstadoAcaoAgente = {};

function mensagemErro(erro: unknown, contexto: string): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: confirme o papel e, se precisar, o código do aplicativo (MFA), e tente de novo.";
    }
    if (erro.codigo === "nao_encontrado") {
      return "Essa conversa não está mais disponível. Atualize a tela.";
    }
    if (erro.codigo === "recusado") {
      return `Não deu para ${contexto}. Atualize a tela e confira o estado atual.`;
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função (ela está sendo escrita por outra trilha agora). Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${contexto} agora. Tente de novo em instantes.`;
}

function revalidarTelas(conversaId?: string) {
  revalidatePath("/conversas");
  revalidatePath("/transferencias");
  revalidatePath("/inicio");
  if (conversaId) revalidatePath(`/conversas/${conversaId}`);
}

const campoTransferenciaId = z.string().min(1, "Falta saber qual transferência é essa.");
const campoConversaId = z.string().min(1, "Falta saber qual conversa é essa.");

/** "Assumir conversa" na fila de transferências (P22, já com handoff aberto). */
export async function acaoAssumirTransferencia(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/transferencias");
  const id = campoTransferenciaId.safeParse(formulario.get("transferenciaId"));
  if (!id.success) return { erro: id.error.issues[0]?.message };

  try {
    const { agente } = await obterRepositorios();
    await agente.assumirTransferencia(id.data);
  } catch (erro) {
    return { erro: mensagemErro(erro, "assumir a conversa") };
  }

  revalidarTelas(String(formulario.get("conversaId") ?? ""));
  return { sucesso: "Você assumiu a conversa. A Isadora não volta a responder aqui." };
}

const esquemaPausar = z.object({
  conversaId: campoConversaId,
  origem: z.enum(["assumir", "pausar"]),
});

/**
 * "Assumir conversa" (sem handoff aberto) e "Pausar a Isadora" (C5):
 * mesma escrita no banco, texto e prazo diferentes conforme a origem.
 */
export async function acaoPausarConversa(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/conversas");
  const dados = esquemaPausar.safeParse({
    conversaId: formulario.get("conversaId"),
    origem: formulario.get("origem"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  try {
    await pausarConversa(dados.data.conversaId, dados.data.origem);
  } catch (erro) {
    return {
      erro: mensagemErro(
        erro,
        dados.data.origem === "assumir" ? "assumir a conversa" : "pausar a Isadora",
      ),
    };
  }

  revalidarTelas(dados.data.conversaId);
  return {
    sucesso:
      dados.data.origem === "assumir"
        ? "Você assumiu a conversa."
        : "Isadora pausada nesta conversa.",
  };
}

/** "Devolver agora" de uma pausa manual (lead ainda não qualificado). */
export async function acaoRetomarPausaManual(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/conversas");
  const id = campoConversaId.safeParse(formulario.get("conversaId"));
  if (!id.success) return { erro: id.error.issues[0]?.message };

  try {
    await retomarPausaManual(id.data);
  } catch (erro) {
    return { erro: mensagemErro(erro, "devolver a conversa para a Isadora") };
  }

  revalidarTelas(id.data);
  return { sucesso: "Você devolveu a conversa para a Isadora." };
}

/**
 * "Devolver à Isadora" (PRD 11.7, D-17): só sai de `humano_comercial` por
 * aqui, nunca por "Marcar como resolvida". Confirmação fica na tela
 * (folha), o texto já avisa que a Isadora só responde a partir da próxima
 * mensagem da família.
 */
export async function acaoRetomarAgenteComercial(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/conversas");
  const id = campoConversaId.safeParse(formulario.get("conversaId"));
  if (!id.success) return { erro: id.error.issues[0]?.message };

  try {
    await retomarAgenteComercial(id.data);
  } catch (erro) {
    return { erro: mensagemErro(erro, "devolver a conversa para a Isadora") };
  }

  revalidarTelas(id.data);
  return {
    sucesso: "A Isadora volta a responder a partir da próxima mensagem da família.",
  };
}

const esquemaNaoLead = z.object({
  conversaId: campoConversaId,
  classificacao: z.enum(CLASSIFICACOES_NAO_LEAD as unknown as [string, ...string[]]),
});

/** "Marcar como não lead" (P27 item 1). */
export async function acaoMarcarNaoLead(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/conversas");
  const dados = esquemaNaoLead.safeParse({
    conversaId: formulario.get("conversaId"),
    classificacao: formulario.get("classificacao"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Escolha uma opção." };
  }

  try {
    await marcarNaoLead(
      dados.data.conversaId,
      dados.data.classificacao as (typeof CLASSIFICACOES_NAO_LEAD)[number],
    );
  } catch (erro) {
    return { erro: mensagemErro(erro, "marcar como não lead") };
  }

  revalidarTelas(dados.data.conversaId);
  return { sucesso: "Conversa marcada como não lead." };
}

const esquemaResolver = z.object({
  transferenciaId: campoTransferenciaId,
  desfecho: z.enum([
    "formulario_enviado",
    "sessao_marcada",
    "condicao_negociada",
    "sem_retorno",
  ]),
});

/**
 * "Marcar como resolvida" (fluxos.md, fluxo E): encerra a transferência
 * com o desfecho. Nunca devolve a conversa à Isadora, mesmo numa conversa
 * em `humano_comercial` (PRD 11.4 [v4.2]): quem faz isso é só
 * `acaoRetomarAgenteComercial`, separado.
 */
export async function acaoResolverTransferencia(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/conversas");
  const dados = esquemaResolver.safeParse({
    transferenciaId: formulario.get("transferenciaId"),
    desfecho: formulario.get("desfecho"),
  });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ??
        "Escolha como terminou. Isso entra no relatório de transferências.",
    };
  }

  try {
    await resolverTransferencia(dados.data.transferenciaId, dados.data.desfecho);
  } catch (erro) {
    return { erro: mensagemErro(erro, "marcar como resolvida") };
  }

  revalidarTelas(String(formulario.get("conversaId") ?? ""));
  return { sucesso: "Transferência marcada como resolvida." };
}

/** "Reenviar aviso" quando a faixa vermelha aparece (aviso ao grupo falhou). */
export async function acaoReenviarNotificacao(
  _anterior: EstadoAcaoAgente,
  formulario: FormData,
): Promise<EstadoAcaoAgente> {
  await exigirSessao("/transferencias");
  const id = campoTransferenciaId.safeParse(formulario.get("transferenciaId"));
  if (!id.success) return { erro: id.error.issues[0]?.message };

  try {
    await reenviarNotificacaoHandoff(id.data);
  } catch (erro) {
    return { erro: mensagemErro(erro, "reenviar o aviso") };
  }

  revalidarTelas();
  return { sucesso: "Aviso ao grupo reenviado." };
}
