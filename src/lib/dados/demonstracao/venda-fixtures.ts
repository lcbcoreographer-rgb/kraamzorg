import type { Json } from "@/lib/db/types";
import { CIDADES, familiaPorNome, USUARIOS } from "./fixtures";

/**
 * Dados fictícios da venda no modo demonstração (P29 e P30), coerentes com
 * supabase/seed.sql: textos e parâmetros copiados de lá (o teste
 * venda.test.ts confere que continuam iguais), taxas das cidades, detalhes
 * dos pacotes e as duas condições comerciais. Nenhum nome, telefone ou
 * texto real.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

export const ID_COORDENACAO =
  USUARIOS.find((u) => u.papeis.includes("coordenacao"))?.id ?? id(1, 2);

/** Linha e horas por visita de cada pacote (seed, seção 2; PRD 3.2). */
export const DETALHES_PACOTE: Record<string, { linha: string; horas: number }> =
  {
    Essencial: { linha: "Acompanhamento diário", horas: 3 },
    Imersão: { linha: "Presença estendida", horas: 6 },
    Continuado: { linha: "Cuidado prolongado", horas: 3 },
    "Gemelar Essencial": { linha: "Primeira semana", horas: 4 },
    "Gemelar Continuado": { linha: "Duas semanas", horas: 4 },
  };

/** Taxa de deslocamento e confirmação de cada cidade (seed, seção 1; PRD 3.3). */
export const TAXAS_CIDADE: Record<
  string,
  { taxaCentavos: number; requerConfirmacao: boolean; atendida: boolean }
> = {
  [CIDADES.saoPaulo.id]: {
    taxaCentavos: 0,
    requerConfirmacao: false,
    atendida: true,
  },
  [CIDADES.alphaville.id]: {
    taxaCentavos: 0,
    requerConfirmacao: false,
    atendida: true,
  },
  [CIDADES.granjaViana.id]: {
    taxaCentavos: 35000,
    requerConfirmacao: false,
    atendida: true,
  },
  [CIDADES.santoAndre.id]: {
    taxaCentavos: 35000,
    requerConfirmacao: true,
    atendida: true,
  },
  [CIDADES.saoBernardo.id]: {
    taxaCentavos: 35000,
    requerConfirmacao: true,
    atendida: true,
  },
  [CIDADES.londrina.id]: {
    taxaCentavos: 0,
    requerConfirmacao: false,
    atendida: true,
  },
};

/** As duas condições do seed (PRD 22.2 C-04 e C-05). */
export const CONDICOES = [
  {
    id: id(12, 1),
    nome: "3x sem juros no cartão",
    tipo: "parcelamento" as const,
    valor: 3,
    requerAprovacao: false,
  },
  {
    id: id(12, 2),
    nome: "Pix à vista",
    tipo: "desconto_pct" as const,
    valor: 5,
    requerAprovacao: true,
  },
];

/** Parâmetros novos do 0018, com os valores do seed. */
export const PARAMETROS_VENDA: Record<string, Json> = {
  sessao_venda_retorno_horas: 48,
  sessao_gravacao: {
    termo_versao: "1-rascunho",
    transcricao_max_caracteres: 200000,
  },
  formulario_contrato: {
    validade_horas: 72,
    duracao_minutos: 3,
    tentativas_max: 10,
    tentativas_janela_minutos: 15,
  },
  termo_lgpd_contrato_versao: "1-rascunho",
  contrato_template_versao: "C-11 provisório",
};

/**
 * Textos de mensagem_modelo que a venda usa, copiados do seed (rascunho).
 * canal site: o formulário público (privado.formulario_textos lê só estes).
 */
