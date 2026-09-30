"use server";

import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import { verificarTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { montarLinkWhatsApp } from "@/lib/messaging/link-whatsapp";
import { origemAtual } from "@/modules/crm/formulario/origem";
import {
  utmDaBusca,
  type PedidoCaptacao,
  type ResultadoCaptacao,
} from "./tipos";

/**
 * Botão da página de captação (P47 item 2). Sem sessão: confere o Turnstile,
 * pede ao banco a visita (com o limite de taxa por origem) e devolve o link
 * wa.me com o código de origem no texto. Não pede nem grava dado da pessoa;
 * os UTM viajam limpos e a origem só fica em HMAC no banco.
 */
export async function acaoIniciarCaptacao(
  pedido: PedidoCaptacao,
): Promise<ResultadoCaptacao> {
  const canal =
    typeof pedido?.canal === "string" ? pedido.canal.slice(0, 40) : "";
  if (!canal) return { situacao: "indisponivel" };
  try {
    const origem = await origemAtual();
    const verificacao = await verificarTurnstile(
      typeof pedido.verificacao === "string" ? pedido.verificacao : null,
      origem,
    );
    if (!verificacao.ok) return { situacao: "verificacao" };

    const repositorio = await obterRelacaoPublica();
    const inicio = await repositorio.iniciarCaptacao(
      canal,
      utmDaBusca(pedido.utm ?? {}),
      origem,
    );
    if (inicio.situacao !== "ok") return { situacao: inicio.situacao };
    const url =
      inicio.numeroE164 && inicio.texto
        ? montarLinkWhatsApp(inicio.numeroE164, inicio.texto)
        : null;
    return url ? { situacao: "ok", url } : { situacao: "indisponivel" };
  } catch {
    // Nada do que a pessoa fez vai para log, erro ou resposta.
    return { situacao: "erro" };
  }
}
