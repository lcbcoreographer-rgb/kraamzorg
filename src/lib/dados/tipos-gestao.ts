/**
 * Tipos da gestão da Fase 3 (P45, P46 e P52): capacidade probabilística,
 * financeiro (DRE, despesas, pagamento da equipe, extrato) e painel
 * executivo. Espelham o que as funções `api.*` da 0026_gestao.sql devolvem,
 * já em camelCase. Dinheiro sempre em centavos; datas como "aaaa-mm-dd"
 * (calendário) ou ISO (instante).
 */

// --- Capacidade (P45) -----------------------------------------------------------------

export type NivelCapacidade = "folga" | "atencao" | "sobrevenda";
export type CoberturaBackup = "ok" | "sem_reserva" | "insuficiente";

export interface SemanaCapacidade {
  /** Segunda-feira da semana. */
  semana: string;
  ocupacaoPct: number;
  /** Soma das probabilidades de cada família estar em atendimento na semana. */
  familiasEsperadas: number;
  /** Menor número de famílias simultâneas que cobre 90% dos casos. */
  familiasP90: number;
  probExcessoPct: number;
  profissionaisAtivas: number;
  /** Famílias que a equipe livre na semana atende. */
  capacidadeEquipe: number;
  cobertura: CoberturaBackup;
  nivel: NivelCapacidade;
}

export interface RegiaoCapacidade {
  regiaoId: string;
  regiao: string;
  limiteFamilias: number;
  semanas: SemanaCapacidade[];
}

export interface AlertaCapacidade {
  regiaoId: string;
  regiao: string;
  semana: string;
  nivel: NivelCapacidade;
  probExcessoPct: number;
  ocupacaoPct: number;
  cobertura: CoberturaBackup;
}

export interface FaixaNascimento {
  /** Dias em relação à DPP, inclusive (negativo é antes). */
  de: number;
  ate: number;
  /** Peso da faixa; a soma das faixas é 100. */
  peso: number;
}

export interface OrigemDistribuicao {
  modelo: "probabilistico" | "uniforme";
  fonte: "referencia" | "historico" | "uniforme";
  versao: string | null;
  descricao: string | null;
  historicoN: number;
  historicoMinimo: number | null;
  faixas: FaixaNascimento[];
}

export interface CapacidadeVisao {
  geradoEm: string;
  semanas: number;
  distribuicao: OrigemDistribuicao;
  limites: { alertaPct: number; sobrevendaProbPct: number };
  regioes: RegiaoCapacidade[];
  alertas: AlertaCapacidade[];
}

// --- Financeiro (P46) -----------------------------------------------------------------

export type CategoriaDespesa =
  | "equipe_assistencial"
  | "marketing_anuncios"
  | "deslocamento"
  | "contabilidade"
  | "tecnologia"
  | "pro_labore"
  | "outros";

export const CATEGORIAS_DESPESA: readonly CategoriaDespesa[] = [
  "equipe_assistencial",
  "marketing_anuncios",
  "deslocamento",
  "contabilidade",
  "tecnologia",
  "pro_labore",
  "outros",
];

/** Origens de lead do PRD 6.0 (enum origem_lead). */
export type OrigemLead =
  | "instagram_organico"
  | "meta_ads"
  | "google"
  | "site"
  | "indicacao_medica"
  | "indicacao_cliente"
  | "indicacao_amigo"
  | "presente"
  | "evento"
  | "outro"
  | "desconhecida";

export interface DespesaCategoriaValor {
  categoria: CategoriaDespesa;
  centavos: number;
}

export interface PontoSerieDre {
  mes: string;
  receitaCentavos: number;
  despesasCentavos: number;
  resultadoCentavos: number;
}

export interface Dre {
  /** Primeiro dia do mês. */
  mes: string;
  regime: "caixa";
  receitaCentavos: number;
  despesasCentavos: number;
  despesasPorCategoria: DespesaCategoriaValor[];
  resultadoCentavos: number;
  /** Nula quando não houve receita no mês. */
  margemPct: number | null;
  serie: PontoSerieDre[];
}

export interface Lancamento {
  tipo: "receita" | "despesa";
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valorCentavos: number;
}

export interface Lancamentos {
  mes: string;
  lancamentos: Lancamento[];
  receitasCentavos: number;
  despesasCentavos: number;
  saldoCentavos: number;
}