export const MENSAGENS_VENDA: {
  chave: string;
  canal: "whatsapp" | "site" | "outro";
  texto: string;
}[] = [
  {
    chave: "lembrete_sessao",
    canal: "whatsapp",
    texto:
      "Oi, {nome}! Amanhã, às {hora}, é a sua reunião com a Edilaine 😊 O link é este: {link}. Se precisar mudar o horário, é só me avisar por aqui.",
  },
  {
    chave: "nao_compareceu",
    canal: "whatsapp",
    texto:
      "Imagino que tenha surgido algum imprevisto, acontece. Quer que eu veja um novo horário com a Edilaine?",
  },
  {
    chave: "pos_sessao_48h",
    canal: "whatsapp",
    texto:
      "Oi, {nome}! Que bom que vocês conversaram com a Edilaine. Ficou alguma dúvida?",
  },
  {
    chave: "formulario_contrato",
    canal: "whatsapp",
    texto:
      "Oi, {nome}, aqui é o Leonardo. Que bom ter vocês com a gente! Para eu preparar o contrato, preenche os dados neste formulário seguro, leva uns 3 minutos: {link}. Depois disso o contrato chega por e-mail pela Autentique, a plataforma de assinatura, e pode abrir com tranquilidade.",
  },
  {
    chave: "formulario_abertura",
    canal: "site",
    texto:
      "Oi, {nome}. {quem_pediu} pediu estes dados para preparar o contrato de vocês. Leva uns {minutos} minutos.",
  },
  {
    chave: "formulario_abertura_apoio",
    canal: "site",
    texto:
      "Se precisar parar no meio, o que você já preencheu continua aqui enquanto esta página estiver aberta.",
  },
  {
    chave: "formulario_ajuda_cpf",
    canal: "site",
    texto:
      "Vai no contrato. Fica guardado com a equipe da Kraamzorg e não aparece em nenhuma mensagem.",
  },
  {
    chave: "formulario_ajuda_email",
    canal: "site",
    texto: "O contrato chega neste e-mail, pela Autentique, para você assinar.",
  },
  {
    chave: "formulario_ajuda_endereco",
    canal: "site",
    texto: "O endereço de casa vai no contrato.",
  },
  {
    chave: "formulario_pergunta_atendimento",
    canal: "site",
    texto: "A enfermeira vai visitar vocês neste mesmo endereço?",
  },
  {
    chave: "formulario_ajuda_atendimento",
    canal: "site",
    texto:
      "Tem família que passa os primeiros dias na casa dos avós, por exemplo. Coloque o endereço onde vocês vão estar depois da alta.",
  },
  {
    chave: "formulario_ajuda_pagador",
    canal: "site",
    texto:
      "Como o acompanhamento é um presente, os dados de pagamento são de {pagador}. O contrato continua no seu nome.",
  },
  {
    chave: "formulario_ajuda_testemunha",
    canal: "site",
    texto:
      "Quem vai estar com você nesses dias pode assinar o contrato como testemunha. Se preferir, deixe em branco.",
  },
  {
    chave: "formulario_consentimento",
    canal: "site",
    texto:
      "Autorizo a Kraamzorg Brasil a usar estes dados para preparar e cumprir o contrato do acompanhamento pós-parto. Sei que posso pedir para ver ou corrigir meus dados quando quiser.",
  },
  {
    chave: "formulario_privacidade",
    canal: "site",
    texto:
      "Os dados vão direto para a equipe da Kraamzorg, por uma conexão protegida, e só são usados para o contrato.",
  },
  {
    chave: "formulario_corrigir",
    canal: "site",
    texto:
      "Alguns dados precisam de um ajuste. Os campos estão marcados logo abaixo, com o que falta.",
  },
  {
    chave: "formulario_sem_conexao",
    canal: "site",
    texto:
      "A conexão caiu. O que você já preencheu continua aqui; quando voltar, toque em Enviar de novo.",
  },
  {
    chave: "formulario_erro_envio",
    canal: "site",
    texto:
      "Não conseguimos receber agora. O que você preencheu continua aqui. Tente enviar de novo daqui a pouco.",
  },
  {
    chave: "formulario_fim",
    canal: "site",
    texto:
      "Recebemos, {nome}. Assim que o contrato estiver pronto, ele chega no seu e-mail pela Autentique, a plataforma de assinatura, e é só abrir e assinar por lá. Se surgir qualquer dúvida, fale com a gente pelo WhatsApp.",
  },
  {
    chave: "formulario_link_invalido",
    canal: "site",
    texto:
      "Este link já foi usado ou venceu. Para receber um novo, é só pedir pelo WhatsApp da Kraamzorg.",
  },
  {
    chave: "formulario_limite",
    canal: "site",
    texto:
      "Foram muitas tentativas seguidas por aqui. Espere uns {minutos} minutos e abra o link de novo.",
  },
  {
    chave: "sessao_termo_gravacao",
    canal: "outro",
    texto:
      "Posso gravar esta conversa? A gravação serve só para a nossa equipe lembrar o que vocês contaram e preparar o cuidado. Ela fica guardada com a Kraamzorg, e vocês podem pedir para apagar quando quiserem.",
  },
];

/** Transferência "reuniao" da demonstração (Família Teste Cedro, qualificada). */
export const ID_TRANSFERENCIA_REUNIAO = id(10, 4);
export const OPCOES_TRANSFERENCIA: Record<string, string[]> = {
  [ID_TRANSFERENCIA_REUNIAO]: ["quinta à noite", "sábado de manhã"],
};

/**
 * Sessões iniciais, como no seed: Dália com a conversa marcada daqui a
 * três dias; Gruta, já na proposta, com a conversa realizada há cinco dias
 * e a transcrição consentida (texto fictício), conduzida pela coordenação.
 */
