// Nós Code do fluxo 4 "Agenda da Isadora" (PRD 11.14 e 19.6). Funções puras,
// embutidas nos nós; os testes importam as mesmas e rodam o JSON gerado no
// simulador com um Google Calendar falso.
//
// O estado do fluxo é um objeto que cada nó Code devolve inteiro (com a marca
// `_kz_estado`, como no fluxo 3): os nós Postgres, Google e UAZAPI trocam o
// item pela resposta, e o nó seguinte junta o estado anterior com o que a
// chamada devolveu. Toda regra mora aqui; os nós If e Switch só leem campos
// já calculados (`rota`, `proximo`, `saida`).
//
// Regras de segurança que este arquivo garante (PRD 11.14):
// - o id do evento nunca vem da entrada: vem de `agente.reuniao_da_conversa`
//   (`estado.reuniao.evento_id`) e só vale se o evento lido tem a marca de
//   origem da Isadora (`eventoEhDaIsadora`);
// - a agenda é consultada antes de sugerir, na escolha e antes de criar; a
//   opção só vira reunião se o banco a aceitou (oferecida hoje, não usada,
//   dentro da antecedência);
// - o retorno de sucesso (`criada`, `remarcada`) só existe depois de o evento
//   voltar do Google com id, link do Meet e o mesmo horário pedido, e de o
//   banco gravar a reunião;
// - qualquer falha do Google ou do banco vira `falhou` ou `indisponivel`, abre
//   a consulta `horario_edilaine` (a equipe é avisada) e nunca chega ao modelo
//   como exceção;
// - o retorno ao modelo nunca leva id de evento, de calendário, de sessão nem
//   de conversa.
//
// Nenhum texto para a família mora aqui: as instruções vêm do banco
// (`instrucao_agente` de `agente.registrar_consulta_equipe`).

import {
  calcularOpcoes,
  conferirEmails,
  conferirEvento,
  descreverHorario,
  eventoEhDaIsadora,
  idEventoDaOpcao,
  intervalosOcupados,
  isoLocal,
  janelaDeConsulta,
  janelaDoHorario,
  livreNoHorario,
  lerPreferencia,
  montarConvidados,
  situacaoDoEvento,
  textoDoHorario,
} from './agenda.js';
import { comMarca, descreverErro, falhouChamada, resultadoDoBanco, textoLimpo } from './resultado-no.js';

export const OPERACOES_AGENDA = [
  'consultar',
  'conferir',
  'agendar',
  'remarcar',
  'cancelar',
  'conferir_evento',
  'consultar_equipe',
  // O fluxo 3 abre a consulta `horario_edilaine` quando o validador barra um
  // horário ou uma confirmação de reunião que a reescrita não resolveu
  // (PRD 11.11 item 9).
  'abrir_consulta_horario',
];
export const TIPOS_CONSULTA_DO_MODELO = ['area', 'duvida'];
export const ORIGEM_AGENDA_ISADORA = 'agenda_isadora';

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_CAMPO = 300;

function curto(valor, limite = LIMITE_CAMPO) {
  return textoLimpo(valor).replace(/\s+/g, ' ').slice(0, limite);
}

// ---------------------------------------------------------------------------
// Entrada e rota
// ---------------------------------------------------------------------------

// Nó 2 "Normalizar Entrada". `modo = conferir` numa chamada `consultar` vira a
// operação `conferir` (é assim que a ferramenta consultar_horarios_edilaine
// chega). Nada que o modelo preenche decide o id do evento.
export function normalizarEntradaAgenda(entrada = {}, { agora }) {
  const modo = curto(entrada.modo, 20).toLowerCase();
  let operacao = curto(entrada.operacao, 30).toLowerCase();
  if (operacao === 'consultar' && modo === 'conferir') operacao = 'conferir';
  const maximo = Number(entrada.maximo);
  const estado = {
    operacao,
    modo: operacao === 'conferir' ? 'conferir' : 'sugerir',
    conversa_id: textoLimpo(entrada.conversa_id),
    id_opcao: textoLimpo(entrada.id_opcao),
    preferencia: curto(entrada.preferencia, 200),
    email: curto(entrada.email, 254),
    email_parceiro: curto(entrada.email_parceiro, 254),
    motivo: curto(entrada.motivo, 200),
    tipo: curto(entrada.tipo, 30).toLowerCase(),
    pergunta: curto(entrada.pergunta, 300),
    maximo: maximo === 1 ? 1 : 2,
    agora,
    parametros: null,
    reuniao: null,
    rota: null,
    consulta: null,
    opcao: null,
    resultado: null,
    abrir_consulta: null,
    aviso: null,
    consulta_id: null,
    instrucao: null,
    tentativas_ocupado: 0,
  };
  if (!OPERACOES_AGENDA.includes(operacao)) return comMarca(falhaDeEntrada(estado, 'operacao_invalida'));
  if (!PADRAO_UUID.test(estado.conversa_id)) return comMarca(falhaDeEntrada(estado, 'sem_conversa'));
  return comMarca(estado);
}