export interface Despesa {
  id: string;
  data: string;
  categoria: CategoriaDespesa;
  descricao: string;
  fornecedor: string | null;
  valorCentavos: number;
  canal: OrigemLead | null;
  /** Nasceu do pagamento da equipe: não se edita nem se remove à mão. */
  daEquipe: boolean;
}

export interface ListaDespesas {
  mes: string;
  categorias: CategoriaDespesa[];
  despesas: Despesa[];
  totalCentavos: number;
}

export interface PedidoDespesa {
  /** Nulo para lançar uma despesa nova. */
  id?: string | null;
  data: string;
  categoria: CategoriaDespesa;
  descricao: string;
  fornecedor?: string | null;
  valorCentavos: number;
  canal?: OrigemLead | null;
}

export interface FaixaInadimplencia {
  deDias: number;
  /** Nulo na última faixa (sem teto). */
  ateDias: number | null;
  qtd: number;
  centavos: number;
}

export interface ItemInadimplente {
  id: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  parcela: number;
  valorCentavos: number;
  vencimento: string;
  diasAtraso: number;
}

export interface Inadimplencia {
  em: string;
  vencidoCentavos: number;
  vencidasQtd: number;
  emitidoAteHojeCentavos: number;
  /** Nula quando ainda não há nada emitido. */
  taxaPct: number | null;
  faixas: FaixaInadimplencia[];
  itens: ItemInadimplente[];
}

export interface MesPrevisao {
  mes: string;
  qtd: number;
  centavos: number;
}

export interface PrevisaoRecebimentos {
  atrasadasCentavos: number;
  meses: MesPrevisao[];
  aVencerCentavos: number;
}

export type StatusPagamentoEquipe = "bloqueado" | "liberado" | "pago";
export type MotivoBloqueioPagamento = "evolucao_nao_enviada" | "sem_valor_hora";

export interface PagamentoEquipe {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  profissionalNome: string;
  /** Só para o financeiro; a enfermeira não recebe. */
  familiaNome: string | null;
  visitas: number;
  horas: number;
  valorHoraCentavos: number | null;
  valorHorasCentavos: number;
  ajudaDeslocamentoCentavos: number;
  totalCentavos: number;
  status: StatusPagamentoEquipe;
  motivoBloqueio: MotivoBloqueioPagamento | null;
  pagoEm: string | null;
  estadoAcompanhamento: string;
}

export interface ResumoPagamentosEquipe {
  mes: string;
  bloqueadoCentavos: number;
  bloqueadoQtd: number;
  liberadoCentavos: number;
  liberadoQtd: number;
  pagoNoMesCentavos: number;
  pagoNoMesQtd: number;
}

export interface PagamentosEquipe {
  resumo: ResumoPagamentosEquipe;
  pagamentos: PagamentoEquipe[];
}

export interface ResultadoPagamentoEquipe {
  pagamentoId: string;
  despesaId: string;
  totalCentavos: number;
  pagoEm: string;
}

export type FormatoExtrato = "ofx" | "csv";
export type SituacaoExtrato = "conferida" | "sugerida" | "sem_correspondencia";

export interface LinhaExtratoEntrada {
  data: string;
  /** Positivo é crédito, negativo é débito. */
  valorCentavos: number;
  descricao: string;
  documento?: string | null;
}

export interface Conferencia {
  conferidas: number;
  sugeridas: number;
  semCorrespondencia: number;
}

export interface ResultadoImportacaoExtrato {
  importacaoId: string;
  jaImportado: boolean;
  linhas: number;
  linhasNovas: number;
  conferencia: Conferencia;
}

export interface ImportacaoExtrato {
  id: string;
  formato: FormatoExtrato;
  linhas: number;
  linhasNovas: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  importadoEm: string;
  conferidas: number;
  sugeridas: number;
  semCorrespondencia: number;
}

export interface LinhaExtrato {
  id: string;
  importacaoId: string;
  data: string;
  valorCentavos: number;
  descricao: string;
  situacao: SituacaoExtrato;
  cobrancaId: string | null;
  cobrancaParcela: number | null;
  cobrancaSituacao: string | null;
  familiaNome: string | null;
  despesaId: string | null;
  despesaDescricao: string | null;
}

export interface ExtratoVisao {
  importacoes: ImportacaoExtrato[];
  /** Só as linhas da importação pedida. */
  linhas: LinhaExtrato[];
}

// --- Painel executivo (P52) -------------------------------------------------------------

