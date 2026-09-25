/**
 * Tipos do motor offline (P12, invariante 4). Espelham `fila_sincronizacao`
 * (PRD 6.7) e as quatro tabelas com coluna `versao` (PRD 6.10 regra 13):
 * `consulta_prenatal`, `visita`, `anexo_audio`, `alerta_clinico`. O registro
 * assistencial (`registro_atendimento`) é a quinta entidade sincronizável,
 * mas nunca é sobrescrito: toda divergência vira `registro_adendo` (D-05).
 */

/** Nome de tabela sincronizável, sempre em português snake_case (PRD 5.2). */
export type Entidade =
  | "consulta_prenatal"
  | "visita"
  | "anexo_audio"
  | "alerta_clinico"
  | "registro_atendimento";

/** Entidades com coluna `versao` (conflito detectado por versão, regra 13). */
export const ENTIDADES_VERSIONADAS: readonly Entidade[] = [
  "consulta_prenatal",
  "visita",
  "anexo_audio",
  "alerta_clinico",
];

/** Entidade assistencial append-only: nunca update, divergência vira adendo (D-05). */
export const ENTIDADE_ASSISTENCIAL_APPEND_ONLY: Entidade =
  "registro_atendimento";

export function entidadeEVersionada(entidade: Entidade): boolean {
  return ENTIDADES_VERSIONADAS.includes(entidade);
}

/**
 * Estado de um item da fila no aparelho. Os três primeiros são os únicos
 * mostrados na interface (PRD 15, `IndicadorSincronizacao`); `conflito` e
 * `erro` existem para o motor decidir o que fazer a seguir (reenviar,
 * ou esperar decisão humana) e a tela os apresenta com o texto de cada caso.
 */
export type EstadoItemFila =
  "rascunho_local" | "enviando" | "sincronizado" | "conflito" | "erro";

/**
 * Item da fila de sincronização, guardado no IndexedDB do aparelho e
 * enviado a `POST /api/sync`. Espelha `fila_sincronizacao` (PRD 6.7): `id`
 * nasce no aparelho (chave de idempotência), `versaoBase` é a versão que o
 * aparelho tinha quando leu o registro pela última vez (regra 13).
 */
export interface ItemFila {
  /** uuid gerado no aparelho (crypto.randomUUID()); chave de idempotência. */
  id: string;
  usuarioId: string;
  entidade: Entidade;
  /** null quando o item cria um registro novo (ainda sem id no servidor). */
  entidadeId: string | null;
  /** null quando o payload é o registro inteiro (criação), não um campo. */
  campo: string | null;
  payload: unknown;
  /** null na criação; obrigatório ao atualizar entidade versionada. */
  versaoBase: number | null;
  criadoNoClienteEm: string;
  estado: EstadoItemFila;
  tentativas: number;
  /** Epoch ms: o motor só tenta de novo a partir deste instante (espera crescente). */
  proximoEnvioEm: number;
  /** Preenchido quando `estado === "conflito"`: original preservado, nunca sobrescrito. */
  conflito?: ConflitoSincronizacao;
  /** Mensagem curta do último erro, para exibir com o botão "tentar novamente". */
  erroMensagem?: string;
}

export interface ConflitoSincronizacao {
  /** Estado do registro no servidor no momento do conflito (nunca alterado por este item). */
  original: unknown;
  versaoAtual: number;
  /** O que este item tentou gravar. */
  tentativa: unknown;
}

/** Rascunho por campo: o valor mais recente digitado no aparelho para um campo. */
export interface RascunhoCampo {
  /** `${entidade}:${entidadeId ?? "novo"}:${campo}` */
  chave: string;
  entidade: Entidade;
  entidadeId: string | null;
  campo: string;
  valor: unknown;
  atualizadoEm: string;
  /** Id do item de fila mais recente que carrega este valor (para achar o estado na UI). */
  itemFilaId: string;
}

/** Linha de `api.familias_do_dia` (PRD 13), cacheada para uso offline (PRD 15). */
export interface FamiliaDoDia {
  familiaId: string;
  visitaId: string;
  [chave: string]: unknown;
}

/** Linha de `regra_alerta` (DOC 3, PRD 9.3), cacheada para avaliação offline (PRD 15). */
export interface RegraAlertaCacheada {
  id: string;
  instrumentoVersao: string;
  [chave: string]: unknown;
}

/** Corpo aceito por `POST /api/sync`: sempre um lote, mesmo de um item só. */
export interface RequisicaoSincronizacao {
  itens: ItemSincronizacaoEntrada[];
}

/** O que o aparelho envia por item (sem os campos só de controle local). */
export interface ItemSincronizacaoEntrada {
  id: string;
  usuarioId: string;
  entidade: Entidade;
  entidadeId: string | null;
  campo: string | null;
  payload: unknown;
  versaoBase: number | null;
  criadoNoClienteEm: string;
}

export type StatusProcessamento = "processado" | "conflito" | "erro";

export interface ResultadoItemSincronizacao {
  id: string;
  status: StatusProcessamento;
  /** Nova versão da entidade, quando `status === "processado"` e a entidade é versionada. */
  versaoResultante?: number;
  conflito?: ConflitoSincronizacao;
  /** Verdadeiro quando um `registro_atendimento` divergente virou `registro_adendo` (D-05). */
  virouAdendo?: boolean;
  erro?: string;
}

export interface RespostaSincronizacao {
  resultados: ResultadoItemSincronizacao[];
}
