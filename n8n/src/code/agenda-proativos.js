// Entrada B do fluxo 3, nós 42 a 47 (PRD 19.4 v4.3): o que a Isadora escreve
// por iniciativa própria em torno da agenda (lembrete da véspera, remarcação
// depois de uma falta, devolutiva de consulta à equipe e retomada de um
// horário liberado) e a retomada das opções vencidas dentro da cadência de
// follow-up (nós 36 a 41). Funções puras, embutidas nos nós Code; os testes
// importam as mesmas.
//
// Contrato com o banco: `agente.proativos_agenda_devidos()` devolve os itens
// já liberados e reservados (freio, `nao_contatar`, pausa, transferência
// aberta, modo, lista de teste, janela e uma mensagem de conteúdo por dia).
// Contrato com o fluxo 4: o lembrete chama `conferir_evento` (o horário e o
// link atuais do evento) e a retomada de horário chama `consultar`; falta e
// devolutiva não consultam a agenda. Data, hora e link só entram na mensagem
// se vierem do fluxo 4 ou do banco (PRD 11.11 item 9).
//
// Nenhum texto para a família mora aqui: o texto base vem de `mensagem_modelo`
// (banco) e o modelo só reescreve a redação. O único texto do código é o
// rótulo da linha que entrega ao modelo o fato confirmado pela equipe, que
// vem do config (`textosSistema.agenda.rotuloFatoDaEquipe`).

import { descreverHorario, diaDaSemana, dataCurta } from './agenda.js';
import { comMarca, resultadoDoBanco, textoLimpo } from './resultado-no.js';
import { formatarUltimasMensagens } from './followup.js';

export const TIPOS_DA_AGENDA = ['lembrete', 'falta', 'devolutiva', 'horario'];

function trocarVariaveis(modelo, valores) {
  let texto = textoLimpo(modelo);
  for (const [chave, valor] of Object.entries(valores)) texto = texto.split(`{${chave}}`).join(textoLimpo(valor));
  return texto;
}

// Nó 42 "Separar Envios da Agenda": um item por envio devido.
export function separarEnviosDaAgenda(resposta) {
  const resultado = resultadoDoBanco(resposta);
  if (!resultado || resultado.ok !== true || !Array.isArray(resultado.itens)) return [];
  const listas = resultado.validador?.listas ?? null;
  return resultado.itens
    .filter((item) => item && TIPOS_DA_AGENDA.includes(item.tipo) && textoLimpo(item.conversa_id) && textoLimpo(item.wa_jid))
    .map((item) => {
      const base = {
        tipo: item.tipo,
        execucao_id: textoLimpo(item.execucao_id) || null,
        sessao_id: textoLimpo(item.sessao_id) || null,
        consulta_id: textoLimpo(item.consulta_id) || null,
        conversa_id: textoLimpo(item.conversa_id),
        wa_jid: textoLimpo(item.wa_jid),
        nome: textoLimpo(item.nome),
        texto_base: textoLimpo(item.texto_base),
        texto_modelo: textoLimpo(item.texto_modelo),
        texto_horario: textoLimpo(item.texto_horario),
        hora: textoLimpo(item.hora),
        link: textoLimpo(item.link),
        pergunta: textoLimpo(item.pergunta),
        resposta: textoLimpo(item.resposta),
        preferencia: item.preferencia && typeof item.preferencia === 'object' ? item.preferencia : {},
        data_hora: textoLimpo(item.data_hora),
        listas,
        // O lembrete confere o evento no calendário e a retomada de horário
        // consulta a agenda; falta e devolutiva não tocam no Google.
        operacao_agenda: item.tipo === 'lembrete' ? 'conferir_evento' : item.tipo === 'horario' ? 'consultar' : null,
        consultar_agenda: item.tipo === 'lembrete' || item.tipo === 'horario',
        agenda_horarios: [],
        links_permitidos: [],
        agenda_estados: [],
        agenda_reuniao_marcada: false,
        ultimas_mensagens_texto: formatarUltimasMensagens([]),
        tempo_sem_resposta: '',
      };
      return comMarca({ ...base, entrada_agenda: entradaDaAgenda(base) });
    });
}

// Texto que a retomada de horário pede à agenda: os dias e períodos que a
// família contou à Isadora, como ficaram na consulta.
export function preferenciaDaConsulta(preferencia) {
  return [preferencia?.dias, preferencia?.periodos, preferencia?.observacao]
    .map((parte) => textoLimpo(parte))
    .filter(Boolean)
    .join(' ');
}

// Nó 43 "Conferir Agenda", entradas do fluxo 4 para o item.
export function entradaDaAgenda(item) {
  return {
    operacao: item.operacao_agenda,
    modo: 'sugerir',
    conversa_id: item.conversa_id,
    id_opcao: '',
    preferencia: item.tipo === 'horario' ? preferenciaDaConsulta(item.preferencia) : '',
    email: '',
    email_parceiro: '',
    motivo: '',
    tipo: '',
    pergunta: '',
    maximo: item.tipo === 'horario' ? 1 : 2,
  };
}

function ehAmanha(inicioIso, agoraIso) {
  const amanha = dataCurta(Date.parse(agoraIso) + 24 * 60 * 60 * 1000);
  return dataCurta(Date.parse(inicioIso)) === amanha;
}

