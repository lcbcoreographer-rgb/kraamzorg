import type { Papel } from "@/lib/auth/papeis";
import type { Json } from "@/lib/db/types";
import type {
  ClassificacaoContato,
  ClassificacaoLead,
  DestinoHandoff,
  DirecaoMensagem,
  EnviadoPor,
  EstadoSensivel,
  EstagioP1,
  EstagioP2,
  MensagemModelo,
  MotivoHandoff,
  MotivoPerda,
  PapelPessoa,
  Prioridade,
  StatusHandoff,
  StatusTarefa,
  TipoTarefa,
} from "../tipos";
import parametrosSeed from "./parametros.json";

/**
 * Dados fictícios do modo demonstração, coerentes com supabase/seed.sql
 * (P08): as mesmas doze famílias "Família Teste ...", as mesmas pessoas e
 * telefones da faixa +55 11 90000-0xxx, os mesmos estágios, pacotes e
 * parâmetros. Os ids são fixos aqui (no seed nascem de gen_random_uuid()).
 * Transferências e tarefas não existem no seed; as daqui são inventadas,
 * sempre sobre famílias do seed, para as telas terem o que mostrar.
 *
 * Nenhum nome, telefone ou texto real. Texto para a família só nas
 * mensagens copiadas do seed (mensagem_modelo), nunca escrito à parte.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

// --- Pessoas da equipe (perfis de teste do seed, P07 item 8) --------------

export interface UsuarioDemonstracao {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  ativo: boolean;
  /** Já tem o MFA cadastrado: entra pelo desafio, não pelo cadastro. */
  mfaCadastrado: boolean;
}

export const USUARIOS: UsuarioDemonstracao[] = [
  {
    id: id(1, 1),
    nome: "Perfil Teste Comercial",
    email: "comercial.teste@kraamzorgbrasil.test",
    papeis: ["comercial"],
    ativo: true,
    mfaCadastrado: false,
  },
  {
    id: id(1, 2),
    nome: "Perfil Teste Coordenacao",
    email: "coordenacao.teste@kraamzorgbrasil.test",
    papeis: ["coordenacao"],
    ativo: true,
    mfaCadastrado: true,
  },
  {
    id: id(1, 3),
    nome: "Perfil Teste Diretoria",
    email: "diretoria.teste@kraamzorgbrasil.test",
    papeis: ["diretoria"],
    ativo: true,
    mfaCadastrado: true,
  },
  {
    id: id(1, 4),
    nome: "Perfil Teste Financeiro",
    email: "financeiro.teste@kraamzorgbrasil.test",
    papeis: ["financeiro"],
    ativo: true,
    mfaCadastrado: false,
  },
  {
    id: id(1, 5),
    nome: "Perfil Teste Marketing",
    email: "marketing.teste@kraamzorgbrasil.test",
    papeis: ["marketing"],
    ativo: true,
    mfaCadastrado: false,
  },
  {
    id: id(1, 6),
    nome: "Perfil Teste Enfermeira",
    email: "enfermeira.teste@kraamzorgbrasil.test",
    papeis: ["enfermeira"],
    ativo: true,
    mfaCadastrado: true,
  },
];

export const ID_COMERCIAL = id(1, 1);

// --- Configuração ----------------------------------------------------------

export const REGIOES = [
  {
    id: id(2, 1),
    nome: "São Paulo",
    praca: "São Paulo",
    taxaDeslocamentoCentavos: 0,
    ativa: true,
  },
  {
    id: id(2, 2),
    nome: "Londrina",
    praca: "Londrina",
    taxaDeslocamentoCentavos: 0,
    ativa: true,
  },
  {
    id: id(2, 3),
    nome: "Futuro",
    praca: "Futuro (Campinas e Sorocaba, sem data, PRD 3.3)",
    taxaDeslocamentoCentavos: 0,
    ativa: false,
  },
];

const SP = id(2, 1);
const LONDRINA = id(2, 2);

