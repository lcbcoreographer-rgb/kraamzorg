import type { Papel } from "@/lib/auth/papeis";
import type { Enums, Json } from "@/lib/db/types";
import type { MensagemModelo, Parametro, Regiao } from "@/lib/dados/tipos";

/**
 * Tipos de domínio do módulo de Configurações (P13), além dos que já vêm
 * de `@/lib/dados/tipos` (`Parametro`, `MensagemModelo`, `Regiao`,
 * `PacoteVigente`). Nomes em camelCase na tela; no banco, snake_case (PRD
 * 5.2). Datas como texto ISO, dinheiro em centavos.
 */

export type AcaoTermoAlerta = Enums<"acao_termo_alerta">;
export type StatusConteudo = Enums<"status_conteudo">;
export type CanalContato = Enums<"canal_contato">;

// --- Parâmetros --------------------------------------------------------

/**
 * Classificação do valor de um parâmetro, usada só para escolher o campo
 * certo na edição e validar que o novo valor não muda de forma (PRD 13.
 * "Fazer": "validação por tipo de parâmetro"). Não é um tipo do banco:
 * `parametro.valor` é `jsonb` livre; a classificação vem do próprio valor
 * atual, nunca de uma lista fixa no código (isso seria "limite... no
 * código", CLAUDE.md).
 */
export type TipoParametro =
  | "inteiro"
  | "decimal"
  | "booleano"
  | "texto"
  | "lista_texto"
  | "objeto"
  | "nulo";

export interface ParametroComTipo extends Parametro {
  tipo: TipoParametro;
}

/** Uma linha do histórico do parâmetro, a partir do log de auditoria (PRD 13). */
export interface HistoricoParametroItem {
  id: number;
  valorAntes: Json | null;
  valorDepois: Json | null;
  usuarioId: string | null;
  criadoEm: string;
}

// --- Pacotes e preços (PRD 6.3, D-06) -----------------------------------

export interface Pacote {
  id: string;
  nome: string;
  linha: string | null;
  dias: number;
  gemelar: boolean;
  paginaPdf: number | null;
  ordem: number;
  ativo: boolean;
}

export interface VersaoPacote {
  id: string;
  pacoteId: string;
  valorCentavos: number;
  horasPorVisita: number;
  parcelasMaxSemJuros: number;
  destaque: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  inclui: string[];
  naoInclui: string[];
}

export interface PacoteComVersoes extends Pacote {
  versoes: VersaoPacote[];
}

export interface PedidoNovoPacote {
  nome: string;
  linha: string | null;
  dias: number;
  gemelar: boolean;
  paginaPdf: number | null;
  valorCentavos: number;
  horasPorVisita: number;
  parcelasMaxSemJuros: number;
  vigenciaInicio: string;
  inclui: string[];
  naoInclui: string[];
}

export interface PedidoNovaVersao {
  pacoteId: string;
  valorCentavos: number;
  horasPorVisita: number;
  parcelasMaxSemJuros: number;
  destaque: string | null;
  vigenciaInicio: string;
  inclui: string[];
  naoInclui: string[];
}

// --- Regiões e localidades ------------------------------------------------

export interface RegiaoDetalhe extends Regiao {
  limiteFamiliasSemana: number;
}

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
  regiaoId: string | null;
  atendida: boolean;
  requerConfirmacao: boolean;
  taxaDeslocamentoCentavos: number;
  aliases: string[];
  observacao: string | null;
}

// --- Condições comerciais (PRD 6.3, "tabela única de condições") --------

export type TipoCondicaoComercial =
  "desconto_pct" | "parcelamento" | "bonificacao";

export interface CondicaoComercial {
  id: string;
  nome: string;
  tipo: TipoCondicaoComercial;
  valor: number;
  requerAprovacao: boolean;
  ativa: boolean;
  observacao: string | null;
}

// --- Mensagens (PRD 23) ---------------------------------------------------

export interface MensagemModeloDetalhe extends MensagemModelo {
  aprovadoPor: string | null;
  atualizadoEm: string;
}

// --- Termos de alerta (coordenação, PRD 13, onboarding 9.6) --------------

export interface TermoAlerta {
  id: string;
  termo: string;
  acao: AcaoTermoAlerta;
  mensagemChave: string;
  ativo: boolean;
}

// --- Faixas da régua (PRD 10.3) -------------------------------------------

export interface ReguaFaixaDetalhe {
  id: string;
  ordem: number;
  semanaMin: number | null;
  semanaMax: number | null;
  objetivo: string;
  gatilhoComercial: string;
  mensagemChave: string;
}

// --- Papéis que o módulo distingue -----------------------------------------

/** PRD 13: diretoria vê tudo; coordenação só termos de alerta (e instrumentos, fora do P13). */
export function podeVerTudo(papeis: readonly Papel[]): boolean {
  return papeis.includes("diretoria");
}

export function podeVerTermosAlerta(papeis: readonly Papel[]): boolean {
  return papeis.includes("diretoria") || papeis.includes("coordenacao");
}
