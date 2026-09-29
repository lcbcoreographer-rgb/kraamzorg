import type { Json } from "@/lib/db/types";
import { familiaPorNome, PACOTES, PESSOAS, VERSOES_PACOTE } from "./fixtures";
import type { CobrancaDemo, ContratoDemo } from "./venda";

/**
 * Dados fictícios do contrato e da cobrança no modo demonstração (P31 e
 * P32), copiados de supabase/seed.sql: os parâmetros de contrato_modelo,
 * contrato_kraamzorg e cobranca, e os textos link_pagamento e
 * pagamento_confirmado(_34s). O teste contrato.test.ts confere que
 * continuam iguais ao seed. Nenhum nome, CPF ou telefone real.
 */

export const PARAMETROS_CONTRATO: Record<string, Json> = {
  contrato_modelo: {
    versao: "C-11 provisório",
    aprovado: false,
    titulo: "Contrato de prestação de serviços de cuidado domiciliar pós-parto",
    aviso_rascunho:
      "Modelo provisório, ainda sem a revisão do jurídico e da Kraamzorg.",
    profissional: "enfermeira obstétrica ou neonatal",
    partes: {
      contratada: "CONTRATADA",
      contratante: "CONTRATANTE",
      pagador: "PAGADOR(A)",
      testemunha: "TESTEMUNHA",
    },
    frentes: [
      "A mãe: presença atenta à recuperação física e ao bem-estar emocional, com espaço para tirar as dúvidas do dia a dia.",
      "O bebê: acompanhamento próximo da rotina, do sono, da alimentação e dos cuidados diários.",
      "A amamentação: apoio técnico e humano, todos os dias, sem imposição.",
      "A família: orientação ao parceiro e a quem estiver ajudando, para que ninguém aprenda essa fase sozinho.",
    ],
    valores: {
      pacote: "Valor do pacote",
      desconto: "Desconto",
      taxa: "Taxa de deslocamento",
      total: "Total",
      forma: "Forma de pagamento",
      forma_uma_vez:
        "Pix ou cartão à vista, pelo link de pagamento enviado depois da assinatura.",
      forma_parcelada:
        "Pix ou cartão em até {parcelas} vezes sem juros, pelo link de pagamento enviado depois da assinatura.",
    },
    clausulas: [
      {
        titulo: "1. Objeto",
        texto:
          "A CONTRATADA presta à CONTRATANTE o serviço de cuidado domiciliar pós-parto, no pacote {pacote}, por meio de {profissional} da equipe da Kraamzorg, no endereço de atendimento informado pela CONTRATANTE.",
      },
      {
        titulo: "2. Como o cuidado acontece",
        texto:
          "São {dias} dias de visita, com {horas_por_visita} horas por visita, num total de {horas_totais} horas de cuidado. Cada visita cuida de quatro frentes ao mesmo tempo, com uma coordenação só:",
        com_frentes: true,
      },
      {
        titulo: "3. Pré-natal online",
        texto:
          "O pacote inclui uma consulta de pré-natal online, na qual a equipe e a família montam juntas o plano de cuidado.",
      },
      {
        titulo: "4. Início do atendimento",
        texto:
          "O atendimento começa a partir da alta hospitalar, e não do nascimento. A data provável do parto é uma estimativa e não define o início. A data de início é combinada com a família quando a alta acontece.",
      },
      {
        titulo: "5. Valor e pagamento",
        valores: true,
        texto: "O valor do contrato e a forma de pagamento são os abaixo.",
      },
      {
        titulo: "5. Pagamento",
        somente_presente: true,
        texto:
          "O pagamento deste contrato é feito por {pagador}, que presenteia a CONTRATANTE. Os valores são tratados entre a CONTRATADA e quem paga e não constam neste documento.",
      },
      {
        titulo: "6. Compromissos da CONTRATADA",
        texto:
          "Prestar o cuidado com a mesma enfermeira do primeiro ao último dia, sempre que possível, seguindo o protocolo da coordenação de enfermagem, e acionar a rede médica indicada quando houver sinal de alerta.",
      },
      {
        titulo: "7. Compromissos da CONTRATANTE",
        texto:
          "Informar com verdade os dados de saúde e do endereço de atendimento, garantir um adulto de referência na casa durante as visitas e avisar a equipe, com antecedência, se precisar remarcar uma visita.",
      },
      {
        titulo: "8. Dados pessoais e sigilo",
        texto:
          "Os dados pessoais e de saúde da CONTRATANTE e do bebê são tratados com sigilo, apenas para prestar o cuidado contratado, conforme a Lei Geral de Proteção de Dados, e ficam acessíveis só à equipe que precisa deles.",
      },
      {
        titulo: "9. Cancelamento e devolução",
        texto:
          "Cancelamento, remarcação e devolução seguem a política da Kraamzorg vigente na data da assinatura, entregue à CONTRATANTE junto com este contrato. Texto a definir com a diretoria e o jurídico.",
      },
      {
        titulo: "10. Foro",
        texto:
          "As partes elegem o foro do domicílio da CONTRATANTE para resolver qualquer questão deste contrato. Texto a confirmar com o jurídico.",
      },
    ],
    assinaturas:
      "Assinam este contrato, por meio da plataforma de assinatura eletrônica Autentique, a CONTRATANTE e a CONTRATADA e, como testemunha, quando houver, a pessoa indicada pela CONTRATANTE.",
  },
  contrato_kraamzorg: {
    signatario_nome: "Representante Kraamzorg de Teste",
    signatario_email: "assinatura.kraamzorg@exemplo.invalid",
    razao_social: "Kraamzorg Brasil",
    documento: "CNPJ a confirmar no cadastro da empresa",
    endereco: "Endereço a confirmar no cadastro da empresa",
  },
  cobranca: {
    vencimento_dias: 3,
    descricao_item: "Cuidado domiciliar pós-parto",
    prenatal_urgente_semanas: 34,
    comprovante_max_bytes: 3145728,
  },
};