function falhaDeEntrada(estado, erro) {
  return { ...estado, rota: 'concluir', resultado: { estado: 'falhou', erro } };
}

// Nó 4 "Ler Parâmetros": `agente.parametros_agenda()`.
export function lerParametrosAgenda(estado, resposta) {
  const parametros = resultadoDoBanco(resposta);
  if (!parametros || parametros.ok !== true) {
    return comMarca({ ...estado, parametros: null, parametros_erro: falhouChamada(resposta) ? descreverErro(resposta) : 'parametros_agenda sem ok' });
  }
  return comMarca({ ...estado, parametros, parametros_erro: null });
}

// Resultado que abre a consulta `horario_edilaine` com prioridade alta
// (Google fora do ar, credencial vencida, evento que não se confirmou).
function indisponivel(estado, erro, resultado = 'indisponivel') {
  return {
    ...estado,
    rota: 'concluir',
    resultado: { estado: resultado, erro },
    abrir_consulta: { tipo: 'horario_edilaine', pergunta_chave: 'horario', motivo: 'indisponivel', prioridade: 'alta' },
  };
}

function falhaSemConsulta(estado, erro, resultado = 'falhou') {
  return { ...estado, rota: 'concluir', resultado: { estado: resultado, erro }, abrir_consulta: null };
}

// Nó 6 "Ler Reunião e Rotear": junta a reunião da conversa e decide a rota.
export function decidirRota(estado, respostaReuniao) {
  if (estado.resultado) return comMarca({ ...estado, rota: 'concluir' });
  const reuniao = resultadoDoBanco(respostaReuniao);
  const base = { ...estado, reuniao: reuniao && reuniao.ok === true ? reuniao : null };
  const configurada = estado.parametros?.ok === true && estado.parametros.configurada === true;
  const daIsadora = base.reuniao?.existe === true && base.reuniao.agendada_por === 'isadora' && Boolean(base.reuniao.evento_id);
  const op = estado.operacao;

  if (op === 'consultar_equipe') {
    if (!TIPOS_CONSULTA_DO_MODELO.includes(estado.tipo) || !estado.pergunta) return comMarca(falhaSemConsulta(base, 'consulta_invalida'));
    return comMarca({
      ...base,
      rota: 'concluir',
      abrir_consulta: { tipo: estado.tipo, pergunta: estado.pergunta, pergunta_chave: null, motivo: null, prioridade: 'normal' },
      resultado: { estado: 'aberta' },
    });
  }

  if (op === 'abrir_consulta_horario') {
    return comMarca({
      ...base,
      rota: 'concluir',
      resultado: { estado: 'aberta' },
      abrir_consulta: { ...consultaDeHorario(base, 'alta'), motivo: null },
    });
  }

  if (op === 'consultar' || op === 'conferir') {
    if (!estado.parametros) return comMarca(indisponivel(base, estado.parametros_erro ?? 'sem_parametros'));
    if (!configurada) {
      return comMarca({
        ...base,
        rota: 'concluir',
        resultado: { estado: 'sem_horario' },
        abrir_consulta: consultaDeHorario(base, 'normal'),
      });
    }
    if (op === 'conferir' && !PADRAO_UUID.test(estado.id_opcao)) return comMarca(falhaSemConsulta(base, 'opcao_invalida', 'invalida'));
    return comMarca({ ...base, rota: op === 'conferir' ? 'validar_opcao' : 'consultar', consulta: { modo: 'sugerir' } });
  }

  if (op === 'agendar') {
    const emails = conferirEmails({ email: estado.email, email_parceiro: estado.email_parceiro });
    if (!emails.ok) return comMarca(falhaSemConsulta(base, emails.erro, 'email_invalido'));
    if (!PADRAO_UUID.test(estado.id_opcao)) return comMarca(falhaSemConsulta(base, 'opcao_invalida', 'invalida'));
    if (!estado.parametros || !configurada) return comMarca(indisponivel(base, estado.parametros_erro ?? 'agenda_nao_configurada'));
    if (base.reuniao?.existe === true) return comMarca(falhaSemConsulta(base, 'ja_existe_reuniao'));
    return comMarca({ ...base, email: emails.email, email_parceiro: emails.email_parceiro, rota: 'validar_opcao' });
  }

  if (op === 'remarcar' || op === 'cancelar' || op === 'conferir_evento') {
    if (!daIsadora) {
      // Reunião marcada pela equipe (ou nenhuma): a Isadora não a move nem a apaga.
      // Pedido de remarcar ou cancelar vai à equipe como consulta, sem transferir.
      const daEquipe = base.reuniao?.existe === true && op !== 'conferir_evento';
      return comMarca({
        ...falhaSemConsulta(base, 'sem_reuniao_da_isadora'),
        abrir_consulta: daEquipe ? { tipo: 'duvida', pergunta: estado.motivo, pergunta_chave: 'reuniao_da_equipe', motivo: null, prioridade: 'normal' } : null,
      });
    }
    if (op === 'remarcar') {
      if (!PADRAO_UUID.test(estado.id_opcao)) return comMarca(falhaSemConsulta(base, 'opcao_invalida', 'invalida'));
      if (!estado.parametros || !configurada) return comMarca(indisponivel(base, estado.parametros_erro ?? 'agenda_nao_configurada'));
    }
    return comMarca({ ...base, rota: 'ler_evento' });
  }
  return comMarca(falhaSemConsulta(base, 'operacao_invalida'));
}

