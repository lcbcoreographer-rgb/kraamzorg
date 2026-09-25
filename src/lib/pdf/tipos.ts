/**
 * Tipos de entrada dos geradores de evolução em PDF (PRD 9.5). A biblioteca
 * não lê o banco: quem chama monta estes objetos a partir do agregado do
 * acompanhamento (P39, P40) e dos textos de `mensagem_modelo` com
 * destinatário `medico` (chaves `evo_*`, PRD 6.7). Os campos seguem os
 * nomes de coluna do PRD 6 em português snake_case só onde a origem é
 * literal do banco (`peso_nascimento_g` vira `pesoNascimentoG` em
 * camelCase, convenção de todo o `src/`).
 */

/** Sexo do bebê, igual ao check de `bebe.sexo` (PRD 6.2). Sem "nao_informado": a evolução exige o dado para a concordância de gênero. */
export type Sexo = "masculino" | "feminino";

/** Igual ao check de `bebe.tipo_parto` (PRD 6.2), sem "nao_informado": a evolução exige o dado para a seção de ferida operatória. */
export type TipoParto = "vaginal" | "cesarea";

/** Igual à origem de pesagem descrita no PRD 9.5 ("alta, domicílio, pediatra"); o peso ao nascer é campo à parte (`bebe.peso_nascimento_g`). */
export type OrigemPesagem = "alta_hospitalar" | "domicilio" | "pediatra";

/** Data em formato "aaaa-mm-dd" (coluna `date`, sem hora, fuso não se aplica). */
export type DataIso = string;

export interface ContatoMedico {
  nome: string;
  email?: string;
  telefoneE164?: string;
}

export interface DadosProfissional {
  nome: string;
  funcao: string; // 'enfermeira_obstetrica' | 'enfermeira_neonatal' | ...
  conselho: string; // 'COREN'
  conselhoUf: string; // duas letras
  conselhoNumero: string;
}

/** Período do acompanhamento (PRD 6.5 `acompanhamento`), igual nos dois documentos. */
export interface PeriodoAcompanhamento {
  inicio: DataIso;
  fim: DataIso;
}

export interface Pesagem {
  data: DataIso;
  pesoG: number;
  origem: OrigemPesagem;
}

/** Uma faixa mínimo a máximo do período (PA, FC, temperatura, SpO2, FR). */
export interface Faixa {
  min: number;
  max: number;
}

export type TipoAleitamento = "exclusivo" | "misto" | "complemento";
export type EvolucaoGanhoPeso = "progressivo" | "estavel" | "perda";
export type EstadoIctericia = "ausente" | "regressao" | "presente";
export type RemissaoDor = "total" | "parcial" | "nenhuma";

export interface LesaoMama {
  grau: string; // 'I' | 'II' | 'III', como o cadastro registrar
  lado: "esquerda" | "direita" | "bilateral";
  local: "mama" | "mamilo";
  diaSurgimento?: number;
  grauFinal?: string;
}

export interface IntervencaoLaser {
  dias: number[]; // dias (D) de acompanhamento em que houve aplicação
  finalidade: string;
  doseJ?: number;
}

export interface IntervencaoIlib {
  dias: number[];
}

export interface RetornoObstetrico {
  data?: DataIso;
  motivos: string[];
}

/**
 * Entrada da evolução puerperal (PRD 9.5, tabela "Evolução de Enfermagem
 * Puerperal"). `id` é o identificador do `relatorio_medico` (ou do
 * acompanhamento, enquanto a tabela não existe nesta trilha): vira o nome
 * do arquivo, nunca o nome da paciente (PRD 9.5, "Formato do PDF").
 */