export function sessoesIniciais(agora: number) {
  const dia = 24 * 60 * 60 * 1000;
  const hora = 60 * 60 * 1000;
  return [
    {
      id: id(13, 1),
      familiaId: familiaPorNome("Dália").id,
      agendadaPara: new Date(agora + 3 * dia).toISOString(),
      status: "agendada" as const,
      realizadaEm: null as string | null,
      linkReuniao: "https://meet.exemplo.invalid/teste-dalia",
      opcoesInformadas: "Terça às 10h ou quinta às 15h",
      parceiroPresente: null as boolean | null,
      conduzidaPor: ID_COORDENACAO,
      criadoEm: new Date(agora - 2 * dia).toISOString(),
      agendadaPor: "humano" as const,
      lembreteEnviadoEm: null as string | null,
      resultado: null as string | null,
    },
    {
      id: id(13, 2),
      familiaId: familiaPorNome("Gruta").id,
      agendadaPara: new Date(agora - 5 * dia).toISOString(),
      status: "realizada" as const,
      realizadaEm: new Date(agora - 5 * dia).toISOString(),
      linkReuniao: "https://meet.exemplo.invalid/teste-gruta",
      opcoesInformadas: "Segunda à noite",
      parceiroPresente: true as boolean | null,
      conduzidaPor: ID_COORDENACAO,
      criadoEm: new Date(agora - 9 * dia).toISOString(),
      agendadaPor: "humano" as const,
      lembreteEnviadoEm: null as string | null,
      resultado: null as string | null,
    },
    // [v4.3] Reunião que a Isadora marcou e que já começou: falta a Edilaine
    // registrar como foi (o desfecho decide se a conversa passa ao Leonardo).
    {
      id: id(13, 3),
      familiaId: familiaPorNome("Aurora").id,
      agendadaPara: new Date(agora - 2 * hora).toISOString(),
      status: "agendada" as const,
      realizadaEm: null as string | null,
      linkReuniao: "https://meet.google.com/aur-oraa-teste",
      opcoesInformadas: null as string | null,
      parceiroPresente: null as boolean | null,
      conduzidaPor: ID_COORDENACAO,
      criadoEm: new Date(agora - 2 * dia).toISOString(),
      agendadaPor: "isadora" as const,
      lembreteEnviadoEm: new Date(agora - 20 * hora).toISOString(),
      resultado: null as string | null,
    },
    // [v4.3] Reunião da Isadora já realizada: a conversa é do Leonardo.
    {
      id: id(13, 4),
      familiaId: familiaPorNome("Horizonte").id,
      agendadaPara: new Date(agora - 6 * dia).toISOString(),
      status: "realizada" as const,
      realizadaEm: new Date(agora - 6 * dia).toISOString(),
      linkReuniao: "https://meet.google.com/hor-izon-teste",
      opcoesInformadas: null as string | null,
      parceiroPresente: true as boolean | null,
      conduzidaPor: ID_COORDENACAO,
      criadoEm: new Date(agora - 8 * dia).toISOString(),
      agendadaPor: "isadora" as const,
      lembreteEnviadoEm: new Date(agora - 7 * dia).toISOString(),
      resultado:
        "Interesse no Continuado. Quer decidir com o parceiro até sexta.",
    },
  ];
}

/**
 * [v4.3] Resumo interno da Isadora para o Leonardo (privado.agenda_resumo_reuniao),
 * no formato do banco: " / " separa as linhas. Dado fictício, só o comercial.
 */
export const RESUMOS_ISADORA: Record<string, string> = {
  [id(13, 3)]: [
    "Marina · para ela mesma · DPP 03/05/2027",
    "São Paulo, Pinheiros · área confirmada",
    "primeiro bebê: sim · gemelar: não · rede de apoio: só o casal, a mãe mora longe",
    "principal preocupação: amamentação",
    "PDF: 28/09 20:40 · reunião com a Edilaine: agendada (marcada por a Isadora) · lembrete: enviado",
    "plano: não informado · pagamento: não informado",
    "objeções: nenhuma · pedidos de condição ou dúvidas de contrato anotados: perguntou se há desconto no Pix (a Isadora disse que o Leonardo trata depois da reunião) · origem: anúncio",
    "próximo passo: não informado",
  ].join(" / "),
  [id(13, 4)]: [
    "Vanessa · para ela mesma · DPP 24/11/2026",
    "São Paulo, Itaim Bibi · área confirmada",
    "primeiro bebê: não · gemelar: não · rede de apoio: mãe e irmã",
    "principal preocupação: rotina com o filho mais velho",
    "PDF: 20/09 19:12 · reunião com a Edilaine: realizada · lembrete: enviado",
    "plano: Continuado · pagamento: em 3x",
    "objeções: nenhuma · pedidos de condição ou dúvidas de contrato anotados: nenhum · origem: indicação",
    "resultado da reunião (Edilaine): Interesse no Continuado. Quer decidir com o parceiro até sexta.",
    "próximo passo: não informado",
  ].join(" / "),
};

export const GRAVACAO_GRUTA = {
  sessaoId: id(13, 2),
  consentimento: true,
  consentimentoVersao: "1-rascunho",
  transcricao: [
    "Coordenação: Juliana, como vocês imaginam os primeiros dias em casa?",
    "Juliana: A gente mora longe da família e eu tenho medo de não dar conta da amamentação sozinha.",
    "Diego: Eu volto a trabalhar depois de cinco dias. Queria saber se a enfermeira ajuda também à tarde.",
    "Coordenação: No Imersão a visita tem seis horas, então dá para acompanhar a tarde toda.",
    "Juliana: Achei o valor alto, mas faz sentido pelo tempo. Vamos pensar no Imersão.",
    "Diego: Pode mandar a proposta por escrito que a gente decide até sexta.",
  ].join("\n"),
};
