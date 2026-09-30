// Regras puras da agenda da reunião inicial com a Edilaine (PRD 11.14, 19.6).
// O build embute este arquivo nos nós Code do fluxo 4 e do fluxo 3; os testes
// importam as mesmas funções. Nada aqui fala com o Google nem com o banco: as
// ferramentas de rede ficam nos nós, e cada regra de agenda que o
// treinamento v3 pede (seção 3) é decidida aqui, em código, com a agenda
// simulada dos testes.
//
// Nenhum horário, faixa, bloco, antecedência, intervalo ou título mora aqui:
// tudo chega de `agente.parametros_agenda()` (parametro.agenda_*). O que fica
// no código é aritmética de calendário, leitura de preferência e conferência
// de resultado.
//
// Fuso: America/Sao_Paulo, sempre. Datas locais saem do Intl, sem depender do
// fuso da máquina onde o n8n roda (a conta do Google e o servidor podem estar
// em outro fuso).

import { normalizarTexto } from './normalizar-texto.js';

export const FUSO_AGENDA = 'America/Sao_Paulo';

// Prefixo do id de todo evento criado pela Isadora. O nó Google Calendar do
// n8n não grava propriedades privadas no evento, então a marca de origem
// (PRD 11.14, `kz_origem = isadora`) é o próprio id, que a Isadora escolhe ao
// criar: `kraam` + o id da opção de horário sem hífens (letras a-v e dígitos,
// como o Google exige). Só evento com esse prefixo pode ser movido ou apagado
// por ela, e o id vem sempre do banco (`agente.reuniao_da_conversa`).
export const PREFIXO_EVENTO = 'kraam';

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_NORMALIZADOS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const MINUTO_MS = 60000;
const DIA_MS = 86400000;

// ---------------------------------------------------------------------------
// Fuso e formatação
// ---------------------------------------------------------------------------

let formatador = null;

function partesLocais(ms) {
  formatador ??= new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_AGENDA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const partes = {};
  for (const parte of formatador.formatToParts(new Date(ms))) partes[parte.type] = parte.value;
  const semana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[partes.weekday];
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    semana,
  };
}

// Instante (ms) de uma data e hora locais de São Paulo.
export function instanteLocal(ano, mes, dia, hora = 0, minuto = 0) {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let palpite = alvo;
  for (let i = 0; i < 4; i += 1) {
    const p = partesLocais(palpite);
    const diferenca = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - alvo;
    if (diferenca === 0) break;
    palpite -= diferenca;
  }
  return palpite;
}

function doisDigitos(numero) {
  return String(numero).padStart(2, '0');
}

