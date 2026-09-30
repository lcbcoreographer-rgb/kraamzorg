// Google Calendar de mentira para os testes e para o roteiro de homologação
// (P28): o calendário de teste da Edilaine. Roda no simulador do n8n no lugar
// do nó `googleCalendar` (os parâmetros que o build gera entram aqui) e, com
// `homologacao.agendaSimulada`, atrás da rota `/api/teste/uazapi/agenda/...`
// do app (o corpo das chamadas HTTP simuladas entra aqui também).
//
// Só imita o que o fluxo 4 usa: ocupado e livre, criar evento com Google Meet,
// ler, mover e apagar. Tem os defeitos que importam nos testes: evento
// apagado volta como `cancelled`, id repetido devolve 409, e o calendário pode
// ficar fora do ar. Cada chamada fica em `chamadas`, na ordem, para o teste
// provar que a agenda foi consultada antes de sugerir, na escolha e antes de
// criar. Dados fictícios, nunca um calendário real.

const FUSO_ISO = /[zZ]|[+-]\d{2}:\d{2}$/;

function instante(valor) {
  const texto = String(valor ?? '');
  const ms = Date.parse(texto);
  if (!Number.isFinite(ms)) throw new Error(`data inválida no calendário simulado: ${texto}`);
  if (!FUSO_ISO.test(texto)) throw new Error(`data sem fuso no calendário simulado: ${texto}`);
  return ms;
}

function erroGoogle(mensagem, httpCode) {
  const erro = new Error(mensagem);
  erro.httpCode = String(httpCode);
  return erro;
}

function slugDoMeet(id) {
  const base = String(id).replace(/[^a-z0-9]/gi, '').toLowerCase().padEnd(10, 'x');
  return `${base.slice(0, 3)}-${base.slice(3, 7)}-${base.slice(7, 10)}`;
}

