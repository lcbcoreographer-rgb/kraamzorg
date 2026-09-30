// Itens 9 e 10 do validador (PRD 11.11, v4.3): horário da Edilaine e
// confirmação de reunião só com o que as ferramentas de agenda devolveram, e
// "anotar, não transferir". Função pura, embutida no nó "Validar Resposta"
// (fluxo 3, nó 28) e no "Validar" da entrada B; os testes importam a mesma.
//
// Nenhuma lista de palavras mora aqui (CLAUDE.md): os termos chegam em
// `contexto.listas` (`parametro.validador_listas`): `agenda_contexto`
// (palavras que tornam uma frase "de agenda"), `agenda_confirmacao`,
// `agenda_reserva`, `agenda_leonardo_verbos`, `agenda_depois` e
// `agenda_anotacao_termos`. Sem a lista, a regra correspondente não dispara,
// exceto a de horário citado, que só depende da forma do texto (dia da
// semana, data e hora).
//
// O que o contexto traz:
// - `agenda_horarios`: textos dos horários que valem nesta execução ("quinta,
//   01/10, às 19h"): o que as ferramentas devolveram, as opções oferecidas
//   hoje (ficha), a reunião marcada (ficha) e, na entrada B, o que o fluxo 4
//   devolveu;
// - `agenda_estados`: estados que as ferramentas de agenda devolveram nesta
//   execução (`criada`, `remarcada`, `livre`...);
// - `agenda_reuniao_marcada`: a ficha diz que existe reunião marcada;
// - `anotacao_registrada`: `anotar_para_leonardo` foi chamada nesta execução
//   (ou o sistema a grava, no caminho da reescrita).

import { normalizarTexto, contemPalavra } from './normalizar-texto.js';

const NOMES_DIA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const LIMITE_LACUNA_GRUPO = 14;