/** Textos de mensagem_modelo (whatsapp, familia, rascunho) que a cobrança usa. */
export const MENSAGENS_COBRANCA: { chave: string; texto: string }[] = [
  {
    chave: "link_pagamento",
    texto:
      "Contrato assinado, obrigado! Aqui está o link de pagamento: {link}. Dá para pagar no cartão em até 3x sem juros ou no Pix.",
  },
  {
    chave: "pagamento_confirmado",
    texto:
      "Pagamento confirmado, {nome}. Obrigado pela confiança. Por volta das 34 semanas a Edilaine vai te chamar para o pré-natal online, e é nesse encontro que vocês montam juntos o plano de cuidado.",
  },
  {
    chave: "pagamento_confirmado_34s",
    texto:
      "Pagamento confirmado, {nome}. Obrigado pela confiança. Como você já está com {semanas} semanas, a Edilaine vai te chamar nos próximos dias para marcar o pré-natal online.",
  },
];

// --- Contratos e cobranças iniciais (espelham as quatro famílias do seed) ------------

const dia = 24 * 60 * 60 * 1000;

function idContrato(n: number): string {
  return `00000000-0000-4000-8019-${n.toString().padStart(12, "0")}`;
}

function idCobranca(n: number): string {
  return `00000000-0000-4000-8020-${n.toString().padStart(12, "0")}`;
}

function diaIso(agora: number, dias: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(agora + dias * dia));
}

interface LinhaInicial {
  n: number;
  nomeFamilia: string;
  pacote: string;
  valor: number;
  desconto: number;
  parcelas: number;
  status: "aberta" | "paga";
  metodo: string | null;
  parcelasCartao: number | null;
  pagoHaDias: number | null;
  nota: "emitida" | null;
}

