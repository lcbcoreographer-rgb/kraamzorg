/**
 * Tipos do motor de alertas clínicos (DOC 3, PRD 9.3 e Apêndice B).
 *
 * Este arquivo só declara forma de dado. A lógica de avaliação mora em
 * `condicao.ts`, `curva-peso.ts` e `avaliar.ts`. Nada aqui chama rede,
 * banco ou storage: o motor roda igual no aparelho (offline) e no servidor.
 */

/** Espelha o enum `severidade` do banco (PRD 6.6). */
export type Severidade = "imediato" | "prioritario" | "atencao" | "informativo";

/** Espelha os valores de `regra_alerta.grupo` usados no comentário do PRD 6.6. */
export type GrupoAlerta =
  "puerpera" | "saude_mental" | "recem_nascido" | "amamentacao";

/**
 * De onde vem a regra, para decidir se ela nasce ativa (CLAUDE.md, "Clínico":
 * "Item com [clínico] no PRD entra parametrizado e desligado até aprovação").
 *
 * - "doc3": texto do DOC 3 em .docx (PRD 9.3), fonte vigente (K-06).
 * - "v4": v4.0 do PRD, citada no Apêndice B quando o DOC 3 não detalha o corte.
 * - "clinico": item marcado [clínico] no Apêndice B ou no capítulo 22.3,
 *   ainda sem validação da Edilaine. Entra no catálogo desligado.
 */
export type FonteRegra = "doc3" | "v4" | "clinico";

/** Operadores de comparação de uma condição folha. */
export type OperadorComparacao =
  | "igual"
  | "diferente"
  | "maior"
  | "maior_igual"
  | "menor"
  | "menor_igual"
  | "entre"
  | "em"
  | "contem"
  | "presente"
  | "ausente";

export type ValorPrimitivo = string | number | boolean | null;

/**
 * Condição folha: compara um campo do registro do dia (ou de uma visita da
 * série) com um valor. `campo` é o caminho pontuado dentro do objeto de
 * registro (ex.: "2.1.temperatura_c"), no mesmo formato usado por
 * `regra_alerta.campo` (PRD 6.6).
 */
export interface CondicaoComparacao {
  tipo: "comparacao";
  campo: string;
  operador: OperadorComparacao;
  valor?: ValorPrimitivo;
  valores?: ValorPrimitivo[]; // usado com o operador "em"
  valorMinimo?: number; // usado com o operador "entre"
  valorMaximo?: number; // usado com o operador "entre"
}

/**
 * Condição de série: a condição folha (`operador`/`valor`) precisa valer em
 * `visitasConsecutivas` visitas seguidas, contando da mais recente para trás.
 * Cobre PU-08 (37,5 a 37,9 °C em duas visitas seguidas): a série passada
 * como entrada é o histórico da própria família/bebê, nunca lida do banco
 * por este módulo.
 */
export interface CondicaoSerie {
  tipo: "serie";
  campo: string;
  operador: Exclude<
    OperadorComparacao,
    "presente" | "ausente" | "em" | "contem"
  >;
  valor?: ValorPrimitivo;
  valorMinimo?: number;
  valorMaximo?: number;
  /** Quantas visitas seguidas (incluindo a atual, quando `incluirAtual`) precisam bater. */
  visitasConsecutivas: number;
  /** Se a visita sendo salva agora entra na contagem. Padrão: true. */
  incluirAtual?: boolean;
}

/**
 * Condição de curva de peso do recém-nascido (RN-13): dispara quando a
 * perda em relação ao peso ao nascer, calculada a partir do menor peso já
 * observado (K-11), passa de `percentualPerdaMaximo`, ou quando o bebê
 * ainda não recuperou o peso de nascimento até `diaVidaLimiteRecuperacao`.
 * A série de pesos (data, dia de vida, peso) é sempre passada como entrada;
 * este módulo não busca peso em lugar nenhum.
 */
export interface CondicaoCurvaPeso {
  tipo: "curva_peso";
  /** Caminho do campo de peso (gramas) dentro do registro de cada visita. */
  campoPeso: string;
  percentualPerdaMaximo: number;
  diaVidaLimiteRecuperacao: number;
}

export interface CondicaoComposta {
  tipo: "e" | "ou";
  condicoes: Condicao[];
}

export interface CondicaoNegacao {
  tipo: "nao";
  condicao: Condicao;
}

export type Condicao =
  | CondicaoComparacao
  | CondicaoSerie
  | CondicaoCurvaPeso
  | CondicaoComposta
  | CondicaoNegacao;

/**
 * Uma visita anterior da série, para as regras que dependem de histórico
 * (PU-08, RN-13). `registro` tem o mesmo formato de caminho pontuado do
 * registro atual. A ordem esperada é da mais recente para a mais antiga;
 * as funções deste módulo não reordenam.
 */
