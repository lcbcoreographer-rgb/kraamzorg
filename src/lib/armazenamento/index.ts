import "server-only";
import { modoDados } from "@/lib/dados/modo";
import { criarArmazenamentoMemoria } from "./memoria";
import { criarArmazenamentoSupabase } from "./supabase";
import type { ArmazenamentoPrivado } from "./tipos";

export type { ArmazenamentoPrivado } from "./tipos";
export {
  caminhoComprovante,
  caminhoContrato,
  caminhoEvolucao,
  caminhoNota,
  caminhoValido,
  codigoAleatorio,
  ehComprovante,
  ehFotoProfissional,
  tipoDoArquivo,
  tipoDoArquivoNota,
} from "./caminhos";

/** Armazenamento do ambiente: Supabase Storage, ou memória na demonstração. */
export function obterArmazenamento(): ArmazenamentoPrivado {
  return modoDados() === "demonstracao"
    ? criarArmazenamentoMemoria()
    : criarArmazenamentoSupabase();
}

/** Segundos de vida da URL assinada de um documento (curta, CLAUDE.md). */
export const SEGUNDOS_URL_ASSINADA = 60;