const LINHAS_INICIAIS: LinhaInicial[] = [
  {
    n: 1,
    nomeFamilia: "Horizonte",
    pacote: "Imersão",
    valor: 780000,
    desconto: 39000,
    parcelas: 1,
    status: "aberta",
    metodo: null,
    parcelasCartao: null,
    pagoHaDias: null,
    nota: null,
  },
  {
    n: 2,
    nomeFamilia: "Íris",
    pacote: "Essencial",
    valor: 420000,
    desconto: 0,
    parcelas: 3,
    status: "paga",
    metodo: "credit_card",
    parcelasCartao: 3,
    pagoHaDias: 8,
    nota: "emitida",
  },
  {
    n: 3,
    nomeFamilia: "Jade",
    pacote: "Essencial",
    valor: 420000,
    desconto: 0,
    parcelas: 3,
    status: "paga",
    metodo: "credit_card",
    parcelasCartao: 3,
    pagoHaDias: 56,
    nota: "emitida",
  },
  {
    n: 4,
    nomeFamilia: "Lua",
    pacote: "Gemelar Essencial",
    valor: 540000,
    desconto: 0,
    parcelas: 1,
    status: "paga",
    metodo: "pix",
    parcelasCartao: 1,
    pagoHaDias: 21,
    nota: "emitida",
  },
];

function versaoVigente(nomePacote: string) {
  const pacote = PACOTES.find((p) => p.nome === nomePacote);
  const versao = VERSOES_PACOTE.find(
    (v) => v.pacoteId === pacote?.pacoteId && v.vigenciaFim === null,
  );
  if (!versao) {
    throw new Error(`fixture: pacote sem versão vigente: ${nomePacote}`);
  }
  return versao;
}

export function contratosIniciais(agora: number): ContratoDemo[] {
  return LINHAS_INICIAIS.map((l) => {
    const familia = familiaPorNome(l.nomeFamilia);
    const mae = PESSOAS.find(
      (p) => p.familiaId === familia.id && p.papel === "mae",
    );
    return {
      id: idContrato(l.n),
      familiaId: familia.id,
      pacoteVersaoId: versaoVigente(l.pacote).versaoId,
      contratantePessoaId: mae?.id ?? null,
      pagadorPessoaId: null,
      testemunhaPessoaId: null,
      valorCentavos: l.valor,
      taxaCentavos: 0,
      descontoCentavos: l.desconto,
      parcelas: l.parcelas,
      templateVersao: "padrao-provisorio-v1",
      tokenHash: null,
      expiraEm: new Date(agora - 12 * dia).toISOString(),
      status: "assinado" as const,
      criadoEm: new Date(agora - 12 * dia).toISOString(),
      pdfPath: `contratos/${idContrato(l.n)}-assinado.pdf`,
      autentiqueDocId: `teste-autentique-${l.n}`,
      enviadoEm: new Date(agora - 10 * dia).toISOString(),
      assinadoEm: new Date(agora - 9 * dia).toISOString(),
    };
  });
}

export function cobrancasIniciais(agora: number): CobrancaDemo[] {
  return LINHAS_INICIAIS.map((l) => {
    const familia = familiaPorNome(l.nomeFamilia);
    const paga = l.status === "paga";
    const total = l.valor - l.desconto;
    return {
      id: idCobranca(l.n),
      contratoId: idContrato(l.n),
      familiaId: familia.id,
      parcela: 1,
      valorCentavos: total,
      vencimento: diaIso(agora, paga ? -(l.pagoHaDias ?? 0) : 5),
      status: l.status,
      linkPagamento: `https://pay.exemplo.invalid/teste-${l.n}`,
      invoiceSlug: null,
      metodo: l.metodo,
      parcelasCartao: l.parcelasCartao,
      valorPagoCentavos: paga ? total : null,
      comprovante: null,
      pagoEm: paga
        ? new Date(agora - (l.pagoHaDias ?? 0) * dia).toISOString()
        : null,
      notaStatus: l.nota,
      notaNumero: l.nota ? `00${l.n}` : null,
      criadoEm: new Date(agora - 10 * dia).toISOString(),
    };
  });
}