export const CIDADES = {
  saoPaulo: { id: id(3, 1), nome: "São Paulo", uf: "SP", regiaoId: SP },
  alphaville: { id: id(3, 2), nome: "Alphaville", uf: "SP", regiaoId: SP },
  granjaViana: { id: id(3, 3), nome: "Granja Viana", uf: "SP", regiaoId: SP },
  santoAndre: { id: id(3, 4), nome: "Santo André", uf: "SP", regiaoId: SP },
  saoBernardo: {
    id: id(3, 5),
    nome: "São Bernardo do Campo",
    uf: "SP",
    regiaoId: SP,
  },
  londrina: { id: id(3, 6), nome: "Londrina", uf: "PR", regiaoId: LONDRINA },
} as const;

export const PACOTES = [
  { pacoteId: id(4, 1), nome: "Essencial", dias: 6, gemelar: false, ordem: 1 },
  { pacoteId: id(4, 2), nome: "Imersão", dias: 6, gemelar: false, ordem: 2 },
  {
    pacoteId: id(4, 3),
    nome: "Continuado",
    dias: 12,
    gemelar: false,
    ordem: 3,
  },
  {
    pacoteId: id(4, 4),
    nome: "Gemelar Essencial",
    dias: 6,
    gemelar: true,
    ordem: 4,
  },
  {
    pacoteId: id(4, 5),
    nome: "Gemelar Continuado",
    dias: 12,
    gemelar: true,
    ordem: 5,
  },
];

/** Versões de preço como no seed: a vigente desde 01/03/2026 e uma anterior fictícia. */
export const VERSOES_PACOTE = PACOTES.flatMap((pacote, i) => [
  {
    versaoId: id(5, i * 2 + 1),
    pacoteId: pacote.pacoteId,
    valorCentavos: 111100,
    parcelasMaxSemJuros: 2,
    vigenciaInicio: "2025-01-01",
    vigenciaFim: "2026-02-28" as string | null,
  },
  {
    versaoId: id(5, i * 2 + 2),
    pacoteId: pacote.pacoteId,
    valorCentavos: [420000, 780000, 810000, 540000, 1030000][i] ?? 0,
    parcelasMaxSemJuros: 3,
    vigenciaInicio: "2026-03-01",
    vigenciaFim: null as string | null,
  },
]);

export const PARAMETROS = parametrosSeed as {
  chave: string;
  valor: Json;
  descricao: string | null;
}[];

/** Copiadas do seed (mensagem_modelo), com o status de lá. */
export const MENSAGENS_MODELO: Omit<MensagemModelo, "aprovadoEm">[] = [
  {
    chave: "alerta_saude",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "{nome}, pelo que você está me contando, isso precisa ser avaliado por um profissional de saúde agora. Entre em contato com seu médico ou pediatra, ou procure um serviço de urgência. Se for uma emergência, ligue para o SAMU pelo 192. Estou avisando a nossa equipe.",
    variaveis: ["nome"],
    status: "aprovado",
  },
  {
    chave: "followup_d3",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}! Se ajudar na decisão, a Edilaine pode conversar com vocês uns 15 minutos e mostrar como o cuidado funciona na rotina de vocês. Me passa dois dias e horários bons que eu vejo com ela?",
    variaveis: ["nome"],
    status: "rascunho",
  },
  {
    chave: "formulario_contrato",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}, aqui é o Leonardo. Que bom ter vocês com a gente! Para eu preparar o contrato, preenche os dados neste formulário seguro, leva uns 3 minutos: {link}. Depois disso o contrato chega por e-mail pela Autentique, a plataforma de assinatura, e pode abrir com tranquilidade.",
    variaveis: ["nome", "link"],
    status: "rascunho",
  },
  {
    chave: "lembrete_sessao",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Oi, {nome}! Amanhã, às {hora}, é a sua conversa com a Edilaine 😊 O acesso é este: {link}. Se precisar mudar o horário, é só me avisar por aqui.",
    variaveis: ["nome", "hora", "link"],
    status: "rascunho",
  },
  {
    chave: "perda",
    canal: "whatsapp",
    destinatario: "familia",
    texto:
      "Sinto muito, de coração. Se em algum momento precisar da gente, estamos aqui.",
    variaveis: [],
    status: "aprovado",
  },
];

