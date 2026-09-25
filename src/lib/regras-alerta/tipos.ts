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
 * - "proposta": linha do Apêndice B sem fonte citada na coluna "Situação"
 *   (caso do seletor SM-01 a SM-07 do bloco 7). O Apêndice B inteiro é
 *   "proposta para validação clínica" e o P40 depende da aprovação dele
 *   (PROMPTS.md, P-1 item 18); sem "Fonte: DOC 3", entra desligada, igual
 *   ao seed de `regra_alerta` (supabase/seed.sql, seção 7).
 */
export type FonteRegra = "doc3" | "v4" | "clinico" | "proposta";

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
 * registro (ex.: "2.1.temperatura"), no mesmo formato usado por
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

/** Operadores do formato curto, o que já está gravado em `regra_alerta.condicao` pelo seed. */
export type OperadorCurto =
  "=" | "!=" | ">" | ">=" | "<" | "<=" | "entre" | "fora_da_faixa";

/**
 * Formato curto, sem `tipo`: é o formato das linhas de `regra_alerta` que o
 * seed já grava (ex.: `{"campo":"2.1.temperatura","operador":">=","valor":38}`
 * e `{"campo":"3.1.temperatura","operador":"fora_da_faixa","min":36,"max":38}`).
 * O motor aceita os dois formatos: o curto vira uma `CondicaoComparacao` (ou
 * a composição equivalente, no caso de `fora_da_faixa`) antes de avaliar.
 */
export interface CondicaoCurta {
  campo: string;
  operador: OperadorCurto;
  valor?: ValorPrimitivo;
  min?: number;
  max?: number;
}

/** O que pode estar em `regra_alerta.condicao`: formato completo ou curto. */
export type CondicaoJson = Condicao | CondicaoCurta;

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
 * Uma regra de alerta: linha de `regra_alerta` convertida por `regraDoBanco`
 * ou linha do catálogo de referência. `id` identifica a regra; no banco é o
 * próprio código. No catálogo de referência pode haver mais de um vínculo
 * para o mesmo `codigo` (PU-04 pela cesárea, fonte DOC 3, ativo; e pela
 * episiotomia ou laceração, [clínico], desligado). `codigo` é sempre o
 * código do DOC 3 (PU-01 etc.), igual ao `regra_alerta.id` (PRD 6.6).
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
  /** JSON de `regra_alerta.condicao`, formato completo ou curto; inválido nunca dispara. */
  condicao: CondicaoJson | null;
  /** Origem da regra no catálogo de referência; linha vinda do banco não tem. */
  fonte?: FonteRegra;
  /** No catálogo de referência deriva de `fonte === "doc3"`; do banco vem de `regra_alerta.ativa`. */
  ativa: boolean;
  /** `regra_alerta.instrumento_versao`, para gravar `alerta_clinico` com a mesma chave. */
  instrumentoVersao?: string;
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
  /**
   * Regras a avaliar, obrigatórias: em produção são as linhas de
   * `regra_alerta` do cache local convertidas por `regraDoBanco` (PRD 15:
   * "as regras vêm de regra_alerta em cache local"). Não há catálogo
   * padrão escondido: limite clínico não mora no código (CLAUDE.md).
   * Só as ativas entram na avaliação.
   */
  catalogo: RegraAlerta[];
}

/** Entrada de `avaliarRegistro`: reavaliação completa (ex.: na sincronização). */
export interface EntradaAvaliacaoRegistro {
  registro: Record<string, unknown>;
  serieAnterior?: VisitaSerie[];
  contexto?: Record<string, unknown>;
  /** Mesmas regras de `EntradaAvaliacaoCampo.catalogo`, obrigatórias. */
  catalogo: RegraAlerta[];
}

/** Linha de `regra_alerta` como o banco devolve (PRD 6.6, migration 0004). */
export interface LinhaRegraAlerta {
  id: string;
  grupo: string;
  descricao: string;
  severidade: string;
  conduta: string;
  campo: string | null;
  condicao: unknown;
  instrumento_versao: string;
  ativa: boolean;
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
  fonte?: FonteRegra;
  instrumentoVersao?: string;
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