export interface VisitaSerie {
  visitaId: string;
  dataVisita: string; // ISO 8601
  /** Dia de vida do bebê nessa visita, quando a regra for do recém-nascido. */
  diaVida?: number;
  registro: Record<string, unknown>;
}

/** Dados que uma condição pode consultar. Nunca vêm de rede, banco ou storage. */
export interface DadosCondicao {
  /** Registro da visita atual (o campo recém salvo já está aqui). */
  registro: Record<string, unknown>;
  /** Visitas anteriores da mesma família/bebê, mais recente primeiro. */
  serieAnterior?: VisitaSerie[];
  /** Fatos estáticos, ex.: peso ao nascer, dia de vida atual do bebê. */
  contexto?: Record<string, unknown>;
}

/**
 * Uma linha do catálogo de regras (Apêndice B ligado aos campos do DOC 2).
 * `id` identifica o vínculo campo → regra no catálogo (pode haver mais de
 * um vínculo para o mesmo `codigo` do DOC 3, como PU-04, que dispara pela
 * cesárea sem sinais de infecção — fonte DOC 3 — ou pela alteração na
 * episiotomia — [clínico], ainda desligada). `codigo` é sempre o código do
 * DOC 3 (PU-01 etc.), igual ao `regra_alerta.id` do banco (PRD 6.6).
 */
export interface RegraAlerta {
  id: string;
  codigo: string;
  grupo: GrupoAlerta;
  descricao: string;
  severidade: Severidade;
  conduta: string;
  /** Caminho do campo do DOC 2 que aciona a regra; null quando o sinal é manual (K-07). */
  campo: string | null;
  condicao: Condicao | null;
  fonte: FonteRegra;
  /** Deriva de `fonte !== "clinico"` no catálogo padrão; ver `catalogo.ts`. */
  ativa: boolean;
  /** Nota curta sobre a origem/pendência, para auditoria e para a tela (não é texto de família). */
  nota?: string;
}

/** Entrada de `avaliarCampo`: um campo do checklist acabou de ser salvo. */
export interface EntradaAvaliacaoCampo {
  /** Caminho do campo salvo agora, igual ao usado em `RegraAlerta.campo`. */
  campo: string;
  /** Registro completo da visita atual (o campo salvo já deve estar aqui). */
  registro: Record<string, unknown>;
  /** Série de visitas anteriores da mesma família/bebê, mais recente primeiro. */
  serieAnterior?: VisitaSerie[];
  /** Fatos estáticos que não mudam por visita (ex.: peso ao nascer). */
  contexto?: Record<string, unknown>;
  /** Catálogo a usar; padrão é `CATALOGO_REGRAS` (só as ativas entram na avaliação). */
  catalogo?: RegraAlerta[];
}

/** Entrada de `avaliarRegistro`: reavaliação completa (ex.: na sincronização). */
export interface EntradaAvaliacaoRegistro {
  registro: Record<string, unknown>;
  serieAnterior?: VisitaSerie[];
  contexto?: Record<string, unknown>;
  catalogo?: RegraAlerta[];
}

/** Resultado de uma regra que disparou. */
export interface ResultadoAlerta {
  regraId: string;
  codigo: string;
  grupo: GrupoAlerta;
  severidade: Severidade;
  descricao: string;
  conduta: string;
  campo: string | null;
  valorObservado: unknown;
  /** SM imediato cria ocorrência privada (PRD 9.3, "Saúde mental materna"). */
  exigeOcorrenciaPrivada: boolean;
  fonte: FonteRegra;
}

/** Um sinal do DOC 3 sem campo próprio no checklist (K-07), para o seletor da enfermeira. */
export interface SinalManual {
  codigo: string;
  grupo: GrupoAlerta;
  descricao: string;
  severidade: Severidade;
  conduta: string;
  exigeOcorrenciaPrivada: boolean;
  /** K-07 está aberto no PRD (22.3): a lista exata do seletor ainda depende da Edilaine. */
  pendenteAprovacaoClinica: boolean;
}

/** Os quatro campos obrigatórios para fechar um alerta clínico (PRD 9.3). */
export interface DadosFechamentoAlerta {
  sinalIdentificado?: string | null;
  acionadoEm?: string | null;
  orientacaoMedica?: string | null;
  condutaAdotada?: string | null;
}

export type CampoFechamentoObrigatorio =
  "sinalIdentificado" | "acionadoEm" | "orientacaoMedica" | "condutaAdotada";

export interface ResultadoValidacaoFechamento {
  valido: boolean;
  camposFaltando: CampoFechamentoObrigatorio[];
}
