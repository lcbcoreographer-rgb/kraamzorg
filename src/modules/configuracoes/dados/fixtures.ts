import {
  CIDADES,
  PACOTES,
  REGIOES,
  VERSOES_PACOTE,
} from "@/lib/dados/demonstracao/fixtures";
import type {
  Cidade,
  CondicaoComercial,
  Pacote,
  ReguaFaixaDetalhe,
  RegiaoDetalhe,
  TermoAlerta,
  VersaoPacote,
} from "./tipos";

/**
 * Seed fictício do módulo de Configurações, para o modo demonstração
 * (`src/modules/configuracoes/dados/loja.ts`). Reaproveita os ids e os
 * dados de região, cidade, pacote e versão já fixados em
 * `@/lib/dados/demonstracao/fixtures.ts` (mesmos ids do `supabase/seed.sql`,
 * PRD 5.3), e acrescenta os campos que a fundação ainda não precisava
 * (limite semanal da região, aliases e confirmação da cidade, horas por
 * visita e conteúdo da versão) mais o que a fundação não tinha nenhuma
 * linha ainda (condição comercial, termo de alerta, faixa da régua).
 *
 * Nenhum dado real: nomes, termos e textos são fictícios ou vêm do PRD
 * (capítulos 10.3 e 23), nunca do onboarding real da Kraamzorg.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-9${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

// --- Regiões: acrescenta o limite semanal (PRD 6.1, comentário "5 SP, 3 Londrina") ---

const LIMITE_POR_REGIAO: Record<string, number> = {
  "São Paulo": 5,
  Londrina: 3,
  Futuro: 0,
};

export const REGIOES_SEED: RegiaoDetalhe[] = REGIOES.map((regiao) => ({
  ...regiao,
  limiteFamiliasSemana: LIMITE_POR_REGIAO[regiao.nome] ?? 0,
}));

// --- Cidades: mesmos ids e nomes do CIDADES da fundação, com os campos que faltam ---

export const CIDADES_SEED: Cidade[] = [
  {
    ...CIDADES.saoPaulo,
    atendida: true,
    requerConfirmacao: false,
    taxaDeslocamentoCentavos: 0,
    aliases: ["Sampa", "SP capital"],
    observacao: null,
  },
  {
    ...CIDADES.alphaville,
    atendida: true,
    requerConfirmacao: false,
    taxaDeslocamentoCentavos: 4000,
    aliases: ["Alphaville Barueri"],
    observacao: null,
  },
  {
    ...CIDADES.granjaViana,
    atendida: true,
    requerConfirmacao: false,
    taxaDeslocamentoCentavos: 4000,
    aliases: [],
    observacao: null,
  },
  {
    ...CIDADES.santoAndre,
    atendida: true,
    requerConfirmacao: true,
    taxaDeslocamentoCentavos: 6000,
    aliases: ["ABC"],
    observacao: "Confirmar disponibilidade com a coordenação antes da oferta.",
  },
  {
    ...CIDADES.saoBernardo,
    atendida: true,
    requerConfirmacao: true,
    taxaDeslocamentoCentavos: 6000,
    aliases: ["SBC", "ABC"],
    observacao: "Confirmar disponibilidade com a coordenação antes da oferta.",
  },
  {
    ...CIDADES.londrina,
    atendida: true,
    requerConfirmacao: false,
    taxaDeslocamentoCentavos: 0,
    aliases: [],
    observacao: null,
  },
];

// --- Pacotes: mesmos ids, com linha, página do PDF e ativo ---

const LINHA_POR_PACOTE = "Acompanhamento diário";
const PAGINA_PDF_PACOTE: Record<string, number> = {
  Essencial: 11,
  Imersão: 11,
  Continuado: 11,
  "Gemelar Essencial": 12,
  "Gemelar Continuado": 12,
};

export const PACOTES_SEED: Pacote[] = PACOTES.map((pacote) => ({
  id: pacote.pacoteId,
  nome: pacote.nome,
  linha: LINHA_POR_PACOTE,
  dias: pacote.dias,
  gemelar: pacote.gemelar,
  paginaPdf: PAGINA_PDF_PACOTE[pacote.nome] ?? null,
  ordem: pacote.ordem,
  ativo: true,
}));

// --- Versões: mesmos ids e valores, com horas por visita e conteúdo ---

const HORAS_POR_PACOTE: Record<string, number> = {
  Essencial: 4,
  Imersão: 6,
  Continuado: 4,
  "Gemelar Essencial": 6,
  "Gemelar Continuado": 6,
};

const INCLUI_PADRAO = [
  "Visitas com enfermeira especializada em pós-parto",
  "Acompanhamento da amamentação",
  "Orientação sobre os cuidados com o recém-nascido",
];
const NAO_INCLUI_PADRAO = [
  "Deslocamento fora da região atendida",
  "Procedimentos médicos",
];

export const VERSOES_PACOTE_SEED: VersaoPacote[] = VERSOES_PACOTE.map((v) => {
  const pacote = PACOTES.find((p) => p.pacoteId === v.pacoteId);
  return {
    id: v.versaoId,
    pacoteId: v.pacoteId,
    valorCentavos: v.valorCentavos,
    horasPorVisita: HORAS_POR_PACOTE[pacote?.nome ?? ""] ?? 4,
    parcelasMaxSemJuros: v.parcelasMaxSemJuros,
    destaque: pacote?.nome === "Continuado" ? "mais escolhido" : null,
    vigenciaInicio: v.vigenciaInicio,
    vigenciaFim: v.vigenciaFim,
    inclui: INCLUI_PADRAO,
    naoInclui: NAO_INCLUI_PADRAO,
  };
});

// --- Condições comerciais (PRD 6.3, "tabela única de condições") -------------

export const CONDICOES_COMERCIAIS_SEED: CondicaoComercial[] = [
  {
    id: id(1, 1),
    nome: "Pix à vista",
    tipo: "desconto_pct",
    valor: 5,
    requerAprovacao: false,
    ativa: true,
    observacao: null,
  },
  {
    id: id(1, 2),
    nome: "Cartão em até 3x sem juros",
    tipo: "parcelamento",
    valor: 3,
    requerAprovacao: false,
    ativa: true,
    observacao: null,
  },
  {
    id: id(1, 3),
    nome: "Indicação de família atendida",
    tipo: "bonificacao",
    valor: 5,
    requerAprovacao: true,
    ativa: true,
    observacao: "Só com a família indicada confirmada no CRM.",
  },
];

// --- Termos de alerta (coordenação clínica, PRD 13, onboarding 9.6) ----------
// Lista fictícia para a demonstração; a lista real vem do onboarding
// clínico (Edilaine) e entra pela tela, não pelo código.

export const TERMOS_ALERTA_SEED: TermoAlerta[] = [
  {
    id: id(2, 1),
    termo: "sangramento",
    acao: "handoff_saude",
    mensagemChave: "alerta_saude",
    ativo: true,
  },
  {
    id: id(2, 2),
    termo: "febre alta",
    acao: "handoff_saude",
    mensagemChave: "alerta_saude",
    ativo: true,
  },
  {
    id: id(2, 3),
    termo: "internação",
    acao: "bloqueio_total",
    mensagemChave: "alerta_saude",
    ativo: true,
  },
  {
    id: id(2, 4),
    termo: "não passou bem",
    acao: "handoff_saude",
    mensagemChave: "alerta_saude",
    ativo: false,
  },
];

// --- Faixas da régua (PRD 10.3) ------------------------------------------------

export const REGUA_FAIXAS_SEED: ReguaFaixaDetalhe[] = [
  {
    id: id(3, 1),
    ordem: 1,
    semanaMin: null,
    semanaMax: 20,
    objetivo: "Presença e conteúdo de valor, sem oferta",
    gatilhoComercial: "Nenhum",
    mensagemChave: "regua_ate_20",
  },
  {
    id: id(3, 2),
    ordem: 2,
    semanaMin: 21,
    semanaMax: 27,
    objetivo: "O que acontece nos primeiros dias em casa",
    gatilhoComercial: "Convite leve para conhecer a apresentação",
    mensagemChave: "regua_21_27",
  },
  {
    id: id(3, 3),
    ordem: 3,
    semanaMin: 28,
    semanaMax: 34,
    objetivo: "Janela ideal de reserva",
    gatilhoComercial:
      "Convite para a conversa com a Edilaine; disponibilidade só com dado real",
    mensagemChave: "regua_28_34",
  },
  {
    id: id(3, 4),
    ordem: 4,
    semanaMin: 35,
    semanaMax: null,
    objetivo: "Organização prática da chegada",
    gatilhoComercial: "Prioridade máxima na fila do comercial",
    mensagemChave: "regua_35_mais",
  },
  {
    id: id(3, 5),
    ordem: 5,
    semanaMin: null,
    semanaMax: null,
    objetivo: "Oferta adaptada, fluxo acelerado",
    gatilhoComercial: "Encaminhamento imediato ao humano",
    mensagemChave: "regua_nasceu",
  },
];

/**
 * As mensagens da régua (PRD 23.2) não estão na `MENSAGENS_MODELO` da
 * fundação (que só tem as usadas pelo P07 e pelo P15 parcial). O módulo
 * acrescenta as próprias aqui e grava na loja como as demais: rascunho até
 * a aprovação do Leonardo.
 */