// Consulta `horario_edilaine` a partir da preferência que a família contou.
function consultaDeHorario(estado, prioridade) {
  const preferencia = lerPreferencia(estado.preferencia, Date.parse(estado.agora));
  return {
    tipo: 'horario_edilaine',
    pergunta: estado.preferencia,
    pergunta_chave: 'horario',
    motivo: null,
    prioridade,
    preferencia: {
      dias: preferencia.dias_semana.join(', '),
      periodos: preferencia.periodo ?? '',
      observacao: estado.preferencia,
    },
  };
}

// ---------------------------------------------------------------------------
// Consulta ao Google (ocupado e livre)
// ---------------------------------------------------------------------------

// Nó 8 "Preparar Consulta": um item por calendário (o da reunião e os de
// ocupação do config). Cada item leva o estado da consulta, que o cálculo
// lê do primeiro.
export function prepararConsulta(estado, { calendarios }) {
  const consulta = estado.consulta ?? { modo: 'sugerir' };
  let janela;
  if (consulta.modo === 'slot') {
    janela = janelaDoHorario(consulta.inicio, consulta.fim, estado.parametros?.intervalo_minutos);
  } else {
    janela = janelaDeConsulta(estado.parametros, estado.agora);
  }
  const lista = [...new Set((calendarios ?? []).filter((id) => typeof id === 'string' && id.trim()))];
  const proximoEstado = comMarca({ ...estado, consulta: { ...consulta, ...janela } });
  return lista.map((calendarId) => ({ calendar_id: calendarId, time_min: janela.time_min, time_max: janela.time_max, estado: proximoEstado }));
}

// Nó 10 "Calcular Opções": itens do Google Calendar (intervalos ocupados, ou
// erro). Devolve o estado com `proximo`:
//   gravar_opcoes  opções calculadas, a gravar no banco;
//   livre / ocupado  o horário conferido está livre / ocupado;
//   concluir  sem horário ou Google fora do ar (com consulta à equipe).
export function calcularConsulta(estado, itens) {
  const lista = Array.isArray(itens) ? itens : [];
  // Erro por item (`error`) ou nó inteiro que falhou e repassou o item de
  // entrada (o item de "Preparar Consulta" traz `calendar_id`).
  const falha = lista.find((item) => item && (item.error !== undefined || item.calendar_id !== undefined));
  if (falha || (lista.length > 0 && lista.every((item) => item?.error !== undefined))) {
    const erro = falha ? descreverErro(falha) : 'consulta_falhou';
    return comMarca({ ...indisponivel(estado, erro), proximo: 'concluir' });
  }
  const ocupados = lista.filter((item) => item && item.start && item.end);
  const consulta = estado.consulta ?? { modo: 'sugerir' };

  if (consulta.modo === 'slot') {
    const livre = livreNoHorario(
      Date.parse(consulta.inicio),
      Date.parse(consulta.fim),
      intervalosOcupados(ocupados),
      estado.parametros?.intervalo_minutos,
    );
    return comMarca({ ...estado, proximo: livre ? 'livre' : 'ocupado' });
  }

  const calculo = calcularOpcoes({
    parametros: estado.parametros,
    ocupados,
    preferenciaTexto: consulta.preferencia_texto ?? estado.preferencia,
    agora: estado.agora,
    maximo: estado.maximo,
  });
  if (calculo.estado === 'opcoes') {
    return comMarca({ ...estado, consulta: { ...consulta, opcoes: calculo.opcoes }, proximo: 'gravar_opcoes' });
  }
  const semHorario = {
    ...estado,
    rota: 'concluir',
    resultado: { estado: consulta.depois_de_ocupado ? 'ocupado' : 'sem_horario', opcoes: [] },
    abrir_consulta: estado.nao_abrir_consulta === true ? null : consultaDeHorario({ ...estado, preferencia: consulta.preferencia_texto ?? estado.preferencia }, 'normal'),
  };
  return comMarca({ ...semHorario, proximo: 'concluir' });
}