// "2026-10-03T10:00:00-03:00": o formato que os nós do Google Calendar leem
// sem depender do fuso da máquina.
export function isoLocal(ms) {
  const p = partesLocais(ms);
  const deslocamento = Math.round((Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - Math.floor(ms / MINUTO_MS) * MINUTO_MS) / MINUTO_MS);
  const sinal = deslocamento >= 0 ? '+' : '-';
  const abs = Math.abs(deslocamento);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}:00${sinal}${doisDigitos(Math.floor(abs / 60))}:${doisDigitos(abs % 60)}`;
}

export function diaDaSemana(ms) {
  return DIAS_NOME[partesLocais(ms).semana];
}

export function dataCurta(ms) {
  const p = partesLocais(ms);
  return `${doisDigitos(p.dia)}/${doisDigitos(p.mes)}`;
}

// "19h" ou "9h30", como `privado.agenda_hora` no banco.
export function horaCurta(ms) {
  const p = partesLocais(ms);
  return `${p.hora}h${p.minuto === 0 ? '' : doisDigitos(p.minuto)}`;
}

// "quinta, 01/10, às 19h": o texto que a Isadora usa para oferecer e
// confirmar o horário; é o mesmo de `privado.agenda_texto` no banco.
export function textoDoHorario(ms) {
  return `${diaDaSemana(ms)}, ${dataCurta(ms)}, às ${horaCurta(ms)}`;
}

export function descreverHorario(inicioMs, blocoMinutos) {
  const fimMs = inicioMs + blocoMinutos * MINUTO_MS;
  return {
    inicio: new Date(inicioMs).toISOString(),
    fim: new Date(fimMs).toISOString(),
    dia_semana: diaDaSemana(inicioMs),
    data: dataCurta(inicioMs),
    hora: horaCurta(inicioMs),
    texto: textoDoHorario(inicioMs),
  };
}

function minutosDe(hhmm) {
  const casamento = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!casamento) return null;
  const minutos = Number(casamento[1]) * 60 + Number(casamento[2]);
  return minutos >= 0 && minutos <= 1440 ? minutos : null;
}

function inicioDoDia(ms) {
  const p = partesLocais(ms);
  return instanteLocal(p.ano, p.mes, p.dia, 0, 0);
}

function somarDias(ms, dias) {
  // Meio-dia evita qualquer borda de virada de dia ao somar em milissegundos.
  const p = partesLocais(inicioDoDia(ms) + 12 * 60 * MINUTO_MS + dias * DIA_MS);
  return instanteLocal(p.ano, p.mes, p.dia, 0, 0);
}

// ---------------------------------------------------------------------------
// Preferência da família ("sábado de manhã", "depois das 20h", "quarta às 20h")
// ---------------------------------------------------------------------------

const PERIODOS_PADRAO = { manha: ['06:00', '12:00'], tarde: ['12:00', '18:00'], noite: ['18:00', '24:00'] };

function horaDoTexto(horas, minutos) {
  const h = Number(horas);
  const m = minutos === undefined || minutos === '' ? 0 : Number(minutos);
  if (!Number.isFinite(h) || h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

const HORA = String.raw`(\d{1,2})(?:\s*(?:h|:|horas?)\s*(\d{2})?)?`;

export function lerPreferencia(texto, agoraMs) {
  const limpo = normalizarTexto(String(texto ?? '')).replace(/\s+/g, ' ');
  const preferencia = {
    dias_semana: [],
    datas: [],
    periodo: null,
    depois_das: null,
    antes_das: null,
    hora_exata: null,
    a_partir_de: null,
    ate: null,
    entendida: false,
    texto: limpo,
  };
  if (!limpo) return preferencia;
  let resto = limpo;

  const tirar = (regex, aoCasar) => {
    resto = resto.replace(regex, (...args) => {
      aoCasar(args);
      return ' ';
    });
  };

  tirar(new RegExp(String.raw`\b(?:depois d[ae]s?|apos (?:a|as|o|os)?|a partir d[ae]s?)\s*${HORA}`, 'g'), (a) => {
    const minutos = horaDoTexto(a[1], a[2]);
    if (minutos !== null) preferencia.depois_das = minutos;
  });
  tirar(new RegExp(String.raw`\bantes d[ae]s?\s*${HORA}`, 'g'), (a) => {
    const minutos = horaDoTexto(a[1], a[2]);
    if (minutos !== null) preferencia.antes_das = minutos;
  });
  tirar(/\b(\d{1,2})\/(\d{1,2})\b/g, (a) => {
    preferencia.datas.push(`${doisDigitos(Number(a[1]))}/${doisDigitos(Number(a[2]))}`);
  });
  tirar(/\bdepois de amanha\b/g, () => {
    preferencia.datas.push(dataCurta(somarDias(agoraMs, 2)));
  });
  tirar(/\bamanha\b/g, () => {
    preferencia.datas.push(dataCurta(somarDias(agoraMs, 1)));
  });
  tirar(/\bhoje\b/g, () => {
    preferencia.datas.push(dataCurta(inicioDoDia(agoraMs)));
  });
  tirar(/\b(?:semana que vem|proxima semana)\b/g, () => {
    const diasAteSegunda = (1 - partesLocais(agoraMs).semana + 7) % 7 || 7;
    const segunda = somarDias(agoraMs, diasAteSegunda);
    preferencia.a_partir_de = segunda;
    preferencia.ate = segunda + 7 * DIA_MS;
  });
  tirar(/\b(?:fim|final) de semana\b/g, () => {
    preferencia.dias_semana.push('sab', 'dom');
  });
  tirar(/\b(?:dias? de semana|durante a semana)\b/g, () => {
    preferencia.dias_semana.push('seg', 'ter', 'qua', 'qui', 'sex');
  });
  DIAS_NORMALIZADOS.forEach((nome, indice) => {
    tirar(new RegExp(String.raw`\b${nome}(?:-feira| feira)?s?\b`, 'g'), () => {
      preferencia.dias_semana.push(DIAS_CURTOS[indice]);
    });
  });
  tirar(/\b(?:de |pela |na |a )?(manha|tarde|noite)\b/g, (a) => {
    preferencia.periodo = a[1];
  });
  tirar(new RegExp(String.raw`\b(?:as|por volta d[ae]s?|umas?)\s*${HORA}`, 'g'), (a) => {
    const minutos = horaDoTexto(a[1], a[2]);
    if (minutos !== null) preferencia.hora_exata = minutos;
  });
  tirar(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/g, (a) => {
    const minutos = horaDoTexto(a[1], a[2]);
    if (minutos !== null && preferencia.hora_exata === null) preferencia.hora_exata = minutos;
  });

  preferencia.dias_semana = [...new Set(preferencia.dias_semana)];
  preferencia.datas = [...new Set(preferencia.datas)];
  preferencia.entendida =
    preferencia.dias_semana.length > 0 ||
    preferencia.datas.length > 0 ||
    preferencia.periodo !== null ||
    preferencia.depois_das !== null ||
    preferencia.antes_das !== null ||
    preferencia.hora_exata !== null ||
    preferencia.a_partir_de !== null;
  return preferencia;
}

function periodoDoMinuto(minutos, periodos) {
  for (const [nome, faixa] of Object.entries(periodos)) {
    const inicio = minutosDe(faixa?.[0]);
    const fim = minutosDe(faixa?.[1]);
    if (inicio !== null && fim !== null && minutos >= inicio && minutos < fim) return nome;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ocupação e opções
// ---------------------------------------------------------------------------

// Intervalos ocupados que o Google devolveu (`[{start, end}]`), em ms.
// Item sem início e fim (por exemplo o item vazio de uma agenda livre) é
// ignorado.
export function intervalosOcupados(itens) {
  const lista = [];
  for (const item of Array.isArray(itens) ? itens : []) {
    const inicio = Date.parse(item?.start);
    const fim = Date.parse(item?.end);
    if (Number.isFinite(inicio) && Number.isFinite(fim) && fim > inicio) lista.push([inicio, fim]);
  }
  return lista;
}

export function livreNoHorario(inicioMs, fimMs, ocupados, intervaloMinutos = 0) {
  const folga = Math.max(0, Number(intervaloMinutos) || 0) * MINUTO_MS;
  return !ocupados.some(([a, b]) => inicioMs < b + folga && fimMs > a - folga);
}

// Todos os horários possíveis, em ordem: faixas do parâmetro `agenda_faixas`
// ({"seg":[["09:00","12:00"]], ...}) cortadas em blocos, dentro da janela, fora
// da antecedência mínima e sem cruzar o ocupado.
export function horariosLivres({ faixas, blocoMinutos, antecedenciaHoras, intervaloMinutos, janelaDias, agoraMs, ocupados }) {
  const bloco = Number(blocoMinutos);
  if (!Number.isFinite(bloco) || bloco <= 0 || !faixas || typeof faixas !== 'object') return [];
  const primeiro = agoraMs + (Number(antecedenciaHoras) || 0) * 60 * MINUTO_MS;
  const limite = agoraMs + (Number(janelaDias) || 0) * DIA_MS;
  const livres = [];
  for (let d = 0; d <= (Number(janelaDias) || 0) + 1; d += 1) {
    const dia = somarDias(agoraMs, d);
    const p = partesLocais(dia + 12 * 60 * MINUTO_MS);
    for (const [inicioTexto, fimTexto] of faixas[DIAS_CURTOS[p.semana]] ?? []) {
      const inicioFaixa = minutosDe(inicioTexto);
      const fimFaixa = minutosDe(fimTexto);
      if (inicioFaixa === null || fimFaixa === null) continue;
      for (let t = inicioFaixa; t + bloco <= fimFaixa; t += bloco) {
        const inicioMs = instanteLocal(p.ano, p.mes, p.dia, Math.floor(t / 60), t % 60);
        const fimMs = inicioMs + bloco * MINUTO_MS;
        if (inicioMs < primeiro || inicioMs >= limite) continue;
        if (!livreNoHorario(inicioMs, fimMs, ocupados, intervaloMinutos)) continue;
        livres.push(inicioMs);
      }
    }
  }
  return livres.sort((a, b) => a - b);
}

function casaComPreferencia(inicioMs, preferencia, periodos) {
  const p = partesLocais(inicioMs);
  const minutos = p.hora * 60 + p.minuto;
  if (preferencia.dias_semana.length > 0 && !preferencia.dias_semana.includes(DIAS_CURTOS[p.semana])) return false;
  if (preferencia.datas.length > 0 && !preferencia.datas.includes(dataCurta(inicioMs))) return false;
  if (preferencia.a_partir_de !== null && (inicioMs < preferencia.a_partir_de || inicioMs >= preferencia.ate)) return false;
  if (preferencia.periodo !== null && periodoDoMinuto(minutos, periodos) !== preferencia.periodo) return false;
  if (preferencia.depois_das !== null && minutos < preferencia.depois_das) return false;
  if (preferencia.antes_das !== null && minutos >= preferencia.antes_das) return false;
  if (preferencia.hora_exata !== null && minutos !== preferencia.hora_exata) return false;
  return true;
}

// Escolhe até `maximo` opções: a primeira é a mais cedo; as seguintes, de
// preferência em outro dia e outro turno (PRD 11.14: "de preferência em dias
// ou turnos diferentes").
export function escolherOpcoes(candidatos, maximo, periodos) {
  const escolhidas = [];
  const restantes = [...candidatos];
  if (restantes.length === 0 || maximo <= 0) return escolhidas;
  escolhidas.push(restantes.shift());
  const turno = (ms) => {
    const p = partesLocais(ms);
    return periodoDoMinuto(p.hora * 60 + p.minuto, periodos) ?? 'fora';
  };
  while (escolhidas.length < maximo && restantes.length > 0) {
    const dias = new Set(escolhidas.map((ms) => dataCurta(ms)));
    const turnos = new Set(escolhidas.map(turno));
    const outroDiaETurno = restantes.findIndex((ms) => !dias.has(dataCurta(ms)) && !turnos.has(turno(ms)));
    const outroDia = restantes.findIndex((ms) => !dias.has(dataCurta(ms)));
    const outroTurno = restantes.findIndex((ms) => !turnos.has(turno(ms)));
    const indice = [outroDiaETurno, outroDia, outroTurno, 0].find((i) => i >= 0);
    escolhidas.push(restantes.splice(indice, 1)[0]);
  }
  return escolhidas.sort((a, b) => a - b);
}

// Núcleo da ferramenta consultar_horarios_edilaine (modo sugerir).
//   parametros: saída de `agente.parametros_agenda()`;
//   ocupados: itens `{start, end}` do Google (todos os calendários);
//   maximo: 2 na conversa, 1 na retomada de um horário liberado.
// Devolve `{ estado: 'opcoes' | 'sem_horario', opcoes, preferencia }`.
export function calcularOpcoes({ parametros, ocupados, preferenciaTexto, agora, maximo = 2 }) {
  const agoraMs = Date.parse(agora);
  const periodos = parametros?.periodos && Object.keys(parametros.periodos).length > 0 ? parametros.periodos : PERIODOS_PADRAO;
  const preferencia = lerPreferencia(preferenciaTexto, agoraMs);
  const livres = horariosLivres({
    faixas: parametros?.faixas,
    blocoMinutos: parametros?.bloco_minutos,
    antecedenciaHoras: parametros?.antecedencia_horas,
    intervaloMinutos: parametros?.intervalo_minutos,
    janelaDias: parametros?.janela_dias,
    agoraMs,
    ocupados: intervalosOcupados(ocupados),
  });
  const compativeis = preferencia.entendida ? livres.filter((ms) => casaComPreferencia(ms, preferencia, periodos)) : livres;
  const escolhidas = escolherOpcoes(compativeis, maximo, periodos);
  const bloco = Number(parametros?.bloco_minutos);
  return {
    estado: escolhidas.length > 0 ? 'opcoes' : 'sem_horario',
    opcoes: escolhidas.map((ms) => descreverHorario(ms, bloco)),
    preferencia: { entendida: preferencia.entendida, texto: preferencia.texto },
  };
}

// Janela em que o Google é consultado para sugerir (do fim da antecedência ao
// fim da janela em dias), em ISO com deslocamento.
export function janelaDeConsulta(parametros, agora) {
  const agoraMs = Date.parse(agora);
  const inicio = agoraMs + (Number(parametros?.antecedencia_horas) || 0) * 60 * MINUTO_MS;
  const fim = agoraMs + ((Number(parametros?.janela_dias) || 0) + 1) * DIA_MS;
  return { time_min: isoLocal(Math.floor(inicio / MINUTO_MS) * MINUTO_MS), time_max: isoLocal(Math.floor(fim / MINUTO_MS) * MINUTO_MS) };
}

// Janela para conferir um horário só (com a folga entre reuniões dos dois
// lados).
export function janelaDoHorario(inicioIso, fimIso, intervaloMinutos) {
  const folga = Math.max(0, Number(intervaloMinutos) || 0) * MINUTO_MS;
  return { time_min: isoLocal(Date.parse(inicioIso) - folga), time_max: isoLocal(Date.parse(fimIso) + folga) };
}

// ---------------------------------------------------------------------------
// Evento no calendário
// ---------------------------------------------------------------------------

export function idEventoDaOpcao(idOpcao) {
  const limpo = String(idOpcao ?? '').replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(limpo) ? `${PREFIXO_EVENTO}${limpo}` : null;
}

// Marca de origem: só evento criado pela Isadora tem o prefixo no id.
export function eventoEhDaIsadora(evento) {
  const id = String(evento?.id ?? '');
  return id.startsWith(PREFIXO_EVENTO) && /^[a-v0-9]{20,1024}$/.test(id);
}

const PADRAO_EMAIL = /^[^\s@,;<>()"'\\]{1,64}@[^\s@,;<>()"'\\]+\.[A-Za-z]{2,}$/;

export function emailValido(texto) {
  const email = String(texto ?? '').trim();
  return email.length <= 254 && PADRAO_EMAIL.test(email) && !email.includes('..');
}

// E-mail da pessoa (obrigatório) e do parceiro (opcional): formato conferido
// em código antes de qualquer chamada ao Google (PRD 11.14). O e-mail do
// parceiro só entra no convite.
export function conferirEmails({ email, email_parceiro: emailParceiro }) {
  const principal = String(email ?? '').trim().toLowerCase();
  if (!emailValido(principal)) return { ok: false, erro: 'email_invalido' };
  const parceiroTexto = String(emailParceiro ?? '').trim().toLowerCase();
  if (parceiroTexto && !emailValido(parceiroTexto)) return { ok: false, erro: 'email_parceiro_invalido' };
  return { ok: true, email: principal, email_parceiro: parceiroTexto && parceiroTexto !== principal ? parceiroTexto : '' };
}

export function montarConvidados({ email, email_parceiro: emailParceiro }, parametros) {
  const lista = [email];
  if (emailParceiro) lista.push(emailParceiro);
  const leonardo = String(parametros?.leonardo_email ?? '').trim().toLowerCase();
  if (parametros?.convidar_leonardo === true && emailValido(leonardo) && !lista.includes(leonardo)) lista.push(leonardo);
  return lista;
}

function linkDoMeet(evento) {
  const direto = String(evento?.hangoutLink ?? '').trim();
  if (/^https:\/\/\S+$/.test(direto)) return direto;
  const pontos = evento?.conferenceData?.entryPoints;
  if (Array.isArray(pontos)) {
    const video = pontos.find((ponto) => ponto?.entryPointType === 'video' && /^https:\/\/\S+$/.test(String(ponto?.uri ?? '')));
    if (video) return String(video.uri);
  }
  return '';
}

function instanteDoEvento(campo) {
  return Date.parse(campo?.dateTime ?? '');
}

// O evento devolvido pelo Google só vale como reunião criada ou movida se
// voltou com id, link do Meet e o mesmo início e fim que a Isadora pediu
// (PRD 19.6 nó 13). Qualquer diferença é falha: nada é gravado no banco como
// reunião e nada é confirmado à família.
export function conferirEvento(evento, pedido) {
  if (!evento || typeof evento !== 'object' || evento.error !== undefined) return { ok: false, motivo: 'sem_evento' };
  if (typeof evento.id !== 'string' || !evento.id) return { ok: false, motivo: 'sem_id' };
  if (pedido.evento_id && evento.id !== pedido.evento_id) return { ok: false, motivo: 'id_diferente' };
  if (evento.status === 'cancelled') return { ok: false, motivo: 'cancelado' };
  const link = linkDoMeet(evento);
  if (!link && pedido.exigir_link !== false) return { ok: false, motivo: 'sem_link_meet' };
  if (instanteDoEvento(evento.start) !== Date.parse(pedido.inicio)) return { ok: false, motivo: 'inicio_diferente' };
  if (instanteDoEvento(evento.end) !== Date.parse(pedido.fim)) return { ok: false, motivo: 'fim_diferente' };
  return { ok: true, motivo: null, evento_id: evento.id, link };
}

// Situação de um evento lido para o lembrete e para a sincronização.
//   apagado: 404, 410 ou status cancelled;
//   movido: início diferente do que o banco guarda;
//   ok: igual.
export function situacaoDoEvento(leitura, sessao) {
  if (leitura && typeof leitura === 'object' && leitura.error !== undefined) {
    const erro = typeof leitura.error === 'string' ? leitura.error : JSON.stringify(leitura.error ?? '');
    const codigo = String(leitura.httpCode ?? leitura.error?.httpCode ?? leitura.error?.code ?? '');
    if (/^(404|410)$/.test(codigo) || /\b(404|410)\b|not found|could not be found|no longer available|has been deleted|\bdeleted\b/i.test(erro)) return { estado: 'apagado' };
    return { estado: 'indisponivel' };
  }
  if (!leitura || typeof leitura !== 'object' || typeof leitura.id !== 'string') return { estado: 'indisponivel' };
  if (leitura.status === 'cancelled') return { estado: 'apagado' };
  const inicio = instanteDoEvento(leitura.start);
  const fim = instanteDoEvento(leitura.end);
  if (!Number.isFinite(inicio)) return { estado: 'indisponivel' };
  const link = linkDoMeet(leitura);
  const igual = inicio === Date.parse(sessao?.inicio);
  return {
    estado: igual ? 'ok' : 'movido',
    inicio: new Date(inicio).toISOString(),
    fim: Number.isFinite(fim) ? new Date(fim).toISOString() : null,
    link,
  };
}