export const MENSAGENS_REGUA_SEED: {
  chave: string;
  canal: "whatsapp";
  destinatario: "familia";
  texto: string;
  variaveis: string[];
  status: "rascunho" | "aprovado";
}[] = [
  {
    chave: "regua_ate_20",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}, aqui é da Kraamzorg Brasil 🤍 Como está a gestação? Quando quiser entender como funciona o cuidado nos primeiros dias em casa, é só me chamar por aqui.",
    variaveis: ["nome"],
    status: "aprovado",
  },
  {
    chave: "regua_21_27",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}! Com {semanas} semanas muita família começa a pensar em como vão ser os primeiros dias depois da alta. Se quiser, te mando a nossa apresentação para você conhecer o cuidado com calma.",
    variaveis: ["nome", "semanas"],
    status: "aprovado",
  },
  {
    chave: "regua_28_34",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}! Você está entrando na janela ideal para reservar o pós-parto, entre 28 e 36 semanas. Se fizer sentido, a Edilaine conversa com vocês uns 15 minutos, sem compromisso, e quem for estar com você nesses dias pode participar também. Me passa dois dias e horários que ficam bons para vocês?",
    variaveis: ["nome"],
    status: "rascunho",
  },
  {
    chave: "regua_35_mais",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}! A chegada do bebê está pertinho 🤍 Se vocês ainda estiverem pensando no cuidado para os primeiros dias em casa, me conta a DPP e a cidade que eu vejo agora com a equipe como fica para vocês.",
    variaveis: ["nome"],
    status: "rascunho",
  },
  {
    chave: "regua_nasceu",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Parabéns pela chegada do bebê! 👶 Como vocês estão, já em casa com o bebê? Vou ver com a equipe a possibilidade de começar o acompanhamento com vocês.",
    variaveis: [],
    status: "rascunho",
  },
];