// Nó 7 "Validar Opção", depois do banco: `agente.validar_opcao_horario`.
export function lerOpcaoValidada(estado, resposta) {
  const opcao = resultadoDoBanco(resposta);
  if (!opcao) return comMarca(indisponivel(estado, descreverErro(resposta)));
  if (opcao.ok !== true) return comMarca(falhaSemConsulta(estado, textoLimpo(opcao.erro) || 'opcao_invalida', 'invalida'));
  return comMarca({
    ...estado,
    rota: 'consultar_slot',
    opcao: { id_opcao: textoLimpo(opcao.id_opcao), inicio: opcao.inicio, fim: opcao.fim, texto: opcao.texto, dia_semana: opcao.dia_semana, data: opcao.data, hora: opcao.hora },
    consulta: { modo: 'slot', inicio: opcao.inicio, fim: opcao.fim },
  });
}

// Depois de `agente.registrar_opcoes_horario`.
export function lerOpcoesRegistradas(estado, resposta) {
  const registro = resultadoDoBanco(resposta);
  if (!registro) return comMarca({ ...indisponivel(estado, descreverErro(resposta)), rota: 'concluir' });
  if (registro.ok !== true || !Array.isArray(registro.opcoes) || registro.opcoes.length === 0) {
    return comMarca({ ...falhaSemConsulta(estado, textoLimpo(registro.erro) || 'opcoes_nao_gravadas') });
  }
  const opcoes = registro.opcoes.map((opcao) => ({
    id_opcao: textoLimpo(opcao.id_opcao),
    texto: opcao.texto,
    dia_semana: opcao.dia_semana,
    data: opcao.data,
    hora: opcao.hora,
  }));
  return comMarca({
    ...estado,
    rota: 'concluir',
    resultado: {
      estado: estado.consulta?.depois_de_ocupado ? 'ocupado' : 'opcoes',
      opcoes,
      consultada_em: registro.consultada_em ?? estado.agora,
      valida_ate: registro.valida_ate ?? null,
    },
  });
}

function textoDaOpcao(opcao) {
  return { texto: opcao?.texto, dia_semana: opcao?.dia_semana, data: opcao?.data, hora: opcao?.hora };
}

// Depois de `agente.registrar_conferencia_horario`. `livre`: segue para a
// operação (conferir, agendar ou remarcar). `ocupado`: a opção foi descartada;
// consulta de novo e oferece duas opções novas.
export function lerConferencia(estado, resposta, { livre }) {
  const registro = resultadoDoBanco(resposta);
  if (!registro || registro.ok !== true) {
    if (!registro) return comMarca(indisponivel(estado, descreverErro(resposta)));
    return comMarca(falhaSemConsulta(estado, textoLimpo(registro.erro) || 'conferencia_nao_gravada', 'invalida'));
  }
  if (livre) {
    const proximaRota = estado.operacao === 'conferir' ? 'concluir' : estado.operacao === 'agendar' ? 'preparar_evento' : 'preparar_movimento';
    return comMarca({
      ...estado,
      rota: proximaRota,
      resultado: proximaRota === 'concluir' ? { estado: 'livre', ...textoDaOpcao(estado.opcao) } : estado.resultado,
    });
  }
  return comMarca({
    ...estado,
    rota: 'consultar',
    opcao: null,
    id_opcao: '',
    tentativas_ocupado: (estado.tentativas_ocupado ?? 0) + 1,
    consulta: { modo: 'sugerir', depois_de_ocupado: true, preferencia_texto: '' },
  });
}

