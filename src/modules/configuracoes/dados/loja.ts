import { garantirDemonstracaoPermitida } from "@/lib/dados/modo";
import {
  CONDICOES_COMERCIAIS_SEED,
  CIDADES_SEED,
  PACOTES_SEED,
  REGIOES_SEED,
  REGUA_FAIXAS_SEED,
  TERMOS_ALERTA_SEED,
  VERSOES_PACOTE_SEED,
} from "./fixtures";
import type {
  Cidade,
  CondicaoComercial,
  HistoricoParametroItem,
  Pacote,
  RegiaoDetalhe,
  ReguaFaixaDetalhe,
  TermoAlerta,
  VersaoPacote,
} from "./tipos";

/**
 * Banco em memória do módulo de Configurações para o modo demonstração.
 * Mesmo padrão de `src/lib/dados/demonstracao/loja.ts` (nasce das fixtures,
 * vive em `globalThis`, tem uma chave própria para não colidir com a loja
 * da fundação).
 *
 * Parâmetro e mensagem_modelo continuam na loja da fundação
 * (`@/lib/dados/demonstracao/loja`, `obterLoja()`): este módulo lê e grava
 * ali para as outras telas (que já usam a `ConfiguracoesRepositorio` da
 * fundação) continuarem vendo o mesmo dado. Pacote, versão, região,
 * cidade, condição comercial, termo de alerta e faixa da régua não têm
 * lugar mutável na loja da fundação ainda (ela só expõe listas estáticas
 * para esses domínios); por isso moram aqui, e o retorno da sessão
 * descreve isso como pendência para quando outro módulo precisar
 * enxergar essas mudanças fora da tela de Configurações.
 */
export interface LojaConfiguracoes {
  criadaEm: number;
  pacotes: Pacote[];
  versoes: VersaoPacote[];
  regioes: RegiaoDetalhe[];
  cidades: Cidade[];
  condicoesComerciais: CondicaoComercial[];
  termosAlerta: TermoAlerta[];
  reguaFaixas: ReguaFaixaDetalhe[];
  /** Histórico dos parâmetros editados por este módulo (chave -> linhas, mais recente primeiro). */
  historicoParametros: Record<string, HistoricoParametroItem[]>;
  proximoHistorico: number;
  /**
   * Quem aprovou cada mensagem (chave -> usuarioId). A `MensagemModelo` da
   * fundação (`@/lib/dados/tipos`) não tem `aprovadoPor`; o módulo guarda
   * aqui para compor `MensagemModeloDetalhe` sem tocar no tipo da
   * fundação.
   */
  aprovacoesMensagens: Record<string, string>;
}

const CHAVE_GLOBAL = "__kraamzorgLojaConfiguracoes";

function clonar<T>(valor: T): T {
  return structuredClone(valor);
}

export function criarLoja(agora = Date.now()): LojaConfiguracoes {
  return {
    criadaEm: agora,
    pacotes: clonar(PACOTES_SEED),
    versoes: clonar(VERSOES_PACOTE_SEED),
    regioes: clonar(REGIOES_SEED),
    cidades: clonar(CIDADES_SEED),
    condicoesComerciais: clonar(CONDICOES_COMERCIAIS_SEED),
    termosAlerta: clonar(TERMOS_ALERTA_SEED),
    reguaFaixas: clonar(REGUA_FAIXAS_SEED),
    historicoParametros: {},
    proximoHistorico: 1,
    aprovacoesMensagens: {},
  };
}

/** A loja do processo. Lança erro fora de desenvolvimento (modo.ts, como a da fundação). */
export function obterLojaConfiguracoes(): LojaConfiguracoes {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<
    string,
    LojaConfiguracoes | undefined
  >;
  global[CHAVE_GLOBAL] ??= criarLoja();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta a loja ao estado das fixtures. */
export function reiniciarLojaConfiguracoes(agora?: number): LojaConfiguracoes {
  const global = globalThis as unknown as Record<
    string,
    LojaConfiguracoes | undefined
  >;
  global[CHAVE_GLOBAL] = criarLoja(agora);
  return global[CHAVE_GLOBAL];
}