export function criarCalendarioSimulado({ modoApagado = 'cancelled' } = {}) {
  const calendarios = new Map();
  const chamadas = [];
  let foraDoAr = false;
  let falhasPendentes = [];

  const calendario = (id) => {
    if (!calendarios.has(id)) calendarios.set(id, { ocupados: [], eventos: new Map() });
    return calendarios.get(id);
  };

  const registrar = (operacao, detalhe) => {
    chamadas.push({ operacao, ...detalhe });
    if (foraDoAr) throw erroGoogle('The service is currently unavailable', 503);
    const indice = falhasPendentes.findIndex((f) => f.operacao === operacao || f.operacao === '*');
    if (indice >= 0) {
      const [falha] = falhasPendentes.splice(indice, 1);
      throw erroGoogle(falha.mensagem ?? 'Bad Gateway', falha.codigo ?? 502);
    }
  };

  const intervalosDoCalendario = (id) => {
    const c = calendario(id);
    const lista = c.ocupados.map((b) => [b.inicio, b.fim]);
    for (const evento of c.eventos.values()) {
      if (evento.status === 'cancelled') continue;
      lista.push([Date.parse(evento.start.dateTime), Date.parse(evento.end.dateTime)]);
    }
    return lista;
  };

  // --- operações --------------------------------------------------------------

  function livreOcupado({ calendarId, timeMin, timeMax }) {
    registrar('livre-ocupado', { calendarId, timeMin, timeMax });
    const de = instante(timeMin);
    const ate = instante(timeMax);
    return intervalosDoCalendario(calendarId)
      .filter(([a, b]) => a < ate && b > de)
      .sort((x, y) => x[0] - y[0])
      .map(([a, b]) => ({ start: new Date(a).toISOString(), end: new Date(b).toISOString() }));
  }

  function criar({ calendarId, id, summary, description, start, end, attendees, comMeet, sendUpdates }) {
    registrar('criar', { calendarId, id, start, end, attendees, comMeet, sendUpdates });
    const c = calendario(calendarId);
    const eventoId = id || `gerado${c.eventos.size + 1}`;
    if (c.eventos.has(eventoId)) throw erroGoogle('The requested identifier already exists.', 409);
    const inicioMs = instante(start);
    const fimMs = instante(end);
    const evento = {
      kind: 'calendar#event',
      id: eventoId,
      status: 'confirmed',
      summary: summary ?? '',
      description: description ?? '',
      start: { dateTime: new Date(inicioMs).toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: new Date(fimMs).toISOString(), timeZone: 'America/Sao_Paulo' },
      attendees: (attendees ?? []).map((email) => ({ email })),
      ...(comMeet
        ? {
            hangoutLink: `https://meet.google.com/${slugDoMeet(eventoId)}`,
            conferenceData: { entryPoints: [{ entryPointType: 'video', uri: `https://meet.google.com/${slugDoMeet(eventoId)}` }] },
          }
        : {}),
    };
    c.eventos.set(eventoId, evento);
    return structuredClone(evento);
  }

  function obter({ calendarId, eventoId }) {
    registrar('obter', { calendarId, eventoId });
    const evento = calendario(calendarId).eventos.get(eventoId);
    if (!evento) throw erroGoogle('The resource you are requesting could not be found', 404);
    if (evento.status === 'cancelled' && modoApagado === '410') throw erroGoogle('Resource has been deleted', 410);
    return structuredClone(evento);
  }

  function atualizar({ calendarId, eventoId, start, end }) {
    registrar('atualizar', { calendarId, eventoId, start, end });
    const evento = calendario(calendarId).eventos.get(eventoId);
    if (!evento) throw erroGoogle('The resource you are requesting could not be found', 404);
    if (start) evento.start = { dateTime: new Date(instante(start)).toISOString(), timeZone: 'America/Sao_Paulo' };
    if (end) evento.end = { dateTime: new Date(instante(end)).toISOString(), timeZone: 'America/Sao_Paulo' };
    return structuredClone(evento);
  }

  function excluir({ calendarId, eventoId }) {
    registrar('excluir', { calendarId, eventoId });
    const evento = calendario(calendarId).eventos.get(eventoId);
    if (!evento || evento.status === 'cancelled') throw erroGoogle('Resource has been deleted', 410);
    evento.status = 'cancelled';
    return { success: true };
  }

  // --- adaptadores ---------------------------------------------------------------

  // Parâmetros do nó `googleCalendar` (já avaliados) -> operação.
  function executarNoGoogle(parametros) {
    const calendarId = String(parametros.calendar?.value ?? parametros.calendar ?? '');
    const { resource, operation } = parametros;
    if (resource === 'calendar' && operation === 'availability') {
      return livreOcupado({ calendarId, timeMin: parametros.timeMin, timeMax: parametros.timeMax });
    }
    if (resource !== 'event') throw new Error(`recurso do Google Calendar não suportado no simulado: ${resource}`);
    const extras = parametros.additionalFields ?? {};
    if (operation === 'create') {
      return criar({
        calendarId,
        id: extras.id,
        summary: extras.summary,
        description: extras.description,
        start: parametros.start,
        end: parametros.end,
        attendees: [].concat(extras.attendees ?? []).flatMap((item) => String(item).split(',')).map((email) => email.trim()).filter(Boolean),
        comMeet: extras.conferenceDataUi?.conferenceDataValues?.conferenceSolution === 'hangoutsMeet',
        sendUpdates: extras.sendUpdates,
      });
    }
    if (operation === 'get') return obter({ calendarId, eventoId: parametros.eventId });
    if (operation === 'update') {
      return atualizar({ calendarId, eventoId: parametros.eventId, start: parametros.updateFields?.start, end: parametros.updateFields?.end });
    }
    if (operation === 'delete') return excluir({ calendarId, eventoId: parametros.eventId });
    throw new Error(`operação do Google Calendar não suportada no simulado: ${operation}`);
  }

  // Corpo das chamadas HTTP do build com `agendaSimulada` -> operação.
  function executarHttp(operacao, corpo) {
    const calendarId = String(corpo.calendar_id ?? '');
    if (operacao === 'livre-ocupado') return livreOcupado({ calendarId, timeMin: corpo.time_min, timeMax: corpo.time_max });
    if (operacao === 'eventos') {
      return criar({
        calendarId,
        id: corpo.id,
        summary: corpo.summary,
        description: corpo.description,
        start: corpo.start,
        end: corpo.end,
        attendees: corpo.attendees,
        comMeet: true,
      });
    }
    if (operacao === 'eventos/obter') return obter({ calendarId, eventoId: corpo.evento_id });
    if (operacao === 'eventos/atualizar') return atualizar({ calendarId, eventoId: corpo.evento_id, start: corpo.start, end: corpo.end });
    if (operacao === 'eventos/excluir') return excluir({ calendarId, eventoId: corpo.evento_id });
    throw new Error(`operação de agenda simulada desconhecida: ${operacao}`);
  }

  return {
    chamadas,
    executarNoGoogle,
    executarHttp,
    // O que a Edilaine faz no próprio calendário (fora do fluxo).
    ocupar(calendarId, inicioIso, fimIso) {
      calendario(calendarId).ocupados.push({ inicio: instante(inicioIso), fim: instante(fimIso) });
    },
    liberarTudo() {
      for (const c of calendarios.values()) c.ocupados = [];
    },
    eventos(calendarId) {
      return [...calendario(calendarId).eventos.values()].map((e) => structuredClone(e));
    },
    eventosAtivos(calendarId) {
      return [...calendario(calendarId).eventos.values()].filter((e) => e.status !== 'cancelled').map((e) => structuredClone(e));
    },
    apagarPelaEdilaine(calendarId, eventoId) {
      const evento = calendario(calendarId).eventos.get(eventoId);
      if (evento) evento.status = 'cancelled';
    },
    moverPelaEdilaine(calendarId, eventoId, inicioIso, fimIso) {
      const evento = calendario(calendarId).eventos.get(eventoId);
      evento.start = { dateTime: new Date(instante(inicioIso)).toISOString(), timeZone: 'America/Sao_Paulo' };
      evento.end = { dateTime: new Date(instante(fimIso)).toISOString(), timeZone: 'America/Sao_Paulo' };
    },
    ficarForaDoAr(valor = true) {
      foraDoAr = valor;
    },
    // A próxima chamada da operação falha uma vez (`*` vale para qualquer uma).
    falharProxima(operacao, mensagem, codigo) {
      falhasPendentes.push({ operacao, mensagem, codigo });
    },
    limparFalhas() {
      falhasPendentes = [];
      foraDoAr = false;
    },
    chamadasDe(operacao) {
      return chamadas.filter((c) => c.operacao === operacao);
    },
  };
}