// ---------------------------------------------------------------------------
// Evento no Google Calendar
// ---------------------------------------------------------------------------

// Nó 9 "Criar Evento" (parâmetros): 30 minutos (o bloco do parâmetro), Google
// Meet, convidados, título e descrição de `parametro`. O id é escolhido aqui,
// a partir da opção, e é a marca de origem da Isadora.
export function prepararEvento(estado) {
  const opcao = estado.opcao;
  const eventoId = idEventoDaOpcao(opcao?.id_opcao);
  if (!eventoId) return comMarca(falhaSemConsulta(estado, 'opcao_invalida', 'invalida'));
  const convidados = montarConvidados({ email: estado.email, email_parceiro: estado.email_parceiro }, estado.parametros);
  return comMarca({
    ...estado,
    evento: {
      evento_id: eventoId,
      inicio_local: isoLocal(Date.parse(opcao.inicio)),
      fim_local: isoLocal(Date.parse(opcao.fim)),
      inicio: opcao.inicio,
      fim: opcao.fim,
      titulo: textoLimpo(estado.parametros?.titulo_evento),
      descricao: textoLimpo(estado.parametros?.descricao_evento),
      convidados,
    },
  });
}

// Depois de "Criar Evento". Sucesso só se o evento voltou com id, Meet e o
// mesmo horário; qualquer erro tenta recuperar o evento pelo id antes de
// desistir (o pedido pode ter criado o evento e falhado na resposta).
export function lerCriacaoDoEvento(estado, resposta, { recuperando = false } = {}) {
  const pedido = { evento_id: estado.evento.evento_id, inicio: estado.evento.inicio, fim: estado.evento.fim };
  if (falhouChamada(resposta)) {
    if (!recuperando) return comMarca({ ...estado, proximo: 'recuperar', erro_google: descreverErro(resposta) });
    return comMarca({ ...indisponivel(estado, estado.erro_google ?? descreverErro(resposta)), proximo: 'concluir' });
  }
  const conferido = conferirEvento(resposta, pedido);
  if (conferido.ok) {
    return comMarca({ ...estado, evento_confirmado: { evento_id: conferido.evento_id, link: conferido.link }, proximo: 'registrar' });
  }
  const criado = typeof resposta?.id === 'string' && resposta.id === pedido.evento_id && resposta.status !== 'cancelled';
  // O Google cria o Meet de forma assíncrona: o evento pode voltar do insert
  // sem o link ainda. Uma leitura pelo id (ramo "recuperar") pega o link
  // pronto; se depois dela o link continuar faltando, o evento sai (compensar).
  if (criado && !recuperando && conferido.motivo === 'sem_link_meet') {
    return comMarca({ ...estado, proximo: 'recuperar', erro_google: 'sem_link_meet' });
  }
  return comMarca({
    ...indisponivel(estado, conferido.motivo),
    proximo: criado ? 'compensar' : 'concluir',
  });
}

// Depois de `agente.registrar_reuniao`.
export function lerReuniaoRegistrada(estado, resposta) {
  const registro = resultadoDoBanco(resposta);
  if (!registro || registro.ok !== true) {
    const erro = registro ? textoLimpo(registro.erro) || 'reuniao_nao_gravada' : descreverErro(resposta);
    // Evento criado e não gravado: apaga o evento (compensação) e abre a consulta.
    return comMarca({ ...indisponivel(estado, erro, 'falhou'), proximo: 'compensar' });
  }
  const aviso = registro.mensagem_grupo && registro.grupo_jid ? { jid: registro.grupo_jid, texto: registro.mensagem_grupo } : null;
  return comMarca({
    ...estado,
    proximo: 'concluir',
    rota: 'concluir',
    aviso,
    resultado: {
      estado: 'criada',
      texto: registro.texto,
      dia_semana: registro.dia_semana,
      data: registro.data,
      hora: registro.hora,
      link: textoLimpo(registro.link) || estado.evento_confirmado?.link || '',
    },
  });
}

