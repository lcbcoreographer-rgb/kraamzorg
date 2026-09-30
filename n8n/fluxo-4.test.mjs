// Testes do fluxo 4 "Agenda da Isadora" (PRD 11.14 e 19.6 v4.3, P25b). Duas
// camadas:
// 1. O JSON gerado pelo build rodando no simulador com um Google Calendar de
//    mentira (`src/lib/calendario-simulado.mjs`) e um banco de mentira que
//    guarda só o que a agenda usa. Cada regra da seção 3 do Treinamento da
//    Isadora v3 ("Regras da agenda") tem um teste aqui; o banco de verdade
//    (opções que só valem no dia, opção conferida, sessão da Isadora) é
//    provado em supabase/tests/028_agenda_isadora.sql e no roteiro local do
//    P28 (tests/agente/local), que roda o mesmo fluxo sobre o Postgres.
// 2. A estrutura do JSON: credencial do Google só no fluxo 4, nó do Google
//    Calendar com parâmetros que o nó do n8n 2.40.6 conhece, nenhum id de
//    evento vindo do modelo.
//
// O relógio é controlado (`mock.timers`): os nós Code leem `new Date()`.
// Nenhum dado real: e-mails, jids e ids são fictícios.

import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarFluxos } from './build.mjs';
import { carregarConfig } from './src/lib/config.mjs';
import { simularFluxo } from './src/lib/simulador.mjs';
import { criarCalendarioSimulado } from './src/lib/calendario-simulado.mjs';
import { executarTodosOsValidadoresEstruturais, codeCompila } from './src/lib/validadores.mjs';
import { NOS, ENTRADAS } from './src/fluxo-4-agenda-isadora.mjs';
import { descreverHorario, textoDoHorario, idEventoDaOpcao, lerPreferencia, conferirEmails } from './src/code/agenda.js';
import { conferirAgenda } from './src/code/agenda-validador.js';
import { validarResposta } from './src/code/validar-resposta.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CONVERSA = '33333333-3333-4333-8333-333333333333';
const CALENDARIO = 'EXEMPLO-calendario-reuniao-inicial@group.calendar.google.invalid';
const GRUPO = '000000000000-0000000001@g.us';

// Quinta-feira 01/10/2026, 15h em São Paulo.
const AGORA = Date.parse('2026-10-01T15:00:00-03:00');
const HORA = 3600 * 1000;
const DIA = 24 * HORA;

const PARAMETROS = {
  ok: true,
  configurada: true,
  fuso: 'America/Sao_Paulo',
  bloco_minutos: 30,
  faixas: {
    seg: [['09:00', '12:00'], ['14:00', '18:00']],
    ter: [['09:00', '12:00'], ['14:00', '18:00']],
    qua: [['09:00', '12:00'], ['14:00', '18:00']],
    qui: [['09:00', '12:00'], ['14:00', '18:00']],
    sex: [['09:00', '12:00'], ['14:00', '18:00']],
    sab: [['09:00', '12:00']],
  },
  periodos: {},
  antecedencia_horas: 23,
  intervalo_minutos: 0,
  janela_dias: 14,
  titulo_evento: 'Reunião inicial Kraamzorg',
  descricao_evento: 'Conversa de 30 minutos com a Edilaine.',
  convidar_leonardo: false,
  leonardo_email: null,
  lembrete_hora: '18:00',
  janela_envio: null,
  cadencia_dias: [1, 3, 14],
};

async function configExemplo() {
  const { config } = await carregarConfig('hml', AQUI, { log: () => {} });
  return config;
}

async function fluxo4() {
  return gerarFluxos(await configExemplo(), 'hml').fluxo4;
}

// ---------------------------------------------------------------------------
// Banco de mentira: só as funções da agenda, com as regras que o fluxo lê
// ---------------------------------------------------------------------------

function fimDoDia(ms) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
  return Date.parse(`${p}T23:59:59-03:00`);
}