// Depois do nó 43 (ou direto, para falta e devolutiva): decide se a mensagem
// sai e com que texto base. `respostaAgenda` é o retorno do fluxo 4.
//   registrar: o que fechar depois (lembrete, falta, consulta ou nada).
export function lerAgendaProativa(item, respostaAgenda, { agora, rotuloFatoDaEquipe }) {
  const retorno = respostaAgenda && typeof respostaAgenda === 'object' && respostaAgenda.origem === 'agenda_isadora' ? respostaAgenda : null;
  const base = { ...item, agenda_resposta_estado: retorno?.estado ?? null };

  if (item.tipo === 'falta') {
    return comMarca({ ...base, enviar: item.texto_base.length > 0, registrar: 'falta', motivo_sem_envio: item.texto_base ? null : 'sem_texto_base' });
  }

  if (item.tipo === 'devolutiva') {
    const fato = textoLimpo(item.resposta);
    if (!fato) return comMarca({ ...base, enviar: false, registrar: 'nada', motivo_sem_envio: 'sem_resposta_da_equipe' });
    const rotulo = textoLimpo(rotuloFatoDaEquipe);
    return comMarca({ ...base, enviar: true, registrar: 'consulta', texto_base: `${rotulo} ${fato}`.trim() });
  }

  if (item.tipo === 'lembrete') {
    const estado = retorno?.estado;
    if (estado === 'evento_ok') {
      return comMarca({
        ...base,
        enviar: true,
        registrar: 'lembrete',
        agenda_horarios: [retorno.texto].filter(Boolean),
        links_permitidos: [retorno.link || item.link].filter(Boolean),
        agenda_estados: ['evento_ok'],
        agenda_reuniao_marcada: true,
      });
    }
    if (estado === 'evento_movido') {
      // Vale o horário atual. "Amanhã" só serve se o novo dia é amanhã; senão a
      // sessão já foi atualizada e o lembrete novo nasce do banco.
      if (!ehAmanha(retorno.inicio, agora) || !item.texto_modelo) {
        return comMarca({ ...base, enviar: false, registrar: 'nada', motivo_sem_envio: 'lembrete_adiado_evento_movido' });
      }
      const link = retorno.link || item.link;
      return comMarca({
        ...base,
        enviar: true,
        registrar: 'lembrete',
        texto_base: trocarVariaveis(item.texto_modelo, { nome: item.nome, hora: retorno.hora, link }),
        agenda_horarios: [retorno.texto].filter(Boolean),
        links_permitidos: [link].filter(Boolean),
        agenda_estados: ['evento_movido'],
        agenda_reuniao_marcada: true,
      });
    }
    if (estado === 'evento_apagado') {
      return comMarca({ ...base, enviar: false, registrar: 'nada', motivo_sem_envio: 'evento_apagado' });
    }
    // Google fora do ar ou resposta que não veio: o lembrete volta uma vez.
    return comMarca({ ...base, enviar: false, registrar: 'lembrete', motivo_sem_envio: 'agenda_indisponivel' });
  }

  // horario: a Edilaine abriu um horário. Só sai com opção consultada agora.
  const opcao = retorno?.estado === 'opcoes' ? retorno.opcoes?.[0] : null;
  if (!opcao) return comMarca({ ...base, enviar: false, registrar: 'nada', motivo_sem_envio: retorno?.estado ?? 'sem_retorno' });
  return comMarca({
    ...base,
    enviar: item.texto_base.length > 0,
    registrar: 'consulta',
    texto_base: trocarVariaveis(item.texto_base, { opcao_1: opcao.texto }),
    agenda_horarios: retorno.opcoes.map((o) => o.texto).filter(Boolean),
    agenda_estados: ['opcoes'],
    motivo_sem_envio: item.texto_base ? null : 'sem_texto_base',
  });
}

// Nó "Fechar Agenda": ponto único antes do registro, venha do envio, da
// reprovação, da recusa do `pode_enviar` ou de um item que nem chegou a ser
// escrito.
export function fecharEnvioDaAgenda(estado) {
  const saiu = estado.enviar === true && estado.followup_aprovado === true && estado.pode_enviar === true && estado.envio_saiu === true;
  // Consulta só se fecha como devolvida quando a mensagem saiu; se não saiu,
  // o banco a serve de novo depois de alguns minutos.
  const registrar = estado.registrar === 'consulta' && !saiu ? 'nada' : estado.registrar;
  return comMarca({ ...estado, agenda_ok: saiu, registrar, texto_enviado: saiu ? estado.texto_followup : null });
}

// Retomada das opções vencidas dentro da cadência (nós 36 a 41): o banco
// devolve `precisa_agenda` e o texto base com {opcao_1} e {opcao_2}; o fluxo 4
// devolve as opções consultadas agora. Sem opção, o retorno não sai (a
// execução volta uma vez na próxima janela).
export function aplicarAgendaNoFollowup(item, respostaAgenda) {
  const retorno = respostaAgenda && typeof respostaAgenda === 'object' && respostaAgenda.origem === 'agenda_isadora' ? respostaAgenda : null;
  const opcoes = retorno?.estado === 'opcoes' && Array.isArray(retorno.opcoes) ? retorno.opcoes : [];
  if (opcoes.length === 0) {
    return comMarca({ ...item, agenda_ok: false, followup_aprovado: false, followup_motivo: `agenda_${retorno?.estado ?? 'sem_retorno'}`, texto_followup: null });
  }
  const texto = trocarVariaveis(item.texto_base, { opcao_1: opcoes[0].texto, opcao_2: opcoes[1]?.texto ?? opcoes[0].texto });
  return comMarca({
    ...item,
    agenda_ok: true,
    texto_base: texto,
    agenda_horarios: opcoes.map((opcao) => opcao.texto).filter(Boolean),
    agenda_estados: ['opcoes'],
  });
}

// Dia e data do horário de uma opção (útil aos testes e ao lembrete).
export function textoDeDiaEData(inicioIso) {
  const ms = Date.parse(inicioIso);
  return `${diaDaSemana(ms)}, ${dataCurta(ms)}`;
}

export function horarioDe(inicioIso, blocoMinutos = 30) {
  return descreverHorario(Date.parse(inicioIso), blocoMinutos);
}