export interface DadosEvolucaoPuerperal {
  id: string;
  paciente: { nome: string; idade: number };
  periodo: PeriodoAcompanhamento;
  historico: {
    tipoParto: TipoParto;
    dataNascimentoBebe: DataIso;
    dataAlta: DataIso;
  };
  diaPuerperioFinal: number;
  sinaisVitais: {
    paSistolica: Faixa;
    paDiastolica: Faixa;
    fc: Faixa;
    temperatura: Faixa;
    spo2: Faixa;
  };
  /** Todos os sinais vitais dentro da faixa de referência o período inteiro: liga a frase padrão de estabilidade. */
  estabilidadeHemodinamica: boolean;
  /** Disposição, humor, comparação com os dias anteriores: julgamento clínico da enfermeira (PRD 9.5), fora do texto-padrão. */
  evolucaoGeralTextoLivre?: string;
  feridaOperatoria?: {
    semSinaisFlogisticos: boolean;
    /** Achado fora do padrão (com sinais flogísticos, por exemplo): substitui a frase-padrão em vez de forçá-la sobre um achado diferente. */
    textoLivre?: string;
  };
  laceracaoPerineal?: {
    grau: string;
    local: string;
    suturada: boolean;
  };
  mamas: {
    turgencia: string;
    producao: string;
    lesao?: LesaoMama;
  };
  dor: {
    escalaInicial: number;
    escalaMaxima: number;
    escalaFinal: number;
    diaZerou?: number;
    remissao: RemissaoDor;
    /** Contexto (local, o que aliviou): julgamento clínico, fora do texto-padrão de remissão. */
    textoLivre?: string;
  };
  eliminacoes: {
    quantidade: string;
    aspecto: string;
  };
  intervencoes: {
    laser?: IntervencaoLaser;
    ilib?: IntervencaoIlib;
  };
  orientacoesAlta: {
    itensPersonalizados: string[];
  };
  encaminhamentos?: {
    retornoObstetrico?: RetornoObstetrico;
    saudeMental?: boolean;
    nutricao?: boolean;
  };
  /** Tipo de aleitamento observado nos registros do período (achado), comparado à conclusão na validação. */
  alimentacaoObservada: TipoAleitamento;
  conclusao: {
    amamentacao: TipoAleitamento;
    autonomiaFamilia: string;
    producaoLeite?: string;
  };
  contatoObstetra?: ContatoMedico;
  profissional: DadosProfissional;
  dataEmissao: DataIso;
}

/**
 * Entrada da evolução neonatal (PRD 9.5, tabela "Evolução de Enfermagem
 * Neonatal"), uma por bebê.
 */
export interface DadosEvolucaoNeonatal {
  id: string;
  bebeId: string;
  bebe: {
    nome?: string;
    sexo: Sexo;
    tipoParto: TipoParto;
    dataNascimento: DataIso;
    pesoNascimentoG: number;
  };
  filiacao: string[]; // nomes dos pais/responsáveis, como consta no cadastro
  periodo: PeriodoAcompanhamento;
  diaVidaFinal: number;
  pesagens: Pesagem[];
  estadoGeral: {
    reatividade: string;
    mucosas: string;
    temperatura: Faixa;
    fontanela: string;
  };
  ictericia?: {
    zonaKramer: 1 | 2 | 3 | 4 | 5;
    intensidade?: string;
    tendencia?: "estavel" | "regressao" | "progressao";
  };
  respiratorio: {
    fr: Faixa;
    esforco: string;
  };
  cardiovascular: {
    fc: Faixa;
    spo2: Faixa;
  };
  abdomeCoto: {
    estadoCoto: string;
    dataQueda?: DataIso;
  };
  alimentacao: {
    tipo: TipoAleitamento;
    complementoMl?: number;
    succao: string;
  };
  genitaliaEliminacoes: {
    diurese: boolean;
    evacuacoes: boolean;
  };
  orientacoesCondutas: string[];
  conclusao: {
    aleitamento: TipoAleitamento;
    ganhoPeso: EvolucaoGanhoPeso;
    ictericia: EstadoIctericia;
    vinculoTexto?: string;
  };
  contatoPediatra?: ContatoMedico;
  profissional: DadosProfissional;
  dataEmissao: DataIso;
}

/**
 * Textos padrão aprovados (PRD 6.7 `mensagem_modelo`, destinatário
 * `medico`, chaves `evo_*`). A biblioteca não grava nem busca estas linhas:
 * elas chegam prontas, com `{variavel}` a preencher (`textos.ts`).
 */
export type TextosModelo = Record<string, string>;

export interface ResultadoPdf {
  buffer: Buffer;
  nomeArquivo: string;
}

export type ResultadoGeracao =
  ({ ok: true } & ResultadoPdf) | { ok: false; erros: string[] };
