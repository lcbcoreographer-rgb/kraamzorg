"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoEnvioConversa } from "../estado-acoes";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { criarMensageiro } from "@/lib/messaging";
import { criarVerificadorFreio } from "@/modules/mensageria/tarefas/verificador-freio";
import { registrarEnvioConversa } from "./registrar-envio";

/**
 * "Enviar" pelo app (C2, decisão pendente do cliente em `fluxos.md`,
 * item 3: `comercial_resposta_no_app`). Sai pelo adaptador de mensageria
 * (`src/lib/messaging`, PRD 4.1 D-08), que confere o freio antes. Com o
 * canal `manual`, devolve o link para a pessoa enviar do aparelho e não
 * grava nada; com um canal de API, grava a mensagem enviada. Qual canal
 * atende o número da Kraamzorg é a decisão T-01 (PRD 4.1), ainda aberta.
 */
export async function acaoEnviarMensagemConversa(
  _anterior: EstadoEnvioConversa,
  formulario: FormData,
): Promise<EstadoEnvioConversa> {
  const sessao = await exigirSessao("/conversas");

  const dados = z
    .object({
      conversaId: z.string().min(1),
      familiaId: z.string().min(1).nullable(),
      telefoneE164: z
        .string()
        .min(1, "Esta conversa não tem telefone cadastrado."),
      texto: z.string().trim().min(1, "Escreva alguma coisa antes de enviar."),
    })
    .safeParse({
      conversaId: formulario.get("conversaId"),
      familiaId: formulario.get("familiaId") || null,
      telefoneE164: formulario.get("telefoneE164"),
      texto: formulario.get("texto"),
    });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ?? "Confira os dados e tente de novo.",
    };
  }

  // Toda mensagem do app para a família passa pelo adaptador e pelo freio
  // (CLAUDE.md). Sem família ligada não há freio para conferir, então o
  // app não envia: a resposta segue pelo WhatsApp do aparelho.
  if (!dados.data.familiaId) {
    return {
      erro: "Esta conversa ainda não está ligada a uma família. Responda pelo botão Abrir no WhatsApp.",
    };
  }

  try {
    const mensageiro = criarMensageiro("manual");
    const resultado = await mensageiro.enviar(
      {
        familiaId: dados.data.familiaId,
        categoria: "conteudo",
        destinatario: "familia",
        telefoneOuJid: dados.data.telefoneE164,
        texto: dados.data.texto,
      },
      criarVerificadorFreio(),
    );
    if (!resultado.ok) return { erro: resultado.motivo };
    if (resultado.modo === "link") {
      // Canal manual (PRD 4.1 D-08): o app só confere o freio e monta o
      // link; quem envia é a pessoa, no WhatsApp do aparelho, e a mensagem
      // volta para cá pelo número da Kraamzorg. Gravar aqui duplicaria o
      // registro e diria que a família recebeu algo que ainda não saiu.
      return {
        sucesso:
          "Pronto para enviar. Toque em Enviar no WhatsApp para a família receber.",
        link: resultado.link,
      };
    }
    await registrarEnvioConversa(dados.data.conversaId, dados.data.texto);
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      return {
        erro:
          erro.codigo === "indisponivel"
            ? "Não saiu. A família não recebeu. Tente de novo ou abra no WhatsApp."
            : "Não foi possível enviar agora. Tente de novo em instantes.",
      };
    }
    return {
      erro: "Não foi possível enviar agora. Tente de novo em instantes.",
    };
  }

  revalidatePath(`/conversas/${dados.data.conversaId}`);
  return { sucesso: `Enviado por ${sessao.nome.split(" ")[0]}.` };
}