// Nó 11 "Conferir Origem", depois de "Ler Evento": só evento da Isadora, e
// ainda vivo, pode ser movido, apagado ou usado no lembrete.
export function conferirOrigemDoEvento(estado, leitura) {
  const sessao = { inicio: estado.reuniao?.inicio };
  const situacao = situacaoDoEvento(leitura, sessao);
  if (estado.operacao === 'conferir_evento') {
    return comMarca({ ...estado, situacao, proximo: 'comparar' });
  }
  if (situacao.estado === 'apagado') {
    // O evento já não existe: cancelar segue só no banco; remarcar não tem o que mover.
    if (estado.operacao === 'cancelar') return comMarca({ ...estado, situacao, evento_ja_apagado: true, proximo: 'registrar_cancelamento' });
    return comMarca({ ...falhaSemConsulta(estado, 'evento_apagado'), abrir_consulta: consultaDeHorario(estado, 'alta'), proximo: 'concluir' });
  }
  if (situacao.estado === 'indisponivel') return comMarca({ ...indisponivel(estado, 'evento_ilegivel'), proximo: 'concluir' });
  if (!eventoEhDaIsadora(leitura) || leitura.id !== estado.reuniao?.evento_id) {
    return comMarca({ ...falhaSemConsulta(estado, 'evento_nao_e_da_isadora'), proximo: 'concluir' });
  }
  return comMarca({ ...estado, situacao, proximo: estado.operacao === 'cancelar' ? 'apagar' : 'validar_opcao' });
}

// Nó 10 "Mover Evento" (parâmetros): o id vem do banco.
export function prepararMovimento(estado) {
  const opcao = estado.opcao;
  return comMarca({
    ...estado,
    evento: {
      evento_id: estado.reuniao.evento_id,
      inicio_local: isoLocal(Date.parse(opcao.inicio)),
      fim_local: isoLocal(Date.parse(opcao.fim)),
      inicio: opcao.inicio,
      fim: opcao.fim,
    },
  });
}

// Depois de "Mover Evento".
export function lerMovimentoDoEvento(estado, resposta) {
  if (falhouChamada(resposta)) return comMarca({ ...indisponivel(estado, descreverErro(resposta)), proximo: 'concluir' });
  const conferido = conferirEvento(resposta, {
    evento_id: estado.evento.evento_id,
    inicio: estado.evento.inicio,
    fim: estado.evento.fim,
    exigir_link: false,
  });
  if (!conferido.ok) return comMarca({ ...indisponivel(estado, conferido.motivo), proximo: 'concluir' });
  return comMarca({ ...estado, evento_confirmado: { evento_id: conferido.evento_id, link: conferido.link || estado.reuniao?.link || '' }, proximo: 'registrar' });
}

// Depois de `agente.registrar_remarcacao`.
export function lerRemarcacaoRegistrada(estado, resposta) {
  const registro = resultadoDoBanco(resposta);
  if (!registro || registro.ok !== true) {
    const erro = registro ? textoLimpo(registro.erro) || 'remarcacao_nao_gravada' : descreverErro(resposta);
    return comMarca({ ...indisponivel(estado, erro, 'falhou'), proximo: 'concluir' });
  }
  return comMarca({
    ...estado,
    proximo: 'concluir',
    rota: 'concluir',
    resultado: { estado: 'remarcada', texto: registro.texto, dia_semana: registro.dia_semana, data: registro.data, hora: registro.hora, link: textoLimpo(registro.link) || estado.evento_confirmado?.link || '' },
  });
}

// Depois de "Apagar Evento": 404 e 410 contam como já apagado.
export function lerApagamentoDoEvento(estado, resposta) {
  if (falhouChamada(resposta)) {
    const situacao = situacaoDoEvento(resposta, {});
    if (situacao.estado !== 'apagado') return comMarca({ ...indisponivel(estado, descreverErro(resposta)), proximo: 'concluir' });
  }
  return comMarca({ ...estado, proximo: 'registrar_cancelamento' });
}

// Depois de `agente.registrar_cancelamento`.
export function lerCancelamentoRegistrado(estado, resposta) {
  const registro = resultadoDoBanco(resposta);
  if (!registro || registro.ok !== true) {
    const erro = registro ? textoLimpo(registro.erro) || 'cancelamento_nao_gravado' : descreverErro(resposta);
    return comMarca({ ...indisponivel(estado, erro, 'falhou'), proximo: 'concluir' });
  }
  return comMarca({ ...estado, proximo: 'concluir', rota: 'concluir', resultado: { estado: 'cancelada' } });
}

// Depois do "Apagar Evento Criado" (compensação): o evento que não se
// confirmou ou não foi gravado sai do calendário. O resultado já é falha.
export function lerCompensacao(estado, resposta) {
  return comMarca({ ...estado, compensado: !falhouChamada(resposta), proximo: 'concluir' });
}

// ---------------------------------------------------------------------------
// Lembrete da véspera e sincronização
// ---------------------------------------------------------------------------

