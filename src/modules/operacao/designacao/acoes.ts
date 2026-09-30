"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { EstadoAcaoOperacao } from "../comum/estado-acoes";
import { textoDoCampo } from "../comum/formulario";
import { fraseErroOperacao } from "../comum/mensagens";

// "use server": só funções assíncronas saem daqui.

const FRASE_DESFECHO = {
  backup_assumiu:
    "Recusa registrada. O backup assumiu a família e a coordenação foi avisada.",
  oferta_passou_ao_backup:
    "Recusa registrada. A oferta passou ao backup e a coordenação foi avisada.",
  sem_backup:
    "Recusa registrada. Não havia backup, então a coordenação foi avisada para designar outra pessoa.",
  backup_recusou:
    "Recusa registrada. A coordenação foi avisada para designar outra pessoa.",
} as const;

const esquema = z.object({
  designacaoId: z.uuid(),
  decisao: z.enum(["aceitar", "recusar"]),
  motivo: z.string(),
});

/**
 * A enfermeira aceita ou recusa a oferta (P36 item 1). Recusa exige motivo.
 * Recusa da titular aciona o backup e avisa a coordenação (no banco).
 */
export async function acaoResponderOferta(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/ofertas");
  const dados = esquema.safeParse({
    designacaoId: textoDoCampo(formulario, "designacaoId"),
    decisao: textoDoCampo(formulario, "decisao"),
    motivo: [
      textoDoCampo(formulario, "motivoEscolha"),
      textoDoCampo(formulario, "motivoTexto"),
    ]
      .filter(Boolean)
      .join(". "),
  });
  if (!dados.success)
    return { erro: "Não achei essa oferta. Atualize a tela." };
  const aceita = dados.data.decisao === "aceitar";
  if (!aceita && dados.data.motivo.trim() === "") {
    return {
      erro: "Escolha ou escreva o motivo da recusa. Ele ajuda a coordenação a decidir.",
      campos: { motivoTexto: "Conte em poucas palavras." },
    };
  }
  try {
    const { operacao } = await obterRepositorios();
    const r = await operacao.responder(
      dados.data.designacaoId,
      aceita,
      aceita ? null : dados.data.motivo,
    );
    // /ofertas não é revalidada de propósito: o cartão respondido fica na tela
    // com o resultado até a pessoa sair; a próxima abertura já vem atualizada.
    revalidatePath("/radar");
    revalidatePath("/hoje");
    if (r.expirada) {
      return {
        erro: "O prazo dessa oferta acabou e ela passou para a coordenação. Nada mais a fazer aqui.",
      };
    }
    return {
      sucesso: aceita
        ? "Oferta aceita. A família entra na sua lista."
        : r.desfecho
          ? FRASE_DESFECHO[r.desfecho]
          : "Recusa registrada. A coordenação foi avisada.",
    };
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "responder a oferta") };
  }
}