export interface MetasKraamzorg {
  contratosMes: number;
  familiasMes: number;
  faturamentoMesCentavos: number;
  nps: number;
}

export interface ProgressoMetas {
  contratos: number;
  familias: number;
  faturamentoCentavos: number;
  /** Nulo sem amostra mínima de respostas. */
  nps: number | null;
}

export interface Congelamento {
  data: string;
  tag: string;
  diasRestantes: number;
}

export interface PainelComercial {
  leads: number;
  sessoesRealizadas: number;
  contratosAssinados: number;
  conversaoPct: number | null;
  faturamentoCentavos: number;
  ticketMedioCentavos: number | null;
}

export interface PainelMarketing {
  leadsPorOrigem: { origem: OrigemLead; leads: number }[];
  /** `canal` nulo é despesa de marketing sem canal informado. */
  custoPorCanal: { canal: OrigemLead | null; centavos: number }[];
  custoTotalCentavos: number;
  receitaPorOrigem: { origem: OrigemLead; centavos: number }[];
  receitaPorCampanha: { campanha: string; centavos: number }[];
}

export interface PainelOperacao {
  familiasAtivas: number;
  familiasIniciadas: number;
  visitasRealizadas: number;
  ocorrenciasAbertas: number;
  capacidadeSemanas: number;
  capacidade: {
    regiao: string;
    semana: string;
    ocupacaoPct: number;
    probExcessoPct: number;
    cobertura: CoberturaBackup;
    nivel: NivelCapacidade;
  }[];
  semanasEmSobrevenda: number;
  semanasEmAtencao: number;
}

export interface PainelExperiencia {
  respostas: number;
  promotores: number;
  detratores: number;
  amostraMinima: number;
  nps: number | null;
  indicacoes: number;
  depoimentos: number;
}

export interface PainelFinanceiro {
  recebimentosCentavos: number;
  custosCentavos: number;
  resultadoCentavos: number;
  margemPct: number | null;
  inadimplenciaPct: number | null;
  vencidoCentavos: number;
  previsaoAVencerCentavos: number;
  previsaoAtrasadasCentavos: number;
  faturamentoCentavos: number;
}

export interface PainelExecutivo {
  geradoEm: string;
  mes: string;
  metas: MetasKraamzorg;
  progresso: ProgressoMetas;
  congelamento: Congelamento | null;
  comercial: PainelComercial;
  marketing: PainelMarketing;
  operacao: PainelOperacao;
  experiencia: PainelExperiencia;
  financeiro: PainelFinanceiro;
}

/**
 * Gestão da Fase 3. Leitura e escrita vão pelas funções `api.*` da
 * 0026_gestao.sql (na real) ou pela loja em memória (demonstração). Recusa de
 * negócio vira ErroRepositorio "recusado" com "gestao:<código>" no detalhe
 * (codigoGestao em erros.ts).
 */
export interface GestaoRepositorio {
  /** Coordenação e diretoria. `semanas` padrão: parâmetro do banco (8). */
  capacidade(semanas?: number): Promise<CapacidadeVisao>;
  /** Financeiro e diretoria. `mes` é qualquer dia do mês; padrão o mês atual. */
  dre(mes?: string | null): Promise<Dre>;
  lancamentos(mes?: string | null): Promise<Lancamentos>;
  despesas(mes?: string | null): Promise<ListaDespesas>;
  salvarDespesa(pedido: PedidoDespesa): Promise<{ id: string }>;
  removerDespesa(despesaId: string, motivo: string): Promise<void>;
  inadimplencia(): Promise<Inadimplencia>;
  previsaoRecebimentos(): Promise<PrevisaoRecebimentos>;
  pagamentosEquipe(mes?: string | null): Promise<PagamentosEquipe>;
  pagarEquipe(
    pagamentoId: string,
    data?: string | null,
  ): Promise<ResultadoPagamentoEquipe>;
  /** Enfermeira: só os próprios, sem o nome da família. */
  meusPagamentos(): Promise<PagamentoEquipe[]>;
  importarExtrato(
    arquivoHash: string,
    formato: FormatoExtrato,
    linhas: LinhaExtratoEntrada[],
  ): Promise<ResultadoImportacaoExtrato>;
  reconciliarExtrato(importacaoId?: string | null): Promise<Conferencia>;
  extrato(importacaoId?: string | null): Promise<ExtratoVisao>;
  /** Só a diretoria. */
  painelExecutivo(mes?: string | null): Promise<PainelExecutivo>;
}
