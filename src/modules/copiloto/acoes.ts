"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { hojeBrasilia } from "@/modules/crm/pipeline/idade-gestacional";
import type { EstadoCopiloto } from "./estado-acoes";
import { criarModeloDemonstracao } from "./modelo-demonstracao";
import { modeloCopilotoDoAmbiente } from "./modelo-openai";
import {
  MENSAGENS,
  perguntarAoCopiloto,
  type ModeloCopiloto,
} from "./orquestrador";

/**
 * Modelo que responde: o da OpenAI quando há chave e modelo no servidor; em
 * desenvolvimento com dados de demonstração e sem chave, o dublê por regras
 * (sem custo, sem rede); em qualquer outro caso, nenhum (copiloto desligado).
 */
function modeloDoAmbiente(): ModeloCopiloto | null {
  const real = modeloCopilotoDoAmbiente();
  if (real) return real;
  return modoDados() === "demonstracao" ? criarModeloDemonstracao() : null;
}

/** Pergunta ao copiloto (P48). A chave do modelo só existe aqui, no servidor. */
export async function acaoPerguntarAoCopiloto(
  _anterior: EstadoCopiloto,
  dados: FormData,
): Promise<EstadoCopiloto> {
  const usuario = await exigirSessao("/copiloto");
  const pergunta = String(dados.get("pergunta") ?? "").slice(0, 2000);
  try {
    const { relacao } = await obterRepositorios();
    const resposta = await perguntarAoCopiloto({
      pergunta,
      hoje: hojeBrasilia(),
      papeis: usuario.papeis,
      repositorio: relacao.copiloto,
      modelo: modeloDoAmbiente(),
    });
    revalidatePath("/copiloto");
    return { pergunta, resposta };
  } catch {
    return {
      pergunta,
      resposta: { situacao: "erro", mensagem: MENSAGENS.erro },
    };
  }
}