// --- Famílias, pessoas e oportunidades (seed, seção 9) --------------------

export interface FamiliaDemonstracao {
  id: string;
  nome: string;
  bairro: string;
  cidade: (typeof CIDADES)[keyof typeof CIDADES];
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  gemelar: boolean;
  primeiraGestacao: boolean | null;
  estadoSensivel: EstadoSensivel;
  estadoSensivelEm: string | null;
  naoContatar: boolean;
}

export interface OportunidadeDemonstracao {
  id: string;
  familiaId: string;
  pipeline: 1 | 2;
  estagioP1: EstagioP1 | null;
  estagioP2: EstagioP2 | null;
  score: number;
  classificacao: ClassificacaoLead;
  pdfEnviadoEm: string | null;
  cadenciaEtapa: number;
  motivoPerda: MotivoPerda | null;
  responsavelId: string | null;
  proximoContatoEm: string | null;
}

type LinhaFamilia = [
  nome: string,
  bairro: string,
  cidade: keyof typeof CIDADES,
  dpp: string | null,
  nascimento: string | null,
  alta: string | null,
  inicio: string | null,
  gemelar: boolean,
  primeira: boolean,
  estado: EstadoSensivel,
  pipeline: 1 | 2,
  p1: EstagioP1,
  p2: EstagioP2 | null,
  score: number,
  classificacao: ClassificacaoLead,
  pdf: string | null,
];

const LINHAS_FAMILIAS: LinhaFamilia[] = [
  [
    "Família Teste Aurora",
    "Pinheiros",
    "saoPaulo",
    "2027-05-03",
    null,
    null,
    null,
    false,
    true,
    "normal",
    1,
    "novo",
    null,
    40,
    "morno",
    null,
  ],
  [
    "Família Teste Bruma",
    "Vila Mariana",
    "saoPaulo",
    null,
    null,
    null,
    null,
    false,
    false,
    "bloqueio_total",
    1,
    "em_conversa_ia",
    null,
    27,
    "frio",
    null,
  ],
  [
    "Família Teste Cedro",
    "Alphaville",
    "alphaville",
    "2027-02-12",
    null,
    null,
    null,
    false,
    true,
    "normal",
    1,
    "qualificado",
    null,
    62,
    "morno",
    "2026-09-24T04:15:05Z",
  ],
  [
    "Família Teste Dália",
    "Moema",
    "saoPaulo",
    "2027-01-23",
    null,
    null,
    null,
    false,
    false,
    "normal",
    1,
    "sessao_venda_agendada",
    null,
    62,
    "morno",
    "2026-09-22T04:15:05Z",
  ],
  [
    "Família Teste Estrela",
    "Gleba Palhano",
    "londrina",
    "2027-04-13",
    null,
    null,
    null,
    false,
    true,
    "atencao",
    1,
    "nutricao",
    null,
    40,
    "morno",
    null,
  ],
  [
    "Família Teste Flor",
    "Centro",
    "santoAndre",
    "2026-12-24",
    null,
    null,
    null,
    false,
    false,
    "normal",
    1,
    "perdido",
    null,
    30,
    "frio",
    "2026-09-15T04:15:05Z",
  ],
  [
    "Família Teste Gruta",
    "Granja Viana",
    "granjaViana",
    "2026-12-14",
    null,
    null,
    null,
    false,
    true,
    "normal",
    2,
    "qualificado",
    "proposta_enviada",
    65,
    "morno",
    "2026-09-23T04:15:05Z",
  ],
  [
    "Família Teste Horizonte",
    "Itaim Bibi",
    "saoPaulo",
    "2026-11-24",
    null,
    null,
    null,
    false,
    false,
    "normal",
    2,
    "qualificado",
    "assinado",
    65,
    "morno",
    "2026-09-19T04:15:05Z",
  ],
  [
    "Família Teste Íris",
    "Jardim do Mar",
    "saoBernardo",
    "2026-11-19",
    null,
    null,
    null,
    false,
    true,
    "normal",
    2,
    "qualificado",
    "pagamento_confirmado",
    52,
    "morno",
    "2026-09-16T04:15:05Z",
  ],
  [
    "Família Teste Jade",
    "Perdizes",
    "saoPaulo",
    "2026-08-11",
    "2026-08-16",
    "2026-08-18",
    "2026-08-18",
    false,
    true,
    "normal",
    2,
    "qualificado",
    "atendimento_liberado",
    74,
    "quente",
    "2026-08-01T04:15:05Z",
  ],
  [
    "Família Teste Lua",
    "Centro",
    "londrina",
    "2026-09-15",
    "2026-09-17",
    "2026-09-19",
    "2026-09-19",
    true,
    false,
    "normal",
    2,
    "qualificado",
    "atendimento_liberado",
    74,
    "quente",
    "2026-09-05T04:15:05Z",
  ],
  [
    "Família Teste Maré",
    "Santana",
    "saoPaulo",
    "2026-07-17",
    "2026-07-17",
    "2026-07-19",
    "2026-07-19",
    false,
    false,
    "normal",
    2,
    "qualificado",
    "atendimento_liberado",
    74,
    "quente",
    "2026-07-02T04:15:05Z",
  ],
];

