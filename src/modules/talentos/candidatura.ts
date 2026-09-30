"use server";

import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import { verificarTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { origemAtual } from "@/modules/crm/formulario/origem";

export type EstadoCandidatura =
  | { situacao: "inicial" }
  | { situacao: "recebido" }
  | { situacao: "desligada" }
  | { situacao: "verificacao" }
  | { situacao: "limite" }
  | { situacao: "erro" }
  | { situacao: "corrigir"; erros: Record<string, string> };

const texto = (dados: FormData, chave: string) => {
  const v = dados.get(chave);
  return typeof v === "string" ? v : "";
};

/**
 * Envio da página pública de candidatura (P51 item 3). Sem sessão: confere o
 * Turnstile, chama a função aberta do banco (que recusa se o parâmetro
 * talentos_pagina_publica estiver desligado, confere o consentimento e limita
 * por origem) e devolve só a situação. Nenhum dado da pessoa vai para log.
 */
export async function acaoEnviarCandidatura(
  _anterior: EstadoCandidatura,
  dados: FormData,
): Promise<EstadoCandidatura> {
  try {
    const origem = await origemAtual();
    const verificacao = await verificarTurnstile(
      texto(dados, "cf-turnstile-response") || null,
      origem,
    );
    if (!verificacao.ok) return { situacao: "verificacao" };
    const repositorio = await obterRelacaoPublica();
    const r = await repositorio.enviarCandidatura(
      {
        nome: texto(dados, "nome").slice(0, 200),
        telefone: texto(dados, "telefone").slice(0, 40),
        email: texto(dados, "email").slice(0, 250),
        cidade: texto(dados, "cidade").slice(0, 120),
        conselho: texto(dados, "conselho").slice(0, 100),
        apresentacao: texto(dados, "apresentacao").slice(0, 2000),
        consentimentoVersao:
          texto(dados, "consentimento") === "sim"
            ? texto(dados, "termoVersao").slice(0, 60)
            : "",
      },
      origem,
    );
    if (r.situacao === "corrigir")
      return { situacao: "corrigir", erros: r.erros };
    return { situacao: r.situacao };
  } catch {
    return { situacao: "erro" };
  }
}
