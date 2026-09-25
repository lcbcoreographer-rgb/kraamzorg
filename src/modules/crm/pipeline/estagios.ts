import type { Papel } from "@/lib/auth/papeis";
import { Constants } from "@/lib/db/types";
import type { EstagioP1, EstagioP2, NumeroPipeline } from "@/lib/dados/tipos";

/**
 * Estágios e transições dos pipelines 1 e 2 (P15, PRD 7.1 e 7.2). Espelha
 * `supabase/migrations/0006_maquinas_estado.sql` (tabela
 * `transicao_permitida`) e `src/lib/dados/demonstracao/transicoes.json`: se
 * uma migration nova mudar a tabela, este arquivo precisa acompanhar (fora
 * da pasta do módulo, então não dá para importar direto).
 *
 * A tela mostra em "Mover para" só o que está aqui: quem chama confere
 * `podeVerTransicao` para não oferecer um botão que o próprio papel não vai
 * conseguir confirmar, mas quem barra de verdade é sempre
 * `privado.transicionar` no banco (PRD 7, invariante 1).
 */

export const ORDEM_P1: readonly EstagioP1[] = [
  "novo",
  "em_conversa_ia",
  "qualificado",
  "sessao_venda_agendada",
  "sessao_venda_realizada",
  "nutricao",
  "nao_qualificado",
  "fora_de_cobertura",
  "perdido",
];

export const ORDEM_P2: readonly EstagioP2[] = [
  "proposta_enviada",
  "em_negociacao",
  "ganho",
  "contrato_gerado",
  "aguardando_assinatura",
  "assinado",
  "cobranca_gerada",
  "pagamento_confirmado",
  "nota_fiscal_emitida",
  "consulta_prenatal_agendada",
  "consulta_realizada",
  "enfermeira_designada",
  "aguardando_nascimento",
  "bebe_nasceu",
  "aguardando_alta",
  "atendimento_liberado",
  "intercorrencia",
  "perdido",
  "cancelado",
  "distrato",
];

export const ROTULO_ESTAGIO_P1: Record<EstagioP1, string> = {
  novo: "Novo",
  em_conversa_ia: "Em conversa",
  qualificado: "Qualificado",
  sessao_venda_agendada: "Sessão agendada",
  sessao_venda_realizada: "Sessão realizada",
  nutricao: "Nutrição",
  nao_qualificado: "Não qualificado",
  fora_de_cobertura: "Fora de cobertura",
  perdido: "Perdido",
};

export const ROTULO_ESTAGIO_P2: Record<EstagioP2, string> = {
  proposta_enviada: "Proposta enviada",
  em_negociacao: "Negociação",
  ganho: "Ganho",
  contrato_gerado: "Contrato gerado",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  cobranca_gerada: "Cobrança gerada",
  pagamento_confirmado: "Pagamento confirmado",
  nota_fiscal_emitida: "Nota fiscal emitida",
  consulta_prenatal_agendada: "Consulta pré-natal agendada",
  consulta_realizada: "Consulta realizada",
  enfermeira_designada: "Enfermeira designada",
  aguardando_nascimento: "Aguardando nascimento",
  bebe_nasceu: "Bebê nasceu",
  aguardando_alta: "Aguardando alta",
  atendimento_liberado: "Atendimento liberado",
  perdido: "Perdido",
  cancelado: "Cancelado",
  distrato: "Distrato",
  intercorrencia: "Intercorrência",
};

export function rotuloEstagio(
  pipeline: NumeroPipeline,
  estagio: EstagioP1 | EstagioP2,
): string {
  return pipeline === 1
    ? ROTULO_ESTAGIO_P1[estagio as EstagioP1]
    : ROTULO_ESTAGIO_P2[estagio as EstagioP2];
}

interface Transicao {
  de: string;
  para: string;
  /** null: qualquer papel ativo (perfis comerciais) pode confirmar. */
  papelMinimo: Papel | null;
}