export const FAMILIAS: FamiliaDemonstracao[] = LINHAS_FAMILIAS.map((l, i) => ({
  id: id(6, i + 1),
  nome: l[0],
  bairro: l[1],
  cidade: CIDADES[l[2]],
  dpp: l[3],
  dataNascimento: l[4],
  dataAlta: l[5],
  dataInicioEfetivo: l[6],
  gemelar: l[7],
  primeiraGestacao: l[8],
  estadoSensivel: l[9],
  estadoSensivelEm: l[9] === "normal" ? null : "2026-09-23T04:15:05Z",
  naoContatar: false,
}));

export const OPORTUNIDADES: OportunidadeDemonstracao[] = LINHAS_FAMILIAS.map(
  (l, i) => ({
    id: id(7, i + 1),
    familiaId: id(6, i + 1),
    pipeline: l[10],
    estagioP1: l[11],
    estagioP2: l[12],
    score: l[13],
    classificacao: l[14],
    pdfEnviadoEm: l[15],
    cadenciaEtapa: l[0].endsWith("Estrela") ? 1 : l[0].endsWith("Flor") ? 2 : 0,
    motivoPerda: l[0].endsWith("Flor") ? "preco" : null,
    responsavelId: ID_COMERCIAL,
    proximoContatoEm: null,
  }),
);

export const familiaPorNome = (sufixo: string) => {
  const familia = FAMILIAS.find((f) => f.nome.endsWith(sufixo));
  if (!familia)
    throw new Error(`família de demonstração inexistente: ${sufixo}`);
  return familia;
};

export interface PessoaDemonstracao {
  id: string;
  familiaId: string;
  papel: PapelPessoa;
  nome: string;
  telefoneE164: string;
  email: string | null;
  contatoPrincipal: boolean;
}