// Menções a dia da semana, data e hora num texto (normalizado).
export function mencoesDeHorario(texto) {
  const t = normalizarTexto(String(texto ?? ''));
  const achados = [];
  const coletar = (regex, tipo, ler) => {
    for (const casamento of t.matchAll(regex)) {
      const valor = ler(casamento);
      if (valor === null) continue;
      const inicio = casamento.index;
      // "às 19h": hora de relógio. "6h por visita" (duração) não é.
      const relogio = tipo === 'hora' && (/\bas\s*$/.test(t.slice(Math.max(0, inicio - 4), inicio)) || /^as\s/.test(casamento[0]) || casamento[0].includes(':'));
      achados.push({ tipo, valor, inicio, fim: inicio + casamento[0].length, relogio });
    }
  };
  coletar(new RegExp(String.raw`(?<![\p{L}\p{N}])(${NOMES_DIA.join('|')})(?:-feira)?(?![\p{L}\p{N}])`, 'gu'), 'semana', (c) => c[1]);
  coletar(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?(?![\d/])/g, 'data', (c) => {
    const dia = Number(c[1]);
    const mes = Number(c[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
  });
  coletar(/(?<![\d/:])(\d{1,2})\s*h(?:\s*(\d{2}))?(?![\p{L}\p{N}])/gu, 'hora', (c) => {
    const h = Number(c[1]);
    const m = c[2] === undefined ? 0 : Number(c[2]);
    return h <= 24 && m <= 59 ? h * 60 + m : null;
  });
  coletar(/(?<![\d/:])(\d{1,2}):(\d{2})(?![\d:])/g, 'hora', (c) => {
    const h = Number(c[1]);
    const m = Number(c[2]);
    return h <= 24 && m <= 59 ? h * 60 + m : null;
  });
  coletar(/\bas\s+(\d{1,2})\s*horas?\b/g, 'hora', (c) => (Number(c[1]) <= 24 ? Number(c[1]) * 60 : null));
  return achados.sort((a, b) => a.inicio - b.inicio);
}

// Menções vizinhas ("quinta, 01/10, às 19h") formam um horário só.
export function gruposDeHorario(texto) {
  const t = normalizarTexto(String(texto ?? ''));
  const grupos = [];
  let atual = null;
  for (const mencao of mencoesDeHorario(texto)) {
    const lacuna = atual ? t.slice(atual.fim, mencao.inicio) : '';
    if (!atual || lacuna.length > LIMITE_LACUNA_GRUPO || /[.!?\n]|\bou\b|\be\b/.test(lacuna)) {
      atual = { semanas: [], datas: [], horas: [], relogio: false, inicio: mencao.inicio, fim: mencao.fim };
      grupos.push(atual);
    }
    if (mencao.tipo === 'semana') atual.semanas.push(mencao.valor);
    else if (mencao.tipo === 'data') atual.datas.push(mencao.valor);
    else {
      atual.horas.push(mencao.valor);
      if (mencao.relogio) atual.relogio = true;
    }
    atual.fim = mencao.fim;
  }
  return grupos;
}

function fatiaDoHorarioPermitido(texto) {
  const [grupo] = gruposDeHorario(texto);
  return grupo ?? null;
}

// O grupo citado bate com algum horário permitido? Todos os elementos do grupo
// (dia da semana, data e hora) têm de ser do mesmo horário.
function grupoBateComAlgum(grupo, permitidos) {
  return permitidos.some((permitido) => {
    if (grupo.semanas.length > 0 && !grupo.semanas.every((s) => permitido.semanas.includes(s))) return false;
    if (grupo.datas.length > 0 && !grupo.datas.every((d) => permitido.datas.includes(d))) return false;
    if (grupo.horas.length > 0 && !grupo.horas.every((h) => permitido.horas.includes(h))) return false;
    return true;
  });
}

function divididoEmFrases(texto) {
  return String(texto ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

function listaDe(listas, nome) {
  return Array.isArray(listas?.[nome]) ? listas[nome].filter((item) => typeof item === 'string' && item.trim()) : [];
}

function algumTermo(texto, termos) {
  return termos.some((termo) => contemPalavra(texto, termo));
}

const NEGACOES_DA_AGENDA = ['nao', 'nunca', 'ainda', 'sem'];

function negadoAntes(fraseNormalizada, termo) {
  const posicao = fraseNormalizada.indexOf(normalizarTexto(termo));
  if (posicao < 0) return false;
  const palavras = fraseNormalizada.slice(0, posicao).split(/\s+/).filter(Boolean).slice(-3);
  return palavras.some((palavra) => NEGACOES_DA_AGENDA.includes(palavra));
}

export const REGRAS_DE_AGENDA = [
  'horario_nao_consultado',
  'confirmacao_sem_evento',
  'vaga_reservada',
  'promessa_do_leonardo',
  'anotacao_ausente',
];

export function conferirAgenda(texto, contexto = {}) {
  const violacoes = [];
  const listas = contexto.listas ?? {};
  const estados = Array.isArray(contexto.agenda_estados) ? contexto.agenda_estados : [];
  const permitidos = (Array.isArray(contexto.agenda_horarios) ? contexto.agenda_horarios : [])
    .map(fatiaDoHorarioPermitido)
    .filter(Boolean);
  const termosContexto = listaDe(listas, 'agenda_contexto');
  const frases = divididoEmFrases(texto);

  // Item 9, horário citado: precisa constar no retorno das ferramentas desta
  // execução (ou na ficha). Um grupo com hora ou data é horário de reunião
  // quando traz dia da semana ou data, ou quando a frase é de agenda.
  for (const frase of frases) {
    const contextoDaFrase = termosContexto.length === 0 ? true : algumTermo(frase, termosContexto);
    for (const grupo of gruposDeHorario(frase)) {
      if (grupo.horas.length === 0 && grupo.datas.length === 0) continue;
      const claro = grupo.semanas.length > 0 || grupo.datas.length > 0 || (grupo.relogio && contextoDaFrase);
      if (!claro) continue;
      if (!grupoBateComAlgum(grupo, permitidos)) {
        violacoes.push({
          regra: 'horario_nao_consultado',
          detalhe: `horário citado que nenhuma consulta de agenda desta conversa devolveu: "${frase}"`,
        });
      }
    }
  }

  // Item 9, confirmação: só com o evento criado ou movido nesta execução (ou
  // reunião já marcada na ficha).
  const confirmou = estados.includes('criada') || estados.includes('remarcada') || contexto.agenda_reuniao_marcada === true;
  const termosConfirmacao = listaDe(listas, 'agenda_confirmacao');
  if (!confirmou && termosConfirmacao.length > 0 && termosContexto.length > 0) {
    for (const frase of frases) {
      if (frase.includes('?')) continue;
      const normalizada = normalizarTexto(frase);
      const termo = termosConfirmacao.find((item) => contemPalavra(frase, item) && !negadoAntes(normalizada, item));
      if (termo && algumTermo(frase, termosContexto)) {
        violacoes.push({
          regra: 'confirmacao_sem_evento',
          detalhe: `confirma reunião ("${termo}") sem que agendar_reuniao ou remarcar_reuniao tenha devolvido criada ou remarcada: "${frase}"`,
        });
      }
    }
  }

  // Item 9, vaga: a reunião não reserva o atendimento em casa.
  for (const termo of listaDe(listas, 'agenda_reserva')) {
    if (contemPalavra(texto, termo)) {
      violacoes.push({ regra: 'vaga_reservada', detalhe: `diz que a vaga está reservada por causa da reunião: "${termo}"` });
    }
  }

  // Item 10: promessa de retorno do Leonardo antes da reunião e anotação
  // obrigatória quando a resposta manda o assunto para depois da reunião.
  const depois = listaDe(listas, 'agenda_depois');
  const verbos = listaDe(listas, 'agenda_leonardo_verbos');
  const termosAnotacao = listaDe(listas, 'agenda_anotacao_termos').concat(listaDe(listas, 'palavras_condicao'));
  for (const frase of frases) {
    if (!contemPalavra(frase, 'leonardo')) continue;
    const mandouParaDepois = depois.length > 0 && algumTermo(frase, depois);
    if (algumTermo(frase, verbos) && !mandouParaDepois) {
      violacoes.push({ regra: 'promessa_do_leonardo', detalhe: `promete retorno do Leonardo antes da reunião: "${frase}"` });
    }
    if (mandouParaDepois && algumTermo(frase, termosAnotacao) && contexto.anotacao_registrada !== true) {
      violacoes.push({
        regra: 'anotacao_ausente',
        detalhe: `diz que o Leonardo trata do assunto depois da reunião sem anotar para ele: "${frase}"`,
      });
    }
  }

  return violacoes;
}
