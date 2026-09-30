"use server";

import { obterRepositorioPesquisa } from "@/lib/dados/pesquisa";
import { verificarTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { origemAtual } from "@/modules/crm/formulario/origem";
import type {
  PedidoEnvioPesquisa,
  ResultadoEnvioPesquisaTela,
} from "./estado-acoes";
import { respostasLimpas } from "./validacao";

/**
 * Envio da pesquisa de satisfação da família (P42, PRD 7.4). Sem sessão:
 * quem protege é o token de uso único (conferido no banco, só o sha256 fica
 * lá), a validade, o limite de tentativas por origem e o Turnstile. Ordem:
 * Turnstile, envio. O banco recusa quando o freio segura a família e nunca
 * devolve dado dela.
 *
 * Nada do que a pessoa respondeu vai para log, erro, URL ou resposta: em
 * qualquer falha inesperada, só o código "erro" volta para a tela.
 */
export async function enviarPesquisaFamilia(
  pedido: PedidoEnvioPesquisa,
): Promise<ResultadoEnvioPesquisaTela> {
  const token = typeof pedido?.token === "string" ? pedido.token : "";
  const respostas = respostasLimpas(pedido?.respostas);
  if (!token || token.length > 200 || !respostas) {
    return { situacao: "invalido" };
  }

  try {
    const origem = await origemAtual();
    const verificacao = await verificarTurnstile(
      typeof pedido.verificacao === "string" ? pedido.verificacao : null,
      origem,
    );
    if (!verificacao.ok) {
      return { situacao: "verificacao", motivo: verificacao.motivo };
    }

    const repositorio = await obterRepositorioPesquisa();
    const resultado = await repositorio.enviar(token, respostas, origem);
    switch (resultado.situacao) {
      case "recebido":
        return { situacao: "recebido" };
      case "limite":
        return { situacao: "limite", minutos: resultado.minutos };
      case "corrigir":
        return { situacao: "corrigir", erros: resultado.erros };
      default:
        return { situacao: "invalido" };
    }
  } catch {
    // Sem registrar o erro: ele pode carregar o corpo da chamada ao banco.
    return { situacao: "erro" };
  }
}