const LINHAS_PESSOAS: [
  familia: string,
  papel: PapelPessoa,
  nome: string,
  telefone: string,
  principal: boolean,
][] = [
  ["Aurora", "mae", "Marina Teste Aurora", "+5511900000301", true],
  ["Bruma", "mae", "Camila Teste Bruma", "+5511900000302", true],
  ["Cedro", "mae", "Beatriz Teste Cedro", "+5511900000303", true],
  ["Cedro", "parceiro", "Rafael Teste Cedro", "+5511900000304", false],
  ["Dália", "mae", "Fernanda Teste Dália", "+5511900000305", true],
  ["Estrela", "mae", "Patrícia Teste Estrela", "+5511900000306", true],
  ["Flor", "mae", "Aline Teste Flor", "+5511900000307", true],
  ["Gruta", "mae", "Juliana Teste Gruta", "+5511900000308", true],
  ["Gruta", "parceiro", "Diego Teste Gruta", "+5511900000309", false],
  ["Horizonte", "mae", "Vanessa Teste Horizonte", "+5511900000310", true],
  ["Horizonte", "parceiro", "Bruno Teste Horizonte", "+5511900000311", false],
  ["Íris", "mae", "Renata Teste Íris", "+5511900000312", true],
  ["Jade", "mae", "Camila Teste Jade", "+5511900000313", true],
  ["Jade", "parceiro", "Eduardo Teste Jade", "+5511900000314", false],
  ["Lua", "mae", "Larissa Teste Lua", "+5511900000315", true],
  ["Lua", "parceiro", "Gustavo Teste Lua", "+5511900000316", false],
  ["Maré", "mae", "Isabela Teste Maré", "+5511900000317", true],
];

export const PESSOAS: PessoaDemonstracao[] = LINHAS_PESSOAS.map((l, i) => ({
  id: id(8, i + 1),
  familiaId: familiaPorNome(l[0]).id,
  papel: l[1],
  nome: l[2],
  telefoneE164: l[3],
  email: null,
  contatoPrincipal: l[4],
}));

// --- Conversas, mensagens, transferências e tarefas -----------------------

export interface ConversaDemonstracao {
  id: string;
  familiaId: string | null;
  nomeWhatsapp: string;
  telefoneE164: string;
  classificacao: ClassificacaoContato;
  /** Minutos a partir de agora até a pausa vencer; null sem pausa. */
  pausaMinutos: number | null;
  encerradoMotivo: string | null;
}

export const CONVERSAS: ConversaDemonstracao[] = [
  {
    id: id(9, 1),
    familiaId: familiaPorNome("Aurora").id,
    nomeWhatsapp: "Marina",
    telefoneE164: "+5511900000301",
    classificacao: "lead",
    pausaMinutos: null,
    encerradoMotivo: null,
  },
  {
    id: id(9, 2),
    familiaId: familiaPorNome("Íris").id,
    nomeWhatsapp: "Renata",
    telefoneE164: "+5511900000312",
    classificacao: "cliente",
    pausaMinutos: null,
    encerradoMotivo: null,
  },
  {
    id: id(9, 3),
    familiaId: familiaPorNome("Bruma").id,
    nomeWhatsapp: "Camila",
    telefoneE164: "+5511900000302",
    classificacao: "lead",
    pausaMinutos: null,
    encerradoMotivo: null,
  },
  {
    id: id(9, 4),
    familiaId: null,
    nomeWhatsapp: "Sônia",
    telefoneE164: "+5511900000501",
    classificacao: "candidata",
    pausaMinutos: null,
    encerradoMotivo: null,
  },
  {
    id: id(9, 5),
    familiaId: familiaPorNome("Cedro").id,
    nomeWhatsapp: "Beatriz",
    telefoneE164: "+5511900000303",
    classificacao: "lead",
    pausaMinutos: 20 * 60,
    encerradoMotivo: null,
  },
  {
    id: id(9, 6),
    familiaId: null,
    nomeWhatsapp: "Equipe",
    telefoneE164: "+5511900000050",
    classificacao: "nao_classificado",
    pausaMinutos: null,
    encerradoMotivo: null,
  },
  {
    id: id(9, 7),
    familiaId: familiaPorNome("Horizonte").id,
    nomeWhatsapp: "Vanessa",
    telefoneE164: "+5511900000310",
    classificacao: "lead",
    pausaMinutos: null,
    encerradoMotivo: "contratar",
  },
];

export interface MensagemDemonstracao {
  conversaId: string;
  direcao: DirecaoMensagem;
  enviadoPor: EnviadoPor;
  conteudo: string;
  /** Minutos antes de agora. */
  haMinutos: number;
}

