import type { Json } from "@/lib/db/types";
import type { TipoTarefa } from "@/lib/dados/tipos";

/**
 * Por que a tarefa existe e o que fazer com ela, em frase curta (pedido do
 * dono em 30/09: "como funcionam as tarefas? faz sentido?"). Cada frase diz
 * de qual regra ou automação a tarefa veio, pelo catálogo do PRD 10.1 e
 * pelas funções do banco que criam tarefa (a `acao` do payload, quando há).
 * Só explica: nenhuma regra muda aqui, e nenhum prazo ou número de
 * parâmetro entra no texto (os prazos moram em `parametro`).
 */

export interface ExplicacaoTarefa {
  /** De qual regra ou automação ela veio. */
  origem: string;
  /** O que a pessoa faz para fechar a tarefa. */
  oQueFazer: string;
}

const POR_ACAO: Record<string, ExplicacaoTarefa> = {
  justificar_freio: {
    origem: "Nasceu quando o freio foi acionado para esta família.",
    oQueFazer:
      "Escreva na ficha por que o freio foi acionado. A justificativa fecha a tarefa.",
  },
  formulario_contrato: {
    origem:
      "A oportunidade foi marcada como ganha e o contrato precisa dos dados da família.",
    oQueFazer:
      "Abra a proposta e envie o link do formulário, que vale uma vez só.",
  },
  prenatal_urgente: {
    origem:
      "O pagamento foi confirmado com a gestação já adiantada, e o pré-natal online ainda não tem data.",
    oQueFazer: "Marque a consulta pré-natal o quanto antes.",
  },
  pagamento_confirmado: {
    origem: "O pagamento da família foi confirmado.",
    oQueFazer: "Avise a família, com o texto sugerido quando houver.",
  },
  link_pagamento: {
    origem: "O contrato foi assinado e a cobrança já tem link de pagamento.",
    oQueFazer: "Envie o link de pagamento para a família.",
  },
  relacionamento_medico: {
    origem: "Criada na tela de parceiros médicos, para o relacionamento.",
    oQueFazer: "Faça o contato combinado com o médico e conclua.",
  },
  depoimento: {
    origem: "A família deu nota alta na pesquisa de satisfação.",
    oQueFazer:
      "Pergunte se ela quer deixar um depoimento, respeitando o que autorizou.",
  },
  indicacao: {
    origem: "A família deu nota alta na pesquisa de satisfação.",
    oQueFazer: "Convide a família a indicar a Kraamzorg, sem insistir.",
  },
  escuta: {
    origem: "A família deu nota média na pesquisa de satisfação.",
    oQueFazer: "Ligue para ouvir o que pode melhorar, sem oferecer nada.",
  },
  pesquisa: {
    origem: "O último dia do acompanhamento foi concluído.",
    oQueFazer: "Envie o link da pesquisa de satisfação pelo pós-venda.",
  },
  evolucao_familia: {
    origem: "A evolução de enfermagem do acompanhamento ficou pronta.",
    oQueFazer: "Envie a evolução para a família.",
  },
  emitir_evolucao: {
    origem: "O acompanhamento terminou e a evolução precisa sair.",
    oQueFazer: "Revise e emita a evolução de enfermagem.",
  },
  portal_familia: {
    origem: "O acesso da família ao portal foi liberado.",
    oQueFazer: "Envie o convite do portal com o texto sugerido.",
  },
};

const POR_TIPO: Record<TipoTarefa, ExplicacaoTarefa> = {
  nutricao_contato: {
    origem:
      "A régua de nutrição abriu este contato: a gestação mudou de faixa de semanas.",
    oQueFazer: "Mande a mensagem da régua para a família.",
  },
  followup_comercial: {
    origem:
      "Um retorno combinado com a família chegou, ou a cadência do comercial pediu um novo contato.",
    oQueFazer: "Retome a conversa com a família.",
  },
  agendar_sessao: {
    origem:
      "A família quer a reunião com a Edilaine e a Isadora não conseguiu marcar.",
    oQueFazer: "Marque a reunião na tela de sessões de venda.",
  },
  registrar_desfecho_sessao: {
    origem: "A reunião com a família terminou e o desfecho não foi registrado.",
    oQueFazer:
      "Registre se a reunião aconteceu, se a família faltou ou remarcou.",
  },
  responder_consulta_isadora: {
    origem:
      "A Isadora perguntou à equipe algo que não sabe (área, dúvida ou horário) e segue a conversa.",
    oQueFazer:
      "Responda a consulta. A Isadora leva a resposta à família com as palavras dela.",
  },
  enviar_formulario_contrato: {
    origem:
      "A oportunidade foi marcada como ganha e o contrato precisa dos dados da família.",
    oQueFazer: "Confira o formulário do contrato e siga para a assinatura.",
  },
  checkin_dpp: {
    origem: "A data prevista do parto está chegando.",
    oQueFazer:
      "Fale com a família e confirme que a enfermeira e o backup estão combinados.",
  },
  agendar_prenatal: {
    origem:
      "O pagamento foi confirmado e a consulta pré-natal online ainda não tem data.",
    oQueFazer: "Marque a consulta na tela de pré-natal.",
  },
  designar_profissional: {
    origem: "A família precisa de uma enfermeira designada para o atendimento.",
    oQueFazer: "Escolha a enfermeira e o backup na agenda da equipe.",
  },
  obter_contato_medico: {
    origem:
      "O acompanhamento terminou sem o contato do médico, e a evolução espera por ele.",
    oQueFazer: "Consiga o contato do médico da família e registre na ficha.",
  },
  emitir_evolucao: {
    origem: "O acompanhamento terminou e a evolução precisa sair.",
    oQueFazer: "Revise e emita a evolução de enfermagem.",
  },
  escuta_neutro: {
    origem: "A família deu nota média na pesquisa de satisfação.",
    oQueFazer: "Ligue para ouvir o que pode melhorar, sem oferecer nada.",
  },
  enviar_pesquisa: {
    origem: "O último dia do acompanhamento foi concluído.",
    oQueFazer: "Envie o link da pesquisa de satisfação pelo pós-venda.",
  },
  enviar_guia: {
    origem: "A alta foi registrada e o acompanhamento começou.",
    oQueFazer: "Envie o guia para a família, com o texto sugerido.",
  },
  cobranca_atraso: {
    origem: "Uma cobrança da família passou do vencimento.",
    oQueFazer: "Fale com a família sobre o pagamento, com cuidado.",
  },
  documento_vencendo: {
    origem: "Um documento de alguém da equipe vence em breve.",
    oQueFazer: "Peça a renovação e anexe o documento novo.",
  },
  outro: {
    origem: "Aberta por alguém da equipe.",
    oQueFazer: "Faça o que o título pede.",
  },
};

function acaoDo(payload: Json): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const acao = (payload as Record<string, unknown>).acao;
  return typeof acao === "string" ? acao : null;
}

export function explicarTarefa(tarefa: {
  tipo: TipoTarefa;
  payload: Json;
}): ExplicacaoTarefa {
  const acao = acaoDo(tarefa.payload);
  return (acao ? POR_ACAO[acao] : undefined) ?? POR_TIPO[tarefa.tipo];
}