function criarBanco(opcoes = {}) {
  const estado = {
    chamadas: [],
    opcoes: new Map(),
    sessao: opcoes.sessao ?? null,
    consultas: [],
    contador: 0,
  };
  const parametros = opcoes.parametros ?? PARAMETROS;
  const novoId = () => {
    estado.contador += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(estado.contador).padStart(12, '0')}`;
  };
  const texto = (inicio) => ({
    dia_semana: descreverHorario(inicio, 30).dia_semana,
    data: descreverHorario(inicio, 30).data,
    hora: descreverHorario(inicio, 30).hora,
    texto: textoDoHorario(inicio),
  });

  const opcaoValida = (idOpcao) => {
    const opcao = estado.opcoes.get(idOpcao);
    if (!opcao) return { ok: false, erro: 'inexistente' };
    if (opcao.usada) return { ok: false, erro: 'usada' };
    if (opcao.descartada) return { ok: false, erro: 'descartada' };
    if (Date.now() > opcao.valida_ate) return { ok: false, erro: 'expirada' };
    if (opcao.inicio <= Date.now()) return { ok: false, erro: 'expirada' };
    if (opcao.inicio < opcao.consultada_em + parametros.antecedencia_horas * HORA) return { ok: false, erro: 'antecedencia' };
    return { ok: true, opcao };
  };

  const funcoes = {
    parametros_agenda: () => parametros,
    registrar_opcoes_horario: (conversa, inicios, consultadaEm) => {
      const lista = JSON.parse(inicios);
      for (const opcao of estado.opcoes.values()) if (!opcao.usada && !opcao.escolhida) opcao.descartada = true;
      const saida = lista.map((iso) => {
        const inicio = Date.parse(iso);
        const id = novoId();
        estado.opcoes.set(id, { id, inicio, fim: inicio + 30 * 60000, consultada_em: Date.parse(consultadaEm), valida_ate: fimDoDia(Date.parse(consultadaEm)) });
        return { id_opcao: id, inicio: new Date(inicio).toISOString(), ...texto(inicio) };
      });
      return { ok: true, opcoes: saida, valida_ate: new Date(fimDoDia(Date.parse(consultadaEm))).toISOString(), consultada_em: consultadaEm };
    },
    validar_opcao_horario: (conversa, idOpcao) => {
      const v = opcaoValida(idOpcao);
      if (!v.ok) return v;
      return { ok: true, id_opcao: idOpcao, inicio: new Date(v.opcao.inicio).toISOString(), fim: new Date(v.opcao.fim).toISOString(), ...texto(v.opcao.inicio) };
    },
    registrar_conferencia_horario: (conversa, idOpcao, livre) => {
      const v = opcaoValida(idOpcao);
      if (!v.ok) return v;
      if (livre === true || livre === 'true') {
        v.opcao.conferida = true;
        return { ok: true, estado: 'livre', id_opcao: idOpcao, ...texto(v.opcao.inicio) };
      }
      v.opcao.descartada = true;
      return { ok: true, estado: 'ocupado' };
    },
    reuniao_da_conversa: () => {
      const s = estado.sessao;
      if (!s || s.status === 'cancelada') return { ok: true, existe: false };
      return {
        ok: true,
        existe: true,
        sessao_id: s.sessao_id,
        agendada_por: s.agendada_por,
        evento_id: s.agendada_por === 'isadora' ? s.evento_id : undefined,
        status: s.status,
        inicio: new Date(s.inicio).toISOString(),
        fim: new Date(s.inicio + 30 * 60000).toISOString(),
        link: s.link,
        ...texto(s.inicio),
      };
    },
    registrar_reuniao: (conversa, idOpcao, eventoId, link, email, emailParceiro) => {
      const v = opcaoValida(idOpcao);
      if (!v.ok) return v;
      if (!v.opcao.conferida) return { ok: false, erro: 'opcao_nao_conferida' };
      v.opcao.usada = true;
      estado.sessao = { sessao_id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', agendada_por: 'isadora', evento_id: eventoId, status: 'agendada', inicio: v.opcao.inicio, link };
      estado.email = email;
      estado.emailParceiro = emailParceiro;
      return { ok: true, duplicado: false, sessao_id: estado.sessao.sessao_id, ...texto(v.opcao.inicio), link, mensagem_grupo: '[aviso: reunião agendada]', grupo_jid: GRUPO };
    },
    registrar_remarcacao: (conversa, dadosJson) => {
      const dados = JSON.parse(dadosJson);
      const v = opcaoValida(dados.id_opcao);
      if (!v.ok) return v;
      if (!v.opcao.conferida) return { ok: false, erro: 'opcao_nao_conferida' };
      v.opcao.usada = true;
      estado.sessao = { ...estado.sessao, inicio: v.opcao.inicio, link: dados.link || estado.sessao.link };
      return { ok: true, duplicado: false, sessao_id: estado.sessao.sessao_id, ...texto(v.opcao.inicio), link: estado.sessao.link };
    },
    registrar_cancelamento: () => {
      estado.sessao = { ...estado.sessao, status: 'cancelada' };
      return { ok: true, sessao_id: estado.sessao.sessao_id };
    },
    registrar_consulta_equipe: (conversa, tipo, pergunta, preferenciaJson) => {
      const consulta = { consulta_id: novoId(), tipo, pergunta, preferencia: JSON.parse(preferenciaJson) };
      estado.consultas.push(consulta);
      return {
        ok: true,
        duplicado: false,
        consulta_id: consulta.consulta_id,
        destino: 'coordenacao',
        mensagem_grupo: '[aviso: consulta da Isadora]',
        grupo_jid: GRUPO,
        instrucao_agente: '[instrução: diga que vai conferir com a equipe e volta por aqui]',
      };
    },
    fechar_consulta: () => ({ ok: true }),
    sincronizar_reuniao: (sessaoId, inicio, fim, status, link) => {
      estado.sincronizacoes ??= [];
      estado.sincronizacoes.push({ sessaoId, inicio, fim, status, link });
      if (status === 'apagada') estado.sessao = { ...estado.sessao, status: 'cancelada' };
      if (status === 'movida') estado.sessao = { ...estado.sessao, inicio: Date.parse(inicio) };
      return { ok: true, alterada: true, status };
    },
    sessoes_para_sincronizar: () => ({
      ok: true,
      itens: estado.sessao && estado.sessao.status === 'agendada' && estado.sessao.agendada_por === 'isadora'
        ? [{ sessao_id: estado.sessao.sessao_id, evento_id: estado.sessao.evento_id, inicio: new Date(estado.sessao.inicio).toISOString(), fim: new Date(estado.sessao.inicio + 30 * 60000).toISOString(), link: estado.sessao.link }]
        : [],
    }),
  };

  const postgres = (parametrosNo) => {
    const funcao = /agente\.(\w+)\(/.exec(parametrosNo.query)[1];
    const argumentos = parametrosNo.options.queryReplacement ?? [];
    estado.chamadas.push({ funcao, argumentos });
    if (opcoes.falhas?.has(funcao)) throw new Error(`connect ECONNREFUSED (${funcao})`);
    return [{ resultado: funcoes[funcao](...argumentos) }];
  };
  return { estado, postgres, chamadas: (funcao) => estado.chamadas.filter((c) => c.funcao === funcao) };
}

// ---------------------------------------------------------------------------
// Ambiente: fluxo + calendário + banco
// ---------------------------------------------------------------------------

function criarAmbiente(fluxo, opcoes = {}) {
  const calendario = criarCalendarioSimulado();
  const banco = criarBanco(opcoes);
  const avisos = [];
  const semLinkNaCriacao = opcoes.semLinkNaCriacao === true;
  const servicos = {};
  for (const no of fluxo.nodes) {
    if (no.type === 'n8n-nodes-base.postgres') servicos[no.name] = banco.postgres;
    else if (no.type === 'n8n-nodes-base.googleCalendar') {
      servicos[no.name] = (parametros) => {
        const resposta = calendario.executarNoGoogle(parametros);
        if (semLinkNaCriacao && parametros.operation === 'create') {
          const { hangoutLink, conferenceData, ...resto } = resposta;
          return resto;
        }
        return resposta;
      };
    } else if (no.type === 'n8n-nodes-base.httpRequest') {
      servicos[no.name] = (parametros) => {
        avisos.push({ url: parametros.url, ...parametros.jsonBody });
        return { messageid: 'wa-1' };
      };
    }
  }
  return { calendario, banco, avisos, servicos };
}

function chamarFerramenta(fluxo, ambiente, entrada) {
  const completa = { operacao: '', modo: '', conversa_id: CONVERSA, id_opcao: '', preferencia: '', email: '', email_parceiro: '', motivo: '', tipo: '', pergunta: '', maximo: 2, ...entrada };
  const execucao = simularFluxo(fluxo, { entrada: completa, servicos: ambiente.servicos });
  return { resposta: execucao.saida[0], execucao };
}

const sugerir = (fluxo, ambiente, preferencia = '') => chamarFerramenta(fluxo, ambiente, { operacao: 'consultar', modo: 'sugerir', preferencia });
const conferir = (fluxo, ambiente, idOpcao) => chamarFerramenta(fluxo, ambiente, { operacao: 'consultar', modo: 'conferir', id_opcao: idOpcao });
const agendar = (fluxo, ambiente, idOpcao, extra = {}) =>
  chamarFerramenta(fluxo, ambiente, { operacao: 'agendar', id_opcao: idOpcao, email: 'carla@exemplo.invalid', ...extra });

const operacoes = (ambiente) => ambiente.calendario.chamadas.map((c) => c.operacao);

// Ativa o relógio falso (Date) para os nós Code e o banco falso. Chamado
// dentro de cada describe: um gancho na raiz valeria para todos os testes de
// quem importa este arquivo (build.test.mjs).
function relogioFalso() {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: AGORA }));
  afterEach(() => mock.timers.reset());
}

// Entre uma chamada e outra, o tempo anda.
function avancar(ms) {
  mock.timers.tick(ms);
}

// Marca a Edilaine ocupando um horário no calendário.
function ocupar(ambiente, inicioMs) {
  ambiente.calendario.ocupar(CALENDARIO, new Date(inicioMs).toISOString(), new Date(inicioMs + 30 * 60000).toISOString());
}

// ---------------------------------------------------------------------------
// Regras da agenda (Treinamento v3, seção 3)
// ---------------------------------------------------------------------------

describe('regra: a família demonstrou interesse na reunião', () => {
  relogioFalso();
  test('consulta o Google Calendar naquele momento e sugere 2 opções de 30 minutos, em dias ou turnos diferentes, respeitando a antecedência', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta } = sugerir(fluxo, ambiente);

    assert.equal(resposta.estado, 'opcoes');
    assert.equal(resposta.opcoes.length, 2);
    assert.ok(operacoes(ambiente).includes('livre-ocupado'), 'a agenda foi consultada antes de sugerir');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0, 'sugerir não cria nada');

    const [primeira, segunda] = resposta.opcoes;
    assert.equal(primeira.texto, 'sexta, 02/10, às 14h', 'a primeira é a mais cedo depois da antecedência mínima');
    assert.equal(segunda.texto, 'sábado, 03/10, às 9h', 'a segunda vem de outro dia e de outro turno');
    for (const opcao of resposta.opcoes) {
      const inicio = ambiente.banco.estado.opcoes.get(opcao.id_opcao);
      assert.ok(inicio.inicio - AGORA >= 23 * HORA, 'antecedência mínima do parâmetro');
      assert.equal(inicio.fim - inicio.inicio, 30 * 60000, 'bloco de 30 minutos do parâmetro');
    }
    assert.equal(ambiente.banco.chamadas('registrar_opcoes_horario').length, 1, 'as opções ficam gravadas com a data do dia');
  });

  test('horário ocupado na agenda nunca é oferecido', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    ocupar(ambiente, Date.parse('2026-10-02T14:00:00-03:00'));
    ocupar(ambiente, Date.parse('2026-10-03T09:00:00-03:00'));
    const { resposta } = sugerir(fluxo, ambiente);
    const textos = resposta.opcoes.map((o) => o.texto);
    assert.ok(!textos.includes('sexta, 02/10, às 14h'));
    assert.ok(!textos.includes('sábado, 03/10, às 9h'));
    assert.equal(resposta.opcoes.length, 2);
  });

  test('o retorno ao modelo não leva id de evento, de calendário, de sessão nem de conversa', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta } = sugerir(fluxo, ambiente);
    const texto = JSON.stringify(resposta);
    assert.ok(!texto.includes(CALENDARIO));
    assert.ok(!texto.includes(CONVERSA));
    assert.ok(!/evento_id|sessao_id|calendar_id|conversa_id/.test(texto));
  });
});

describe('regra: a família escolheu uma opção no mesmo dia', () => {
  relogioFalso();
  test('consulta a agenda de novo antes de responder; livre: confere, pede o e-mail (agendar) e só então cria', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    const consultasAntes = ambiente.calendario.chamadasDe('livre-ocupado').length;
    avancar(20 * 60000);

    const { resposta: conferida } = conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(conferida.estado, 'livre', JSON.stringify(conferida));
    assert.equal(conferida.texto, opcoes.opcoes[0].texto);
    assert.equal(
      ambiente.calendario.chamadasDe('livre-ocupado').length,
      consultasAntes + 1,
      'na escolha a agenda é consultada de novo (segunda consulta)',
    );
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0, 'conferir não cria evento');
  });

  test('ao criar, consulta a agenda uma última vez e só devolve "criada" depois do evento criado, com Meet e convidados', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(20 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    const consultasAntes = ambiente.calendario.chamadasDe('livre-ocupado').length;

    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao, { email_parceiro: 'parceiro@exemplo.invalid' });
    assert.equal(resposta.estado, 'criada');
    assert.equal(resposta.texto, opcoes.opcoes[0].texto);
    assert.match(resposta.link, /^https:\/\/meet\.google\.com\//);

    const ordem = operacoes(ambiente);
    const ultimaConsulta = ordem.lastIndexOf('livre-ocupado');
    assert.ok(ordem.indexOf('criar') > ultimaConsulta, 'a consulta final vem antes de criar');
    assert.ok(ambiente.calendario.chamadasDe('livre-ocupado').length > consultasAntes);

    const [criacao] = ambiente.calendario.chamadasDe('criar');
    assert.equal(criacao.comMeet, true, 'evento com Google Meet');
    assert.deepEqual(criacao.attendees, ['carla@exemplo.invalid', 'parceiro@exemplo.invalid']);
    assert.equal(criacao.sendUpdates, 'all', 'o Google envia o convite');
    assert.equal(Date.parse(criacao.end) - Date.parse(criacao.start), 30 * 60000);
    assert.ok(String(criacao.id).startsWith('kraam'), 'o id do evento leva a marca da Isadora');

    const ordemBanco = ambiente.banco.estado.chamadas.map((c) => c.funcao);
    assert.ok(ordemBanco.indexOf('registrar_reuniao') > -1);
    assert.equal(ambiente.banco.estado.sessao.status, 'agendada');
    assert.equal(ambiente.banco.estado.email, 'carla@exemplo.invalid');
    assert.equal(ambiente.avisos.length, 1, 'o grupo da equipe é avisado da reunião agendada');
    assert.equal(ambiente.avisos[0].number, GRUPO);
    const texto = JSON.stringify(resposta);
    assert.ok(!/evento_id|sessao_id|calendar_id|conversa_id|kraam[0-9a-v]{20}/.test(texto), 'nada de id no retorno');
  });

  test('horário ocupado entre a sugestão e a escolha: devolve "ocupado" com 2 opções novas, consultadas agora', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(30 * 60000);
    ocupar(ambiente, Date.parse('2026-10-02T14:00:00-03:00'));

    const { resposta } = conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'ocupado');
    assert.equal(resposta.opcoes.length, 2);
    assert.ok(!resposta.opcoes.some((o) => o.texto === opcoes.opcoes[0].texto), 'o horário ocupado não volta');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0);
    // a opção antiga foi descartada no banco: escolher a mesma de novo é recusado
    const { resposta: denovo } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(denovo.estado, 'invalida');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0);
  });

  test('ocupado na última consulta, feita ao agendar: não cria evento e não confirma', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    ocupar(ambiente, Date.parse('2026-10-02T14:00:00-03:00'));

    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.notEqual(resposta.estado, 'criada');
    assert.equal(resposta.estado, 'ocupado');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0);
    assert.equal(ambiente.banco.chamadas('registrar_reuniao').length, 0);
    assert.equal(ambiente.banco.estado.sessao, null);
  });
});

describe('regra: a família respondeu em outro dia', () => {
  relogioFalso();
  test('as opções valem só para o dia em que foram sugeridas: no dia seguinte a escolha é recusada sem tocar no calendário', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(DIA);
    const chamadasAntes = ambiente.calendario.chamadas.length;

    const { resposta } = conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'invalida');
    assert.equal(resposta.erro, 'expirada');
    assert.equal(ambiente.calendario.chamadas.length, chamadasAntes, 'nem consulta o calendário com opção vencida');
    const { resposta: tentativa } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(tentativa.estado, 'invalida');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0);
  });

  test('a Isadora consulta de novo e, se o horário escolhido ainda está livre, agenda; senão oferece novas opções', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    sugerir(fluxo, ambiente);
    avancar(DIA);
    const consultasAntes = ambiente.calendario.chamadasDe('livre-ocupado').length;
    const { resposta: novas } = sugerir(fluxo, ambiente, 'sábado de manhã');
    assert.equal(novas.estado, 'opcoes');
    assert.ok(ambiente.calendario.chamadasDe('livre-ocupado').length > consultasAntes, 'consulta nova, nunca a de ontem');
    assert.ok(novas.opcoes.every((o) => /^sábado/.test(o.texto) && /às (9|10|11)h/.test(o.texto)), 'respeita a preferência contada');
    avancar(10 * 60000);
    const { resposta: livre } = conferir(fluxo, ambiente, novas.opcoes[0].id_opcao);
    assert.equal(livre.estado, 'livre');
    const { resposta: criada } = agendar(fluxo, ambiente, novas.opcoes[0].id_opcao);
    assert.equal(criada.estado, 'criada');
  });
});

describe('regra: a família não respondeu às opções (retomada no dia seguinte)', () => {
  relogioFalso();
  test('a retomada consulta a agenda de novo e nunca repete o horário de ontem sem checar', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: ontem } = sugerir(fluxo, ambiente);
    avancar(DIA);
    // A Edilaine ocupou o primeiro horário de ontem.
    ocupar(ambiente, Date.parse('2026-10-02T14:00:00-03:00'));
    const consultasAntes = ambiente.calendario.chamadasDe('livre-ocupado').length;
    const { resposta: hoje } = chamarFerramenta(fluxo, ambiente, { operacao: 'consultar', modo: 'sugerir', maximo: 2 });
    assert.equal(hoje.estado, 'opcoes');
    assert.ok(ambiente.calendario.chamadasDe('livre-ocupado').length > consultasAntes);
    assert.ok(!hoje.opcoes.some((o) => o.texto === ontem.opcoes[0].texto), 'o horário ocupado de ontem não volta');
    assert.ok(hoje.opcoes.every((o) => o.id_opcao !== ontem.opcoes[0].id_opcao && o.id_opcao !== ontem.opcoes[1].id_opcao), 'opções novas, com ids novos');
    const antigas = [...ambiente.banco.estado.opcoes.values()].filter((o) => ontem.opcoes.some((x) => x.id_opcao === o.id));
    assert.ok(antigas.every((o) => o.descartada), 'as de ontem foram descartadas no banco');
  });

  test('maximo 1 (horário liberado pela Edilaine): devolve uma opção só', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta } = chamarFerramenta(fluxo, ambiente, { operacao: 'consultar', modo: 'sugerir', maximo: 1 });
    assert.equal(resposta.opcoes.length, 1);
  });
});

describe('regra: nenhum horário serve', () => {
  relogioFalso();
  test('com a preferência da família e um horário compatível, oferece; sem compatível, avisa a Edilaine (sem transferir) e devolve sem_horario', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: compativel } = sugerir(fluxo, ambiente, 'quartas à tarde');
    assert.equal(compativel.estado, 'opcoes');
    assert.ok(compativel.opcoes.every((o) => /^quarta/.test(o.texto)));

    const ambiente2 = criarAmbiente(fluxo);
    const { resposta } = sugerir(fluxo, ambiente2, 'domingo à noite');
    assert.equal(resposta.estado, 'sem_horario');
    assert.deepEqual(resposta.opcoes ?? [], []);
    const [consulta] = ambiente2.banco.estado.consultas;
    assert.equal(consulta.tipo, 'horario_edilaine', 'a Edilaine é consultada');
    assert.match(consulta.pergunta, /domingo/);
    assert.equal(ambiente2.avisos.length, 1, 'o grupo é avisado');
    assert.ok(resposta.instrucao, 'a instrução do banco chega ao modelo');
    const funcoes = ambiente2.banco.estado.chamadas.map((c) => c.funcao);
    assert.ok(!funcoes.some((f) => /handoff|transferir/.test(f)), 'a conversa não é transferida');
  });

  test('agenda sem faixa configurada: sem_horario e consulta à Edilaine, sem chamar o Google', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, { parametros: { ...PARAMETROS, configurada: false, faixas: {} } });
    const { resposta } = sugerir(fluxo, ambiente);
    assert.equal(resposta.estado, 'sem_horario');
    assert.equal(ambiente.calendario.chamadas.length, 0);
    assert.equal(ambiente.banco.estado.consultas.length, 1);
  });

  test('a preferência é lida em código: dia da semana, período, hora e "depois das 20h"', () => {
    const agora = AGORA;
    assert.deepEqual(lerPreferencia('sábado de manhã', agora).dias_semana, ['sab']);
    assert.equal(lerPreferencia('sábado de manhã', agora).periodo, 'manha');
    assert.equal(lerPreferencia('depois das 20h', agora).depois_das, 20 * 60);
    assert.equal(lerPreferencia('quarta às 20h', agora).hora_exata, 20 * 60);
    assert.equal(lerPreferencia('qualquer coisa', agora).entendida, false);
  });
});

describe('regra: só confirma com o evento criado', () => {
  relogioFalso();
  test('falha do Google ao criar: não devolve "criada", não grava reunião, abre a consulta à equipe', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    ambiente.calendario.falharProxima('criar', 'Service Unavailable', 503);
    ambiente.calendario.falharProxima('obter', 'The resource you are requesting could not be found', 404);

    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'indisponivel');
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 0);
    assert.equal(ambiente.banco.chamadas('registrar_reuniao').length, 0);
    assert.equal(ambiente.banco.estado.sessao, null);
    assert.equal(ambiente.banco.estado.consultas[0].tipo, 'horario_edilaine');
    assert.equal(ambiente.avisos.length, 1, 'a equipe é avisada da falha');
  });

  test('o Google criou mas a resposta se perdeu: o evento é recuperado pelo id e a reunião é registrada', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    const criarOriginal = ambiente.calendario.executarNoGoogle;
    let perdeu = false;
    for (const no of fluxo.nodes.filter((n) => n.type === 'n8n-nodes-base.googleCalendar' && n.parameters.operation === 'create')) {
      const original = ambiente.servicos[no.name];
      ambiente.servicos[no.name] = (parametros) => {
        original(parametros);
        if (!perdeu) {
          perdeu = true;
          throw new Error('socket hang up');
        }
        return {};
      };
    }
    void criarOriginal;
    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'criada');
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 1, 'um evento só');
    assert.equal(ambiente.banco.chamadas('registrar_reuniao').length, 1);
  });

  test('Meet ainda pendente na resposta da criação: lê o evento de novo e só confirma com o link', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, { semLinkNaCriacao: true });
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'criada');
    assert.match(resposta.link, /^https:\/\/meet\.google\.com\//);
    assert.equal(ambiente.calendario.chamadasDe('obter').length, 1);
  });

  test('evento sem link do Meet mesmo depois de lido: o evento é apagado, nada é gravado e nada é confirmado', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    for (const no of fluxo.nodes.filter((n) => n.type === 'n8n-nodes-base.googleCalendar')) {
      const original = ambiente.servicos[no.name];
      ambiente.servicos[no.name] = (parametros) => {
        const evento = original(parametros);
        if (['create', 'get'].includes(parametros.operation) && evento?.id) {
          const { hangoutLink, conferenceData, ...resto } = evento;
          return resto;
        }
        return evento;
      };
    }
    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.notEqual(resposta.estado, 'criada');
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 0, 'evento sem Meet foi apagado');
    assert.equal(ambiente.banco.chamadas('registrar_reuniao').length, 0);
  });

  test('banco fora do ar depois de criar o evento: o evento é apagado (compensação) e nada é confirmado', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, { falhas: new Set(['registrar_reuniao']) });
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    assert.notEqual(resposta.estado, 'criada');
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 0);
    assert.equal(ambiente.calendario.chamadasDe('excluir').length, 1);
  });

  test('Google fora do ar ao sugerir: indisponivel, sem inventar horário, com a equipe avisada', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    ambiente.calendario.ficarForaDoAr();
    const { resposta } = sugerir(fluxo, ambiente);
    assert.equal(resposta.estado, 'indisponivel');
    assert.equal(resposta.opcoes, undefined);
    assert.equal(ambiente.banco.chamadas('registrar_opcoes_horario').length, 0);
    assert.equal(ambiente.banco.estado.consultas.length, 1);
  });
});

describe('e-mail: o único dado pedido', () => {
  relogioFalso();
  test('e-mail inválido não chega ao Google; e-mail do parceiro só entra no convite (nunca no banco)', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo);
    const { resposta: opcoes } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, opcoes.opcoes[0].id_opcao);
    const { resposta: ruim } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao, { email: 'carla arroba exemplo' });
    assert.equal(ruim.estado, 'email_invalido');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 0);

    const { resposta } = agendar(fluxo, ambiente, opcoes.opcoes[0].id_opcao, { email_parceiro: 'parceiro@exemplo.invalid' });
    assert.equal(resposta.estado, 'criada');
    const chamada = ambiente.banco.chamadas('registrar_reuniao')[0];
    assert.equal(chamada.argumentos[4], 'carla@exemplo.invalid');
    assert.ok(!JSON.stringify(ambiente.banco.estado.chamadas.map((c) => c.argumentos)).includes('parceiro@exemplo.invalid') || chamada.argumentos[5] === 'parceiro@exemplo.invalid');
  });

  test('conferirEmails: formato conferido em código, parceiro igual à pessoa vira vazio', () => {
    assert.equal(conferirEmails({ email: 'a@b.co' }).ok, true);
    assert.equal(conferirEmails({ email: 'a@b' }).ok, false);
    assert.equal(conferirEmails({ email: 'a@b.co', email_parceiro: 'ruim' }).erro, 'email_parceiro_invalido');
    assert.equal(conferirEmails({ email: 'a@b.co', email_parceiro: 'A@B.co' }).email_parceiro, '');
  });
});

describe('remarcar, cancelar e a véspera', () => {
  relogioFalso();
  async function comReuniaoMarcada(opcoes = {}) {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, opcoes);
    const { resposta: sugestao } = sugerir(fluxo, ambiente);
    avancar(10 * 60000);
    conferir(fluxo, ambiente, sugestao.opcoes[0].id_opcao);
    const { resposta } = agendar(fluxo, ambiente, sugestao.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'criada');
    return { fluxo, ambiente, marcada: resposta };
  }

  test('remarcar: consulta, oferece 2 opções, confere na escolha, move o evento e só confirma o novo horário depois de movido', async () => {
    const { fluxo, ambiente, marcada } = await comReuniaoMarcada();
    const { resposta: novas } = sugerir(fluxo, ambiente, 'terça');
    assert.equal(novas.estado, 'opcoes');
    avancar(5 * 60000);
    const { resposta: livre } = conferir(fluxo, ambiente, novas.opcoes[0].id_opcao);
    assert.equal(livre.estado, 'livre');
    const consultasAntes = ambiente.calendario.chamadasDe('livre-ocupado').length;

    const { resposta } = chamarFerramenta(fluxo, ambiente, { operacao: 'remarcar', id_opcao: novas.opcoes[0].id_opcao });
    assert.equal(resposta.estado, 'remarcada');
    assert.equal(resposta.texto, novas.opcoes[0].texto);
    assert.notEqual(resposta.texto, marcada.texto);
    assert.ok(ambiente.calendario.chamadasDe('livre-ocupado').length > consultasAntes, 'consulta de novo antes de mover');
    assert.equal(ambiente.calendario.chamadasDe('atualizar').length, 1, 'move o mesmo evento');
    assert.equal(ambiente.calendario.chamadasDe('criar').length, 1, 'nenhum evento novo');
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 1);
    assert.equal(ambiente.banco.chamadas('registrar_remarcacao').length, 1);
  });

  test('remarcar para horário que ficou ocupado: não move e oferece novas opções', async () => {
    const { fluxo, ambiente } = await comReuniaoMarcada();
    const { resposta: novas } = sugerir(fluxo, ambiente, 'terça');
    avancar(5 * 60000);
    ocupar(ambiente, ambiente.banco.estado.opcoes.get(novas.opcoes[0].id_opcao).inicio);
    const { resposta } = conferir(fluxo, ambiente, novas.opcoes[0].id_opcao);
    assert.equal(resposta.estado, 'ocupado');
    assert.equal(ambiente.calendario.chamadasDe('atualizar').length, 0);
  });

  test('cancelar: apaga o evento da Isadora e registra o cancelamento', async () => {
    const { fluxo, ambiente } = await comReuniaoMarcada();
    const { resposta } = chamarFerramenta(fluxo, ambiente, { operacao: 'cancelar', motivo: 'viagem' });
    assert.equal(resposta.estado, 'cancelada');
    assert.equal(ambiente.calendario.chamadasDe('excluir').length, 1);
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 0);
    assert.equal(ambiente.banco.chamadas('registrar_cancelamento').length, 1);
  });

  test('a Isadora nunca move nem apaga evento que não é dela: reunião marcada pela equipe vira consulta, sem tocar no calendário', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, {
      sessao: { sessao_id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', agendada_por: 'humano', evento_id: null, status: 'agendada', inicio: Date.parse('2026-10-05T10:00:00-03:00'), link: 'https://meet.google.com/aaa-bbbb-ccc' },
    });
    const { resposta: cancelada } = chamarFerramenta(fluxo, ambiente, { operacao: 'cancelar', motivo: 'viagem' });
    assert.notEqual(cancelada.estado, 'cancelada');
    const { resposta: remarcada } = chamarFerramenta(fluxo, ambiente, { operacao: 'remarcar', id_opcao: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' });
    assert.notEqual(remarcada.estado, 'remarcada');
    for (const operacao of ['atualizar', 'excluir', 'criar']) assert.equal(ambiente.calendario.chamadasDe(operacao).length, 0, operacao);
    assert.ok(ambiente.banco.estado.consultas.length >= 1, 'o pedido vai à equipe como consulta');
  });

  test('evento que não tem a marca da Isadora no id nunca é apagado, mesmo que o banco aponte para ele', async () => {
    const fluxo = await fluxo4();
    const ambiente = criarAmbiente(fluxo, {
      sessao: { sessao_id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003', agendada_por: 'isadora', evento_id: 'eventodaedilaine123', status: 'agendada', inicio: Date.parse('2026-10-05T10:00:00-03:00'), link: 'https://meet.google.com/aaa-bbbb-ccc' },
    });
    ambiente.calendario.executarHttp('eventos', {
      calendar_id: CALENDARIO,
      id: 'eventodaedilaine123',
      summary: 'Compromisso pessoal',
      start: '2026-10-05T10:00:00-03:00',
      end: '2026-10-05T10:30:00-03:00',
      attendees: [],
    });
    const antes = ambiente.calendario.chamadas.length;
    const { resposta } = chamarFerramenta(fluxo, ambiente, { operacao: 'cancelar', motivo: 'viagem' });
    assert.notEqual(resposta.estado, 'cancelada');
    assert.equal(ambiente.calendario.chamadasDe('excluir').length, 0);
    assert.equal(ambiente.calendario.eventosAtivos(CALENDARIO).length, 1);
    assert.ok(ambiente.calendario.chamadas.length > antes);
  });

  test('véspera: evento no lugar, devolve evento_ok com o link; movido pela Edilaine, vale o horário novo e a sessão é atualizada; apagado, avisa a equipe e não deixa o lembrete sair', async () => {
    const { fluxo, ambiente, marcada } = await comReuniaoMarcada();
    const ok = chamarFerramenta(fluxo, ambiente, { operacao: 'conferir_evento' }).resposta;
    assert.equal(ok.estado, 'evento_ok');
    assert.equal(ok.texto, marcada.texto);
    assert.match(ok.link, /^https:\/\/meet\.google\.com\//);

    const eventoId = ambiente.banco.estado.sessao.evento_id;
    ambiente.calendario.moverPelaEdilaine(CALENDARIO, eventoId, '2026-10-06T16:00:00-03:00', '2026-10-06T16:30:00-03:00');
    const movido = chamarFerramenta(fluxo, ambiente, { operacao: 'conferir_evento' }).resposta;
    assert.equal(movido.estado, 'evento_movido');
    assert.equal(movido.texto, 'terça, 06/10, às 16h');
    assert.equal(ambiente.banco.estado.sincronizacoes.at(-1).status, 'movida');

    ambiente.calendario.apagarPelaEdilaine(CALENDARIO, eventoId);
    const apagado = chamarFerramenta(fluxo, ambiente, { operacao: 'conferir_evento' }).resposta;
    assert.equal(apagado.estado, 'evento_apagado');
    assert.equal(ambiente.banco.estado.sincronizacoes.at(-1).status, 'apagada');
    assert.equal(ambiente.banco.estado.consultas.at(-1).tipo, 'horario_edilaine');
  });

  test('sincronização a cada 30 minutos: evento movido atualiza a sessão, apagado cancela, e nada é escrito à família', async () => {
    const { fluxo, ambiente } = await comReuniaoMarcada();
    const eventoId = ambiente.banco.estado.sessao.evento_id;
    const rodar = () => simularFluxo(fluxo, { gatilho: NOS.aCada30Min, entrada: {}, servicos: ambiente.servicos });

    rodar();
    assert.equal(ambiente.banco.estado.sincronizacoes, undefined, 'nada mudou: nada a gravar');
    ambiente.calendario.moverPelaEdilaine(CALENDARIO, eventoId, '2026-10-06T16:00:00-03:00', '2026-10-06T16:30:00-03:00');
    rodar();
    assert.equal(ambiente.banco.estado.sincronizacoes.at(-1).status, 'movida');
    ambiente.calendario.apagarPelaEdilaine(CALENDARIO, eventoId);
    rodar();
    assert.equal(ambiente.banco.estado.sincronizacoes.at(-1).status, 'apagada');
    assert.equal(ambiente.avisos.length, 1, 'só o aviso de agendamento; a sincronização não escreve a ninguém');
  });
});


// ---------------------------------------------------------------------------
// Validador da resposta: itens 9 e 10 do 11.11 (funções puras)
// ---------------------------------------------------------------------------

describe('validador da resposta · agenda (itens 9 e 10)', () => {
  const listas = {
    agenda_contexto: ['reunião', 'reuniao', 'edilaine', 'agenda', 'horário', 'horario', 'convite', 'link', 'meet'],
    agenda_confirmacao: ['agendada', 'agendado', 'marcada', 'marcado', 'confirmada', 'confirmado', 'prontinho', 'combinado'],
    agenda_reserva: ['vaga reservada', 'vaga garantida', 'reservei a vaga'],
    agenda_leonardo_verbos: ['vai te chamar', 'vai entrar em contato', 'vai retornar'],
    agenda_depois: ['depois da reunião'],
    agenda_anotacao_termos: ['condição', 'pagamento', 'contrato', 'desconto', 'parcelamento'],
    palavras_condicao: ['desconto', 'pix', 'parcela'],
  };
  const regras = (texto, contexto) => conferirAgenda(texto, { listas, ...contexto }).map((v) => v.regra);

  test('horário só o que uma ferramenta de agenda devolveu nesta execução ou está na ficha', () => {
    const contexto = { agenda_horarios: ['sexta, 02/10, às 14h', 'sábado, 03/10, às 9h'] };
    assert.deepEqual(regras('Olhei a agenda agora: ela tem sexta, 02/10, às 14h ou sábado, 03/10, às 9h. Algum fica bom?', contexto), []);
    assert.deepEqual(regras('Ela tem sexta-feira às 14h ou sábado às 9h.', contexto), []);
    assert.deepEqual(regras('Ela tem quarta, 07/10, às 20h.', contexto), ['horario_nao_consultado']);
    assert.deepEqual(regras('Ela tem quarta às 20h.', { agenda_horarios: [] }), ['horario_nao_consultado'], 'sem consulta, nenhum horário');
    assert.deepEqual(regras('Ontem ela tinha quarta às 20h, pode ser?', { agenda_horarios: ['quinta, 08/10, às 9h'] }), ['horario_nao_consultado']);
  });

  test('duração de atendimento não é horário de reunião', () => {
    assert.deepEqual(regras('O atendimento tem visitas de 6h em cada dia.', { agenda_horarios: [] }), []);
  });

  test('confirmar a reunião só com criada ou remarcada (ou reunião já marcada na ficha)', () => {
    const texto = 'Prontinho, Ana! Sua reunião com a Edilaine está agendada. O convite chegou no seu e-mail.';
    assert.deepEqual(regras(texto, { agenda_estados: [] }), ['confirmacao_sem_evento']);
    assert.deepEqual(regras(texto, { agenda_estados: ['livre'] }), ['confirmacao_sem_evento'], 'horário livre ainda não é evento criado');
    assert.deepEqual(regras(texto, { agenda_estados: ['criada'] }), []);
    assert.deepEqual(regras(texto, { agenda_estados: ['remarcada'] }), []);
    assert.deepEqual(regras(texto, { agenda_reuniao_marcada: true }), []);
    assert.deepEqual(regras('Ainda não está marcada; vou conferir com a equipe.', { agenda_estados: ['falhou'] }), [], 'negação não é confirmação');
    assert.deepEqual(regras('A reunião fica marcada quando você me passar o e-mail?', { agenda_estados: [] }), [], 'pergunta não é confirmação');
  });

  test('a reunião não reserva a vaga do atendimento em casa', () => {
    assert.deepEqual(regras('Sua reunião está agendada e sua vaga reservada.', { agenda_estados: ['criada'] }), ['vaga_reservada']);
  });

  test('o Leonardo não promete retorno antes da reunião e a anotação é obrigatória quando o assunto vai para depois', () => {
    assert.deepEqual(regras('O Leonardo vai te chamar hoje para falar de desconto.', {}), ['promessa_do_leonardo']);
    const depois = 'As condições de pagamento o Leonardo apresenta depois da reunião com a Edilaine.';
    assert.deepEqual(regras(depois, { anotacao_registrada: false }), ['anotacao_ausente']);
    assert.deepEqual(regras(depois, { anotacao_registrada: true }), []);
  });

  test('integrado ao validarResposta: a violação de agenda reprova a resposta inteira', () => {
    const contexto = { listas, planos: [], valor_minimo_centavos: 420000, agenda_horarios: [], agenda_estados: [] };
    const reprovada = validarResposta('Combinado! A reunião com a Edilaine é sábado, 03/10, às 9h.', contexto);
    assert.equal(reprovada.aprovada, false);
    assert.ok(reprovada.violacoes.some((v) => v.regra === 'horario_nao_consultado'));
    const aprovada = validarResposta('Combinado! A reunião com a Edilaine é sábado, 03/10, às 9h.', {
      ...contexto,
      agenda_horarios: ['sábado, 03/10, às 9h'],
      agenda_estados: ['criada'],
    });
    assert.equal(aprovada.aprovada, true, JSON.stringify(aprovada.violacoes));
  });
});

// ---------------------------------------------------------------------------
// Estrutura do JSON
// ---------------------------------------------------------------------------

describe('fluxo 4 · estrutura do JSON gerado', () => {
  test('passa por todos os verificadores estruturais do 19.5 e todo nó Code compila', async () => {
    const fluxo = await fluxo4();
    executarTodosOsValidadoresEstruturais(fluxo);
    for (const no of fluxo.nodes.filter((n) => n.type === 'n8n-nodes-base.code')) codeCompila(no.parameters.jsCode, no.name);
  });

  test('a credencial do Google mora só no fluxo 4, por id, e o nó do Google só usa parâmetros que o nó do n8n conhece', async () => {
    const config = await configExemplo();
    const { fluxo1, fluxo2, fluxo3, fluxo4: f4 } = gerarFluxos(config, 'hml');
    for (const fluxo of [fluxo1, fluxo2, fluxo3]) {
      assert.ok(!JSON.stringify(fluxo).includes('googleCalendar'), `${fluxo.name} não tem nó nem credencial do Google`);
    }
    const nos = f4.nodes.filter((n) => n.type === 'n8n-nodes-base.googleCalendar');
    assert.ok(nos.length >= 7);
    for (const no of nos) {
      assert.equal(no.typeVersion, 1.3);
      assert.deepEqual(no.credentials.googleCalendarOAuth2Api.id, config.credenciais.googleCalendar.id);
      assert.equal(no.onError, 'continueRegularOutput');
    }
    const criar = nos.find((n) => n.parameters.operation === 'create');
    assert.equal(criar.parameters.additionalFields.conferenceDataUi.conferenceDataValues.conferenceSolution, 'hangoutsMeet');
    assert.equal(criar.parameters.additionalFields.sendUpdates, 'all');
    assert.equal(criar.parameters.calendar.value, config.agenda.calendarId);
    const disponibilidade = nos.find((n) => n.parameters.operation === 'availability');
    assert.equal(disponibilidade.parameters.options.outputFormat, 'bookedSlots');
    assert.equal(disponibilidade.alwaysOutputData, true, 'agenda livre devolve lista vazia; o nó precisa seguir com um item');
  });

  test('com agendaSimulada, os nós do Google viram chamadas à rota de captura, sem credencial', async () => {
    const config = await configExemplo();
    const simulada = { ...config, homologacao: { ...config.homologacao, agendaSimulada: true } };
    const f4 = gerarFluxos(simulada, 'hml').fluxo4;
    assert.ok(!f4.nodes.some((n) => n.type === 'n8n-nodes-base.googleCalendar'));
    const chamadas = f4.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && /\/agenda\//.test(n.parameters.url));
    assert.ok(chamadas.length >= 7);
    for (const no of chamadas) assert.equal(no.parameters.authentication, 'none');
    const ocupacao = chamadas.filter((no) => /\/agenda\/livre-ocupado$/.test(no.parameters.url));
    assert.ok(ocupacao.length >= 1);
    for (const no of ocupacao) assert.equal(no.alwaysOutputData, true, 'agenda livre devolve lista vazia; o nó precisa seguir com um item');
    assert.throws(() => gerarFluxos(simulada, 'prod'), /agendaSimulada/);
  });

  test('as entradas do sub-fluxo não incluem id de evento, de calendário nem de sessão', () => {
    const nomes = ENTRADAS.map((e) => e.name);
    assert.deepEqual(nomes.filter((n) => /evento|calendar|sessao/.test(n)), []);
  });

  test('idEventoDaOpcao: só letras a-v e dígitos, como o Google exige, com o prefixo da Isadora', () => {
    const id = idEventoDaOpcao('aaaaaaaa-aaaa-4aaa-8aaa-000000000001');
    assert.match(id, /^kraam[0-9a-f]{32}$/);
    assert.equal(idEventoDaOpcao('não é uuid'), null);
  });
});