// Nó "Comparar Evento" (operação `conferir_evento`, chamada pelo fluxo 3 antes
// do lembrete). Movido: vale o horário atual e a sessão é atualizada. Apagado:
// o lembrete não sai, a sessão é cancelada e abre a consulta `horario_edilaine`.
export function compararEventoDoLembrete(estado) {
  const situacao = estado.situacao ?? { estado: 'indisponivel' };
  const sessaoId = estado.reuniao?.sessao_id;
  if (situacao.estado === 'ok') {
    return comMarca({
      ...estado,
      rota: 'concluir',
      resultado: {
        estado: 'evento_ok',
        texto: estado.reuniao.texto,
        dia_semana: estado.reuniao.dia_semana,
        data: estado.reuniao.data,
        hora: estado.reuniao.hora,
        link: situacao.link || estado.reuniao.link || '',
      },
      sincronizar: null,
    });
  }
  if (situacao.estado === 'movido') {
    const inicioMs = Date.parse(situacao.inicio);
    const bloco = Number(estado.parametros?.bloco_minutos) || 30;
    const horario = descreverHorario(inicioMs, bloco);
    return comMarca({
      ...estado,
      rota: 'concluir',
      resultado: {
        estado: 'evento_movido',
        texto: horario.texto,
        dia_semana: horario.dia_semana,
        data: horario.data,
        hora: horario.hora,
        inicio: horario.inicio,
        link: situacao.link || estado.reuniao.link || '',
      },
      sincronizar: { sessao_id: sessaoId, inicio: horario.inicio, fim: situacao.fim ?? horario.fim, status: 'movida', link: situacao.link || null },
    });
  }
  if (situacao.estado === 'apagado') {
    return comMarca({
      ...estado,
      rota: 'concluir',
      resultado: { estado: 'evento_apagado' },
      abrir_consulta: { tipo: 'horario_edilaine', pergunta: estado.reuniao.texto, pergunta_chave: 'horario', motivo: null, prioridade: 'alta', preferencia: { observacao: estado.reuniao.texto } },
      sincronizar: { sessao_id: sessaoId, inicio: null, fim: null, status: 'apagada', link: null },
    });
  }
  return comMarca({ ...estado, rota: 'concluir', resultado: { estado: 'indisponivel', erro: 'evento_ilegivel' }, sincronizar: null });
}

// Depois de `agente.sincronizar_reuniao`: o resultado do lembrete não muda.
export function lerSincronizacao(estado, resposta) {
  const registro = resultadoDoBanco(resposta);
  return comMarca({ ...estado, sincronizado: Boolean(registro && registro.ok === true) });
}

// Entrada B, nó "Separar Sessões": um item por reunião a sincronizar. O id do
// evento vem do banco (única saída em lote do id).
export function separarSessoes(resposta) {
  const resultado = resultadoDoBanco(resposta);
  if (!resultado || resultado.ok !== true || !Array.isArray(resultado.itens)) return [];
  return resultado.itens
    .filter((item) => item && textoLimpo(item.sessao_id) && textoLimpo(item.evento_id))
    .map((item) => ({
      sessao_id: textoLimpo(item.sessao_id),
      evento_id: textoLimpo(item.evento_id),
      inicio: item.inicio,
      fim: item.fim,
      link: textoLimpo(item.link),
    }));
}

// Entrada B, "Comparar e Gravar": compara o evento lido com a sessão.
// Movido atualiza início, fim e link; apagado cancela a sessão. Nenhuma
// mensagem à família (o próprio Google avisa quem foi convidado).
export function compararSessaoComEvento(sessao, leitura) {
  const situacao = situacaoDoEvento(leitura, sessao);
  if (situacao.estado === 'ok' || situacao.estado === 'indisponivel') return { gravar: false, sessao_id: sessao.sessao_id, situacao: situacao.estado };
  if (!eventoEhDaIsadora(leitura) && situacao.estado === 'movido') return { gravar: false, sessao_id: sessao.sessao_id, situacao: 'nao_e_da_isadora' };
  if (situacao.estado === 'movido') {
    return {
      gravar: true,
      sessao_id: sessao.sessao_id,
      status: 'movida',
      inicio: situacao.inicio,
      fim: situacao.fim,
      link: situacao.link || null,
      situacao: 'movido',
    };
  }
  return { gravar: true, sessao_id: sessao.sessao_id, status: 'apagada', inicio: null, fim: null, link: null, situacao: 'apagado' };
}

// ---------------------------------------------------------------------------
// Fechamento: consulta à equipe, aviso ao grupo e resposta
// ---------------------------------------------------------------------------

