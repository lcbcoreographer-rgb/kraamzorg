"use server";

import { obterRepositorioFormulario } from "@/lib/dados/formulario";
import { verificarTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { hojeBrasilia } from "../pipeline/idade-gestacional";
import type { PedidoEnvioFormulario, ResultadoEnvioTela } from "./estado-acoes";
import { origemAtual } from "./origem";
import {
  errosDoServidor,
  etapaDoCampo,
  montarDados,
  validarTudo,
} from "./validacao";

const LIMITE_CAMPOS = 60;
const LIMITE_TAMANHO = 300;

/** Só texto curto, só as chaves que o formulário conhece. */
function valoresLimpos(valores: unknown): Record<string, string> | null {
  if (!valores || typeof valores !== "object" || Array.isArray(valores)) {
    return null;
  }
  const entradas = Object.entries(valores as Record<string, unknown>);
  if (entradas.length > LIMITE_CAMPOS) return null;
  const limpos: Record<string, string> = {};
  for (const [chave, valor] of entradas) {
    if (!/^[a-zA-Z.]{1,40}$/.test(chave)) continue;
    if (typeof valor !== "string" || valor.length > LIMITE_TAMANHO) {
      return null;
    }
    limpos[chave] = valor;
  }
  return limpos;
}

/**
 * Envio do formulário seguro do contrato (P30 item 2). Sem sessão: quem
 * protege é o token de uso único (conferido no banco), o Turnstile e o
 * limite de tentativas por origem. Ordem: Turnstile, releitura do link no
 * banco (quem decide se pede pagador e qual a versão do termo é o
 * contrato, nunca o navegador), validação, gravação.
 *
 * Nada do que a pessoa digitou vai para log, erro, URL ou resposta: em
 * qualquer falha inesperada, só o código "erro" volta para a tela, e o
 * console do servidor não recebe o objeto (aceite do P30: CPF nunca em
 * log, URL ou Sentry).
 */
export async function enviarFormularioContrato(
  pedido: PedidoEnvioFormulario,
): Promise<ResultadoEnvioTela> {
  const token = typeof pedido?.token === "string" ? pedido.token : "";
  const valores = valoresLimpos(pedido?.valores);
  if (!token || !valores) return { situacao: "invalido" };

  try {
    const origem = await origemAtual();
    const verificacao = await verificarTurnstile(
      typeof pedido.verificacao === "string" ? pedido.verificacao : null,
      origem,
    );
    if (!verificacao.ok) {
      return { situacao: "verificacao", motivo: verificacao.motivo };
    }

    const repositorio = await obterRepositorioFormulario();
    const abertura = await repositorio.abrir(token, origem);
    if (abertura.situacao === "limite") {
      return { situacao: "limite", minutos: abertura.minutos };
    }
    if (abertura.situacao !== "valido" || !abertura.termoVersao) {
      return { situacao: "invalido" };
    }

    const contexto = {
      pedePagador: abertura.pedePagador,
      hoje: hojeBrasilia(),
    };
    const { erros, primeiraEtapa } = validarTudo(valores, contexto);
    if (primeiraEtapa) {
      return { situacao: "corrigir", erros, etapa: primeiraEtapa };
    }

    const resultado = await repositorio.enviar(
      token,
      montarDados(valores, { ...contexto, termoVersao: abertura.termoVersao }),
      origem,
    );
    switch (resultado.situacao) {
      case "recebido":
        return { situacao: "recebido" };
      case "limite":
        return { situacao: "limite", minutos: resultado.minutos };
      case "corrigir": {
        const tela = errosDoServidor(resultado.erros);
        const primeiro = Object.keys(tela)[0];
        return {
          situacao: "corrigir",
          erros: tela,
          etapa: primeiro ? etapaDoCampo(primeiro) : "voce",
        };
      }
      default:
        return { situacao: "invalido" };
    }
  } catch {
    // Sem registrar o erro: ele pode carregar o corpo da chamada ao banco.
    return { situacao: "erro" };
  }
}
