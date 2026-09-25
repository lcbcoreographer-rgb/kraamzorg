// Nó "Ler Classificação" do fluxo 2 (nó 8), depois do classificador de pedido
// (`n8n/prompts/classificar-pedido.md`, PRD 19.3). Função pura: recebe o
// motivo que o agente informou e a saída bruta do classificador, devolve o
// motivo final e a ação (PRD 19.3, "Regras do Ler Classificação", e o nó 8a
// v4.2). O build embute este arquivo no nó Code; os testes importam a mesma
// função.
//
// Regras (PRD 19.3):
// - Classificador falhou ou tipo inválido: vale o motivo do agente, marcado
//   `classificador_falhou`.
// - O classificador pode subir para `saude` ou `perda`, nunca descer.
// - `sem_aviso` e `nao_lead` só valem quando o motivo do agente foi
//   `duvida_sem_resposta` ou `outro`; `sem_aviso` nunca vale em modo
//   `cliente`.
// - Nos demais casos, o classificador só troca o destino entre os motivos
//   comerciais, sem nunca baixar a prioridade do motivo original.
// - Conversa já marcada como não lead continua não lead.
// - Subiu para `saude` ou `perda`: segue pelo nó 8a (texto à família antes do
//   registro), `enviar_texto` verdadeiro.

const TIPOS_VALIDOS = [
  'contratar',
  'reuniao',
  'condicao_comercial',
  'cobertura_taxa',
  'reembolso_fiscal',
  'duvida_sem_resposta',
  'pediu_humano',
  'bebe_nasceu',
  'pos_venda_operacao',
  'reclamacao',
  'parceiro_medico',
  'outro',
  'nao_lead',
  'sem_aviso',
  'saude',
  'perda',
];

// Mesma lista de `classificar-pedido.md` (PRD 19.3): motivos entre os quais o
// classificador pode trocar o destino sem que isso conte como "subir" para
// saúde/perda nem como sair da faixa de motivos comerciais.
const MOTIVOS_COMERCIAIS = [
  'contratar',
  'reuniao',
  'condicao_comercial',
  'cobertura_taxa',
  'reembolso_fiscal',
  'parceiro_medico',
  'duvida_sem_resposta',
  'outro',
];

// Prioridade da 11.4 (alta = 2, normal = 1), só para a regra "nunca baixa a
// prioridade do motivo original" desta função pura; a matriz completa (com
// SLA e destino) mora em `parametro.handoff_matriz`, lida por
// `agente.registrar_handoff`.
const PRIORIDADE = {
  contratar: 2,
  reuniao: 2,
  pediu_humano: 2,
  reclamacao: 2,
  bebe_nasceu: 2,
  condicao_comercial: 1,
  cobertura_taxa: 1,
  reembolso_fiscal: 1,
  duvida_sem_resposta: 1,
  outro: 1,
  parceiro_medico: 1,
  pos_venda_operacao: 1,
};

function prioridadeDe(motivo) {
  return PRIORIDADE[motivo] ?? 1;
}

function analisarSaidaModelo(saidaModelo) {
  let objeto = null;
  try {
    objeto = typeof saidaModelo === 'string' ? JSON.parse(saidaModelo) : saidaModelo;
  } catch {
    objeto = null;
  }
  if (!objeto || typeof objeto !== 'object' || !TIPOS_VALIDOS.includes(objeto.tipo)) {
    return null;
  }
  return objeto.tipo;
}

export function lerClassificacaoPedido({ motivoAgente, saidaModelo, modo, jaNaoLead = false }) {
  // Conversa já marcada como não lead continua não lead, mesmo sem chamar o
  // classificador de novo.
  if (jaNaoLead) {
    return {
      motivoFinal: 'nao_lead',
      classificadorFalhou: false,
      acao: 'transferir',
      chaveTexto: null,
      enviarTexto: false,
      subiuParaAlerta: false,
    };
  }

  const tipo = analisarSaidaModelo(saidaModelo);

  if (tipo === null) {
    return {
      motivoFinal: motivoAgente,
      classificadorFalhou: true,
      acao: 'transferir',
      chaveTexto: null,
      enviarTexto: false,
      subiuParaAlerta: false,
    };
  }

  // Subiu para saúde ou perda: nó 8a, nunca desce.
  if (tipo === 'saude' || tipo === 'perda') {
    return {
      motivoFinal: tipo,
      classificadorFalhou: false,
      acao: tipo === 'perda' ? 'perda' : 'alerta_saude',
      chaveTexto: tipo === 'perda' ? 'perda' : 'alerta_saude',
      enviarTexto: true,
      subiuParaAlerta: true,
    };
  }

  const motivoAgenteElegivelParaSilencio = motivoAgente === 'duvida_sem_resposta' || motivoAgente === 'outro';

  if (tipo === 'sem_aviso') {
    if (motivoAgenteElegivelParaSilencio && modo !== 'cliente') {
      return {
        motivoFinal: 'sem_aviso',
        classificadorFalhou: false,
        acao: 'sem_aviso',
        chaveTexto: null,
        enviarTexto: false,
        subiuParaAlerta: false,
      };
    }
    // Não elegível (motivo do agente não era duvida_sem_resposta/outro, ou
    // modo é cliente): a troca não vale, mantém o motivo original.
    return {
      motivoFinal: motivoAgente,
      classificadorFalhou: false,
      acao: 'transferir',
      chaveTexto: null,
      enviarTexto: false,
      subiuParaAlerta: false,
    };
  }

  if (tipo === 'nao_lead') {
    if (motivoAgenteElegivelParaSilencio) {
      return {
        motivoFinal: 'nao_lead',
        classificadorFalhou: false,
        acao: 'transferir',
        chaveTexto: null,
        enviarTexto: false,
        subiuParaAlerta: false,
      };
    }
    return {
      motivoFinal: motivoAgente,
      classificadorFalhou: false,
      acao: 'transferir',
      chaveTexto: null,
      enviarTexto: false,
      subiuParaAlerta: false,
    };
  }

  // Demais motivos: troca só entre motivos comerciais, sem baixar prioridade.
  if (MOTIVOS_COMERCIAIS.includes(tipo) && MOTIVOS_COMERCIAIS.includes(motivoAgente)) {
    const motivoFinal = prioridadeDe(tipo) >= prioridadeDe(motivoAgente) ? tipo : motivoAgente;
    return {
      motivoFinal,
      classificadorFalhou: false,
      acao: 'transferir',
      chaveTexto: null,
      enviarTexto: false,
      subiuParaAlerta: false,
    };
  }

  // Tipo fora da faixa de motivos comerciais trocáveis (ex.: pediu_humano,
  // bebe_nasceu, reclamacao, pos_venda_operacao): mantém o motivo do agente.
  return {
    motivoFinal: motivoAgente,
    classificadorFalhou: false,
    acao: 'transferir',
    chaveTexto: null,
    enviarTexto: false,
    subiuParaAlerta: false,
  };
}