// Nó "Concluir": ponto único de saída. Decide se ainda falta abrir a consulta
// à equipe, avisar o grupo ou marcar a consulta como notificada; só então
// responde. O nó é revisitado depois de cada um desses passos.
export function concluirAgenda(estado, { textos = {} } = {}) {
  let saida = 'resposta';
  if (estado.abrir_consulta && !estado.consulta_aberta) saida = 'consulta';
  else if (estado.aviso && !estado.aviso_enviado) saida = 'aviso';
  else if (estado.consulta_id && estado.aviso_enviado && !estado.consulta_notificada) saida = 'notificada';
  return comMarca({ ...estado, saida, consulta_params: saida === 'consulta' ? parametrosDaConsulta(estado.abrir_consulta, textos) : null });
}

// Argumentos de `agente.registrar_consulta_equipe`: tipo, pergunta e a
// preferência (só as chaves que o banco aceita: dias, periodos, observacao,
// motivo e prioridade, todas em texto). A pergunta sem palavras da família usa
// o texto do config (`textosSistema.agenda`).
export function parametrosDaConsulta(consulta, textos = {}) {
  const padrao = consulta.pergunta_chave === 'reuniao_da_equipe' ? textos.perguntaReuniaoDaEquipe : textos.perguntaHorario;
  const pergunta = curto(consulta.pergunta, 300) || curto(padrao, 300);
  const preferencia = {};
  for (const [chave, valor] of Object.entries({ ...(consulta.preferencia ?? {}), motivo: consulta.motivo, prioridade: consulta.prioridade === 'alta' ? 'alta' : null })) {
    const texto = curto(valor, 200);
    if (texto) preferencia[chave] = texto;
  }
  return { tipo: consulta.tipo, pergunta, preferencia };
}

// Depois de `agente.registrar_consulta_equipe`.
export function lerConsultaAberta(estado, resposta) {
  const consulta = resultadoDoBanco(resposta);
  if (!consulta || consulta.ok !== true) {
    // A consulta não abriu: o modelo não recebe a promessa de que a equipe foi avisada.
    return comMarca({
      ...estado,
      consulta_aberta: true,
      consulta_falhou: true,
      resultado: estado.resultado?.estado === 'aberta' ? { estado: 'falhou', erro: 'consulta_nao_aberta' } : estado.resultado,
    });
  }
  const aviso = consulta.mensagem_grupo && consulta.grupo_jid ? { jid: consulta.grupo_jid, texto: consulta.mensagem_grupo } : estado.aviso;
  return comMarca({
    ...estado,
    consulta_aberta: true,
    consulta_id: textoLimpo(consulta.consulta_id) || null,
    consulta_duplicada: consulta.duplicado === true,
    aviso: aviso ?? null,
    instrucao: textoLimpo(consulta.instrucao_agente) || null,
  });
}

// Depois do envio do aviso ao grupo (UAZAPI). Aviso interno: não passa por
// `agente.pode_enviar`. Falha do aviso não desfaz a reunião nem a consulta.
export function lerAvisoEnviado(estado, resposta) {
  return comMarca({ ...estado, aviso_enviado: true, aviso_saiu: !falhouChamada(resposta) });
}

export function lerConsultaNotificada(estado) {
  return comMarca({ ...estado, consulta_notificada: true });
}

// Nó 17 "Resposta da Ferramenta": o JSON que o modelo (ou a entrada B do
// fluxo 3) recebe. Nunca leva id de evento, de calendário, de sessão nem de
// conversa. Sem `resultado`, é falha.
export function montarRespostaAgenda(estado) {
  const resultado = estado.resultado ?? { estado: 'falhou', erro: 'sem_resultado' };
  const resposta = { origem: ORIGEM_AGENDA_ISADORA, estado: resultado.estado };
  for (const chave of ['texto', 'dia_semana', 'data', 'hora', 'link', 'inicio', 'consultada_em', 'valida_ate', 'erro']) {
    if (resultado[chave] !== undefined && resultado[chave] !== null) resposta[chave] = resultado[chave];
  }
  if (Array.isArray(resultado.opcoes)) resposta.opcoes = resultado.opcoes;
  if (estado.instrucao) resposta.instrucao = estado.instrucao;
  return resposta;
}

// Texto do horário de uma opção, para os testes e para a entrada B.
export function textoDeOpcao(opcao) {
  return opcao?.texto ?? textoDoHorario(Date.parse(opcao?.inicio));
}
