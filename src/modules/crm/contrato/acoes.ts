"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { EstadoAcaoContrato } from "./estado-acoes";
import { fraseErroContrato } from "./mensagens";
import { enviarContratoParaAssinatura, gerarContrato } from "./servico";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

const esquemaIds = z.object({
  familiaId: z.uuid(),
  contratoId: z.uuid(),
});

function revalidarContrato(familiaId: string) {
  revalidatePath(`/familias/${familiaId}/contrato`);
  revalidatePath(`/familias/${familiaId}/proposta`);
  revalidatePath(`/familias/${familiaId}`);
  revalidatePath("/pipeline");
  revalidatePath("/tarefas");
  revalidatePath("/cobrancas");
}

/**
 * Gera o PDF do contrato a partir dos dados do formulário seguro (P31 item
 * 2). Pode gerar de novo até o envio. A leitura do CPF fica no log de
 * auditoria (api.dados_para_contrato).
 */
export async function acaoGerarContrato(
  familiaId: string,
  contratoId: string,
): Promise<EstadoAcaoContrato> {
  await exigirSessao("/familias");
  const ids = esquemaIds.safeParse({ familiaId, contratoId });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    await gerarContrato(ids.data.contratoId);
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "gerar o contrato") };
  }
  revalidarContrato(ids.data.familiaId);
  return {
    sucesso:
      "Contrato gerado. Abra o PDF, confira os dados e, se estiver tudo certo, envie para assinatura.",
  };
}

/** Envia o contrato gerado à Autentique (gestante e Kraamzorg assinam, parceiro testemunha). */
export async function acaoEnviarContrato(
  familiaId: string,
  contratoId: string,
): Promise<EstadoAcaoContrato> {
  await exigirSessao("/familias");
  const ids = esquemaIds.safeParse({ familiaId, contratoId });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    await enviarContratoParaAssinatura(ids.data.contratoId);
  } catch (erro) {
    revalidarContrato(ids.data.familiaId);
    return { erro: fraseErroContrato(erro, "enviar o contrato") };
  }
  revalidarContrato(ids.data.familiaId);
  return {
    sucesso:
      "Contrato enviado. A Autentique avisa a gestante, a Kraamzorg e a testemunha por e-mail. Quando todos assinarem, a cobrança sai sozinha.",
  };
}

/** Desfaz a reserva do envio, depois de conferir no painel da Autentique que nenhum documento foi criado. */
export async function acaoLiberarEnvio(
  familiaId: string,
  contratoId: string,
): Promise<EstadoAcaoContrato> {
  await exigirSessao("/familias");
  const ids = esquemaIds.safeParse({ familiaId, contratoId });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { contratos } = await obterRepositorios();
    await contratos.liberarEnvio(ids.data.contratoId);
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "liberar o envio") };
  }
  revalidarContrato(ids.data.familiaId);
  return { sucesso: "Envio liberado. Você já pode enviar o contrato de novo." };
}

/**
 * Só na demonstração: faz o que o webhook da Autentique faria quando todos
 * assinam (contrato assinado, cobrança e link de pagamento). Fora da
 * demonstração a ação não faz nada.
 */
export async function acaoSimularAssinatura(
  familiaId: string,
  contratoId: string,
): Promise<EstadoAcaoContrato> {
  await exigirSessao("/familias");
  const ids = esquemaIds.safeParse({ familiaId, contratoId });
  if (!ids.success) return { erro: "Atualize a tela e tente de novo." };
  if (modoDados() !== "demonstracao") {
    return { erro: "Esta ação existe só na demonstração." };
  }
  try {
    const { contratos } = await obterRepositorios();
    // A leitura passa pelo papel e pelo AAL2 do usuário antes da simulação.
    await contratos.obterSituacao(ids.data.familiaId);
    const { simularAssinaturaDemonstracao } =
      await import("@/lib/dados/demonstracao/contrato");
    simularAssinaturaDemonstracao(ids.data.contratoId);
  } catch (erro) {
    return { erro: fraseErroContrato(erro, "simular a assinatura") };
  }
  revalidarContrato(ids.data.familiaId);
  return {
    sucesso: "Assinatura simulada. A cobrança e o link de pagamento já saíram.",
  };
}