/** As treze mensagens fictícias do seed (seção 10). */
export const MENSAGENS: MensagemDemonstracao[] = [
  {
    conversaId: id(9, 5),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo: "Vocês fazem algum desconto para pagamento à vista?",
    haMinutos: 26 * 60,
  },
  {
    conversaId: id(9, 5),
    direcao: "saida",
    enviadoPor: "sistema",
    conteudo:
      "Essa informação eu vou confirmar com a equipe para te responder certinho, tá?",
    haMinutos: 26 * 60 - 2,
  },
  {
    conversaId: id(9, 6),
    direcao: "saida",
    enviadoPor: "humano",
    conteudo: "Confirmado, já anotei aqui.",
    haMinutos: 180,
  },
  {
    conversaId: id(9, 4),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo:
      "Boa tarde, vi a vaga de enfermeira obstétrica, como faço para me candidatar?",
    haMinutos: 300,
  },
  {
    conversaId: id(9, 4),
    direcao: "saida",
    enviadoPor: "sistema",
    conteudo:
      "Que bom saber do seu interesse em fazer parte da equipe 🤍 As candidaturas chegam pelo e-mail contato@kraamzorgbrasil.com",
    haMinutos: 297,
  },
  {
    conversaId: id(9, 7),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo: "Fechado, pode preparar o contrato",
    haMinutos: 5 * 24 * 60,
  },
  {
    conversaId: id(9, 7),
    direcao: "saida",
    enviadoPor: "humano",
    conteudo:
      "Que alegria, Vanessa! Vou te mandar o formulário seguro para os dados do contrato.",
    haMinutos: 5 * 24 * 60 - 6,
  },
  {
    conversaId: id(9, 2),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo: "Oi! A enfermeira vem amanhã de manhã mesmo?",
    haMinutos: 26 * 60,
  },
  {
    conversaId: id(9, 2),
    direcao: "saida",
    enviadoPor: "ia",
    conteudo:
      "Isso mesmo, Renata! Amanhã de manhã, no mesmo horário combinado. Qualquer coisa me avisa por aqui.",
    haMinutos: 26 * 60 - 5,
  },
  {
    conversaId: id(9, 1),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo: "Oi, gostaria de saber mais sobre o acompanhamento de vocês",
    haMinutos: 60,
  },
  {
    conversaId: id(9, 1),
    direcao: "saida",
    enviadoPor: "ia",
    conteudo:
      "Oi, Marina! Que alegria saber que você está esperando bebê 🤍 Me conta, de quantas semanas você está?",
    haMinutos: 58,
  },
  {
    conversaId: id(9, 3),
    direcao: "entrada",
    enviadoPor: "cliente",
    conteudo: "Infelizmente perdi o bebê essa semana",
    haMinutos: 2 * 24 * 60,
  },
  {
    conversaId: id(9, 3),
    direcao: "saida",
    enviadoPor: "sistema",
    conteudo:
      "Sinto muito, de coração. Se em algum momento precisar da gente, estamos aqui.",
    haMinutos: 2 * 24 * 60 - 1,
  },
];

export interface TransferenciaDemonstracao {
  id: string;
  conversaId: string;
  familiaId: string;
  motivo: MotivoHandoff;
  destino: DestinoHandoff;
  prioridade: Prioridade;
  resumo: string;
  status: StatusHandoff;
  /** Minutos a partir de agora até o prazo vencer (negativo: já venceu). */
  slaMinutos: number;
  assumidoPorComercial: boolean;
}