/** Cópia de `transicao_permitida` para as máquinas p1 e p2 (0006, seção 7.1 e 7.2). */
const TRANSICOES_P1: readonly Transicao[] = [
  { de: "novo", para: "em_conversa_ia", papelMinimo: "comercial" },
  { de: "novo", para: "nao_qualificado", papelMinimo: "comercial" },
  { de: "novo", para: "fora_de_cobertura", papelMinimo: "comercial" },
  { de: "novo", para: "nutricao", papelMinimo: "comercial" },
  { de: "novo", para: "perdido", papelMinimo: "comercial" },
  { de: "em_conversa_ia", para: "qualificado", papelMinimo: "comercial" },
  { de: "em_conversa_ia", para: "nao_qualificado", papelMinimo: "comercial" },
  { de: "em_conversa_ia", para: "fora_de_cobertura", papelMinimo: "comercial" },
  { de: "em_conversa_ia", para: "nutricao", papelMinimo: "comercial" },
  { de: "em_conversa_ia", para: "perdido", papelMinimo: "comercial" },
  {
    de: "qualificado",
    para: "sessao_venda_agendada",
    papelMinimo: "comercial",
  },
  { de: "qualificado", para: "nutricao", papelMinimo: "comercial" },
  { de: "qualificado", para: "perdido", papelMinimo: "comercial" },
  { de: "qualificado", para: "fora_de_cobertura", papelMinimo: "comercial" },
  {
    de: "sessao_venda_agendada",
    para: "sessao_venda_realizada",
    papelMinimo: "comercial",
  },
  {
    de: "sessao_venda_agendada",
    para: "qualificado",
    papelMinimo: "comercial",
  },
  { de: "nutricao", para: "em_conversa_ia", papelMinimo: "comercial" },
  { de: "nutricao", para: "qualificado", papelMinimo: "comercial" },
  {
    de: "nutricao",
    para: "sessao_venda_agendada",
    papelMinimo: "comercial",
  },
  { de: "perdido", para: "em_conversa_ia", papelMinimo: "comercial" },
  { de: "nao_qualificado", para: "em_conversa_ia", papelMinimo: "comercial" },
  { de: "fora_de_cobertura", para: "em_conversa_ia", papelMinimo: "comercial" },
];