export const TRANSFERENCIAS: TransferenciaDemonstracao[] = [
  {
    id: id(10, 1),
    conversaId: id(9, 3),
    familiaId: familiaPorNome("Bruma").id,
    motivo: "perda",
    destino: "coordenacao_clinica",
    prioridade: "maxima",
    resumo:
      "Relato de perda gestacional. Freio em bloqueio total. Contato humano e nominal.",
    status: "aberto",
    slaMinutos: -30,
    assumidoPorComercial: false,
  },
  {
    id: id(10, 2),
    conversaId: id(9, 5),
    familiaId: familiaPorNome("Cedro").id,
    motivo: "condicao_comercial",
    destino: "comercial",
    prioridade: "normal",
    resumo: "Pergunta sobre desconto no pagamento à vista. PDF enviado.",
    status: "aberto",
    slaMinutos: 190,
    assumidoPorComercial: false,
  },
  {
    id: id(10, 3),
    conversaId: id(9, 7),
    familiaId: familiaPorNome("Horizonte").id,
    motivo: "contratar",
    destino: "comercial",
    prioridade: "alta",
    resumo: "Quer contratar. Formulário seguro enviado.",
    status: "assumido",
    slaMinutos: 38,
    assumidoPorComercial: true,
  },
];

export interface TarefaDemonstracao {
  id: string;
  tipo: TipoTarefa;
  titulo: string;
  prioridade: Prioridade;
  status: StatusTarefa;
  /** Minutos a partir de agora até vencer. */
  venceMinutos: number | null;
  familiaId: string | null;
  responsavelId: string | null;
  papelResponsavel: Papel | null;
}

export const TAREFAS: TarefaDemonstracao[] = [
  {
    id: id(11, 1),
    tipo: "outro",
    titulo: "Justificar o freio da Família Teste Bruma",
    prioridade: "alta",
    status: "aberta",
    venceMinutos: 240,
    familiaId: familiaPorNome("Bruma").id,
    responsavelId: ID_COMERCIAL,
    papelResponsavel: null,
  },
  {
    id: id(11, 2),
    tipo: "followup_comercial",
    titulo: "Retomar a conversa com a Família Teste Cedro",
    prioridade: "normal",
    status: "aberta",
    venceMinutos: 300,
    familiaId: familiaPorNome("Cedro").id,
    responsavelId: null,
    papelResponsavel: "comercial",
  },
  {
    id: id(11, 3),
    tipo: "enviar_formulario_contrato",
    titulo: "Conferir o formulário do contrato da Família Teste Horizonte",
    prioridade: "alta",
    status: "aberta",
    venceMinutos: 60,
    familiaId: familiaPorNome("Horizonte").id,
    responsavelId: ID_COMERCIAL,
    papelResponsavel: null,
  },
  {
    id: id(11, 4),
    tipo: "agendar_prenatal",
    titulo: "Agendar a consulta pré-natal da Família Teste Íris",
    prioridade: "alta",
    status: "aberta",
    venceMinutos: 24 * 60,
    familiaId: familiaPorNome("Íris").id,
    responsavelId: null,
    papelResponsavel: "coordenacao",
  },
];

export interface EventoDemonstracao {
  familiaId: string;
  tipo: string;
  titulo: string;
  restrito: boolean;
  haMinutos: number;
}

export const EVENTOS: EventoDemonstracao[] = [
  {
    familiaId: familiaPorNome("Aurora").id,
    tipo: "entrada",
    titulo: "Primeiro contato pelo WhatsApp",
    restrito: false,
    haMinutos: 60,
  },
  {
    familiaId: familiaPorNome("Cedro").id,
    tipo: "estagio",
    titulo: "Qualificada pela Isadora",
    restrito: false,
    haMinutos: 3 * 24 * 60,
  },
  {
    familiaId: familiaPorNome("Cedro").id,
    tipo: "marco",
    titulo: "Apresentação enviada",
    restrito: false,
    haMinutos: 26 * 60,
  },
  {
    familiaId: familiaPorNome("Bruma").id,
    tipo: "freio",
    titulo: "Freio em bloqueio total",
    restrito: true,
    haMinutos: 2 * 24 * 60,
  },
  {
    familiaId: familiaPorNome("Horizonte").id,
    tipo: "estagio",
    titulo: "Contrato assinado",
    restrito: false,
    haMinutos: 3 * 24 * 60,
  },
];

/** Transições permitidas de P1 e P2, copiadas de privado.transicao_permitida. */
export { default as TRANSICOES } from "./transicoes.json";