const TRANSICOES_P2: readonly Transicao[] = [
  // entrada vinda do P1
  {
    de: "sessao_venda_realizada",
    para: "proposta_enviada",
    papelMinimo: "comercial",
  },
  { de: "qualificado", para: "proposta_enviada", papelMinimo: "comercial" },
  { de: "nutricao", para: "proposta_enviada", papelMinimo: "comercial" },
  // linha principal (0006: "automatica" só isenta o usuário quando a
  // chamada vem do sistema; com sessão, continua exigindo o papel_minimo,
  // então entra aqui também, ver docs/sessoes/p15-p17-pipeline.md item 1)
  { de: "proposta_enviada", para: "em_negociacao", papelMinimo: "comercial" },
  { de: "em_negociacao", para: "ganho", papelMinimo: "comercial" },
  { de: "ganho", para: "contrato_gerado", papelMinimo: "comercial" },
  {
    de: "contrato_gerado",
    para: "aguardando_assinatura",
    papelMinimo: "comercial",
  },
  { de: "aguardando_assinatura", para: "assinado", papelMinimo: "comercial" },
  { de: "assinado", para: "cobranca_gerada", papelMinimo: "financeiro" },
  {
    de: "cobranca_gerada",
    para: "pagamento_confirmado",
    papelMinimo: "financeiro",
  },
  {
    de: "pagamento_confirmado",
    para: "nota_fiscal_emitida",
    papelMinimo: "financeiro",
  },
  {
    de: "nota_fiscal_emitida",
    para: "consulta_prenatal_agendada",
    papelMinimo: "coordenacao",
  },
  {
    de: "consulta_prenatal_agendada",
    para: "consulta_realizada",
    papelMinimo: "coordenacao",
  },
  {
    de: "consulta_realizada",
    para: "enfermeira_designada",
    papelMinimo: "coordenacao",
  },
  {
    de: "enfermeira_designada",
    para: "aguardando_nascimento",
    papelMinimo: "coordenacao",
  },
  {
    de: "aguardando_nascimento",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  { de: "bebe_nasceu", para: "aguardando_alta", papelMinimo: "coordenacao" },
  {
    de: "aguardando_alta",
    para: "atendimento_liberado",
    papelMinimo: "coordenacao",
  },
  // nota fiscal em paralelo
  {
    de: "pagamento_confirmado",
    para: "consulta_prenatal_agendada",
    papelMinimo: "coordenacao",
  },
  // bebe_nasceu a partir de qualquer estágio depois do pagamento (PRD 7.2:
  // "o nascimento pode chegar em qualquer estágio depois de
  // pagamento_confirmado"; protótipo comercial-pipeline.html, PODE.pagamento)
  {
    de: "pagamento_confirmado",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  {
    de: "nota_fiscal_emitida",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  {
    de: "consulta_prenatal_agendada",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  {
    de: "consulta_realizada",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  {
    de: "enfermeira_designada",
    para: "bebe_nasceu",
    papelMinimo: "coordenacao",
  },
  // desvio perdido: venda perdida antes do ganho
  { de: "proposta_enviada", para: "perdido", papelMinimo: "comercial" },
  { de: "em_negociacao", para: "perdido", papelMinimo: "comercial" },
  // desvio cancelado: fechamento desfeito antes da assinatura
  { de: "ganho", para: "cancelado", papelMinimo: "comercial" },
  { de: "contrato_gerado", para: "cancelado", papelMinimo: "comercial" },
  { de: "aguardando_assinatura", para: "cancelado", papelMinimo: "comercial" },
  // desvio distrato: contrato assinado desfeito, decisão da diretoria
  { de: "assinado", para: "distrato", papelMinimo: "diretoria" },
  { de: "cobranca_gerada", para: "distrato", papelMinimo: "diretoria" },
  { de: "pagamento_confirmado", para: "distrato", papelMinimo: "diretoria" },
  { de: "nota_fiscal_emitida", para: "distrato", papelMinimo: "diretoria" },
  {
    de: "consulta_prenatal_agendada",
    para: "distrato",
    papelMinimo: "diretoria",
  },
  { de: "consulta_realizada", para: "distrato", papelMinimo: "diretoria" },
  { de: "enfermeira_designada", para: "distrato", papelMinimo: "diretoria" },
  { de: "aguardando_nascimento", para: "distrato", papelMinimo: "diretoria" },
  { de: "bebe_nasceu", para: "distrato", papelMinimo: "diretoria" },
  { de: "aguardando_alta", para: "distrato", papelMinimo: "diretoria" },
  // desvio intercorrencia: entra de qualquer estágio ativo, qualquer papel
  // (0006: "qualquer pessoa com papel, ou o sistema"; papel_minimo nulo)
  {
    de: "proposta_enviada",
    para: "intercorrencia",
    papelMinimo: null,
  },
  { de: "em_negociacao", para: "intercorrencia", papelMinimo: null },
  { de: "ganho", para: "intercorrencia", papelMinimo: null },
  { de: "contrato_gerado", para: "intercorrencia", papelMinimo: null },
  {
    de: "aguardando_assinatura",
    para: "intercorrencia",
    papelMinimo: null,
  },
  { de: "assinado", para: "intercorrencia", papelMinimo: null },
  { de: "cobranca_gerada", para: "intercorrencia", papelMinimo: null },
  {
    de: "pagamento_confirmado",
    para: "intercorrencia",
    papelMinimo: null,
  },
  {
    de: "nota_fiscal_emitida",
    para: "intercorrencia",
    papelMinimo: null,
  },
  {
    de: "consulta_prenatal_agendada",
    para: "intercorrencia",
    papelMinimo: null,
  },
  {
    de: "consulta_realizada",
    para: "intercorrencia",
    papelMinimo: null,
  },
  {
    de: "enfermeira_designada",
    para: "intercorrencia",
    papelMinimo: null,
  },
  {
    de: "aguardando_nascimento",
    para: "intercorrencia",
    papelMinimo: null,
  },
  { de: "bebe_nasceu", para: "intercorrencia", papelMinimo: null },
  { de: "aguardando_alta", para: "intercorrencia", papelMinimo: null },
  // saída de intercorrencia: só de volta ao que existia antes, só coordenação
  {
    de: "intercorrencia",
    para: "proposta_enviada",
    papelMinimo: "coordenacao",
  },
  { de: "intercorrencia", para: "em_negociacao", papelMinimo: "coordenacao" },
  { de: "intercorrencia", para: "ganho", papelMinimo: "coordenacao" },
  { de: "intercorrencia", para: "contrato_gerado", papelMinimo: "coordenacao" },
  {
    de: "intercorrencia",
    para: "aguardando_assinatura",
    papelMinimo: "coordenacao",
  },
  { de: "intercorrencia", para: "assinado", papelMinimo: "coordenacao" },
  { de: "intercorrencia", para: "cobranca_gerada", papelMinimo: "coordenacao" },
  {
    de: "intercorrencia",
    para: "pagamento_confirmado",
    papelMinimo: "coordenacao",
  },
  {
    de: "intercorrencia",
    para: "nota_fiscal_emitida",
    papelMinimo: "coordenacao",
  },
  {
    de: "intercorrencia",
    para: "consulta_prenatal_agendada",
    papelMinimo: "coordenacao",
  },
  {
    de: "intercorrencia",
    para: "consulta_realizada",
    papelMinimo: "coordenacao",
  },
  {
    de: "intercorrencia",
    para: "enfermeira_designada",
    papelMinimo: "coordenacao",
  },
  {
    de: "intercorrencia",
    para: "aguardando_nascimento",
    papelMinimo: "coordenacao",
  },
  { de: "intercorrencia", para: "bebe_nasceu", papelMinimo: "coordenacao" },
  {
    de: "intercorrencia",
    para: "aguardando_alta",
    papelMinimo: "coordenacao",
  },
];

export interface DestinoTransicao {
  estagio: EstagioP1 | EstagioP2;
  rotulo: string;
  /** true quando esta tela ainda não sabe se o papel confirma (cosmético). */
  papelMinimo: Papel | null;
}

/**
 * Destinos válidos a partir do estágio atual (para o menu "Mover para").
 * Não decide permissão: só evita oferecer um caminho que o banco vai
 * recusar de qualquer jeito (PRD 7, "o sistema recusa transição não
 * prevista").
 */
export function destinosPermitidos(
  pipeline: NumeroPipeline,
  de: EstagioP1 | EstagioP2 | null,
): DestinoTransicao[] {
  if (!de) return [];
  const tabela = pipeline === 1 ? TRANSICOES_P1 : TRANSICOES_P2;
  return tabela
    .filter((t) => t.de === de)
    .map((t) => ({
      estagio: t.para as EstagioP1 | EstagioP2,
      rotulo: rotuloEstagio(pipeline, t.para as EstagioP1 | EstagioP2),
      papelMinimo: t.papelMinimo,
    }));
}

/**
 * Cosmético: esconde uma opção que o papel logado quase certamente não vai
 * conseguir confirmar, para o menu não ficar cheio de botões que o banco
 * recusaria. Espelha frouxamente `privado.transicionar` (0006): diretoria
 * substitui qualquer papel, exceto saindo de `intercorrencia`; coordenação
 * substitui `enfermeira`. A defesa de verdade é sempre o banco.
 */
export function papelProvavelmenteConfirma(
  papeis: readonly Papel[],
  papelMinimo: Papel | null,
  de: EstagioP1 | EstagioP2 | null,
): boolean {
  if (papelMinimo === null) return true;
  if (papeis.includes(papelMinimo)) return true;
  if (de !== "intercorrencia" && papeis.includes("diretoria")) return true;
  if (papelMinimo === "enfermeira" && papeis.includes("coordenacao"))
    return true;
  return false;
}

export const MOTIVOS_PERDA = Constants.public.Enums.motivo_perda;

export const ROTULO_MOTIVO_PERDA: Record<
  (typeof MOTIVOS_PERDA)[number],
  string
> = {
  fora_de_cobertura: "Fora da área atendida",
  preco: "Preço",
  sem_disponibilidade: "Sem disponibilidade na data",
  achou_que_nao_precisaria: "Achou que não ia precisar",
  optou_outro_servico: "Optou por outro serviço",
  parceiro_nao_aprovou: "O parceiro não aprovou",
  sem_resposta: "Parou de responder",
  familia_assumiu: "A família decidiu assumir sozinha",
  perda_gestacional: "Perda gestacional",
  nao_contatar: "Pediu para não ser mais contatada",
  sem_interesse: "Sem interesse no serviço",
  outro: "Outro motivo",
};

export const ORIGENS_LEAD = Constants.public.Enums.origem_lead;
export type OrigemLead = (typeof ORIGENS_LEAD)[number];

export const ROTULO_ORIGEM_LEAD: Record<(typeof ORIGENS_LEAD)[number], string> =
  {
    instagram_organico: "Instagram (orgânico)",
    meta_ads: "Anúncio (Meta)",
    google: "Google",
    site: "Site",
    indicacao_medica: "Indicação médica",
    indicacao_cliente: "Indicação de cliente",
    indicacao_amigo: "Indicação de amigo ou família",
    presente: "Presente de padrinhos",
    evento: "Evento",
    outro: "Outra origem",
    desconhecida: "Não informada",
  };

export const PAPEIS_PESSOA = Constants.public.Enums.papel_pessoa;

export const ROTULO_PAPEL_PESSOA: Record<
  (typeof PAPEIS_PESSOA)[number],
  string
> = {
  mae: "Mãe",
  parceiro: "Parceiro ou parceira",
  acompanhante: "Acompanhante",
  responsavel: "Responsável",
  presenteador: "Quem está presenteando",
};
