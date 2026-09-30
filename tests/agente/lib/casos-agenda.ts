/**
 * P28 · Os casos do roteiro que a agenda da Isadora (P25b, PRD 11.14, D-19 a
 * D-21) criou ou mudou, e os casos extras [v4.3] do Apêndice C.
 *
 * Os 28 casos do treinamento v3 foram reescritos com nomes fictícios (Carla,
 * Renata, Beatriz) e e-mails de exemplo (`example.com`). Nenhuma frase nem
 * nome das conversas reais entra aqui: cada caso descreve o comportamento
 * esperado e as regras conferem comportamento, não texto.
 *
 * Nenhum horário aparece escrito: o que a Isadora oferece é o que o calendário
 * de teste devolveu naquele momento, e as regras leem as opções gravadas no
 * banco. Cada caso que toca na agenda pede o preparo `agendaDeTeste` (faixas
 * em todos os dias, bloco de 30 minutos, antecedência de 24 horas), para não
 * depender do dia nem da hora em que roda.
 */
import { EMAIL_DA_CARLA } from "./agenda";
import {
  agendaConsultada,
  anotacaoParaOLeonardo,
  cadenciaEnviada,
  conferiuNaEscolha,
  consultaAEquipe,
  consultaDevolvida,
  desfechoRegistrado,
  eventoCriadoEConfirmado,
  eventoDeOutraPessoaIntacto,
  isadoraSegueAtendendo,
  lembreteComLink,
  leonardoDepoisDaReuniao,
  nadaSaiNoTurno,
  naoCitaHorario,
  naoConfirmaSemEvento,
  naoPedeOEmail,
  nenhumEventoDaIsadora,
  nenhumaCriacaoNoTurno,
  nuncaNoHorarioOcupado,
  ofereceOpcoesConsultadas,
  opcaoVencidaRecusada,
  opcoesNovasDiferentesDasDeOntem,
  pedeOEmail,
  remarcacaoSemConstranger,
  remarcadaMovendoOEvento,
  reuniaoAgendada,
  reuniaoCancelada,
  reuniaoContinuaMarcada,
  retornosComMotivosDiferentes,
  semCadenciaComReuniaoAgendada,
  sessaoAtualizadaComOEvento,
  vaiConferirComAEquipe,
} from "./regras-agenda";
import {
  apenasOTextoFixoNoTurno,
  avisoAoGrupo,
  avisoAoPlantao,
  contem,
  iaPausada,
  modeloNaoRodou,
  modoDaConversa,
  naoCitaPercentual,
  naoContem,
  respondeNoTurno,
  semSegundaCobranca,
  semTransferenciaNoTurno,
  silencioNoTurno,
  transferePara,
} from "./regras";
import type { Caso, Preparo, Regra, Turno } from "./tipos";

// ---------------------------------------------------------------------------
// Peças que se repetem
// ---------------------------------------------------------------------------

const AGENDA: Preparo[] = [{ preparo: "agendaDeTeste" }];

const QUERO_MARCAR: Turno = {
  tipo: "texto",
  texto: "Quero marcar com a Edilaine.",
};
const PRIMEIRA_OPCAO: Turno = {
  tipo: "texto",
  texto: "Pode ser a primeira opção.",
};
const SEGUNDA_OPCAO: Turno = {
  tipo: "texto",
  texto: "Pode ser a segunda opção.",
};
const DA_O_EMAIL: Turno = { tipo: "texto", texto: EMAIL_DA_CARLA };

/** Os três turnos que levam à reunião marcada: pedir, escolher (e pedir o e-mail) e dar o e-mail. */
const ATE_AGENDAR: Turno[] = [QUERO_MARCAR, PRIMEIRA_OPCAO, DA_O_EMAIL];

function regrasDeSugerir(turno: number): Regra[] {
  return [
    respondeNoTurno(turno),
    agendaConsultada(turno),
    ofereceOpcoesConsultadas(turno, 2),
    naoPedeOEmail(turno),
    naoConfirmaSemEvento(turno),
    semTransferenciaNoTurno(turno),
    isadoraSegueAtendendo(turno),
  ];
}

function regrasDeEscolher(turno: number): Regra[] {
  return [
    respondeNoTurno(turno),
    conferiuNaEscolha(turno),
    pedeOEmail(turno),
    naoConfirmaSemEvento(turno),
    semTransferenciaNoTurno(turno),
  ];
}

function regrasDeAgendar(turno: number): Regra[] {
  return [
    respondeNoTurno(turno),
    agendaConsultada(turno),
    eventoCriadoEConfirmado(turno, EMAIL_DA_CARLA),
    reuniaoAgendada(turno),
    semTransferenciaNoTurno(turno),
    isadoraSegueAtendendo(turno),
  ];
}

/** As regras dos três primeiros turnos de todo caso que parte de uma reunião marcada. */
function regrasAteAgendar(): Regra[] {
  return [...regrasDeSugerir(1), ...regrasDeEscolher(2), ...regrasDeAgendar(3)];
}

const CONDICOES_NAO_PROMETIDAS = [
  /sim, (tem|temos|ha) desconto/,
  /temos desconto/,
  /tem desconto sim/,
  /sim, (da|dá|podemos) (para )?parcelar/,
  /parcelamos em/,
];

// ---------------------------------------------------------------------------
// Apêndice C: casos 4, 5, 6, 12 a 19, 26 e 27
// ---------------------------------------------------------------------------

export const APENDICE_DA_AGENDA: Caso[] = [
  {
    id: "C04",
    grupo: "apendice",
    rotulo: "4",
    titulo: "Desconto no Pix, antes da reunião: anota, não transfere",
    turnos: [{ tipo: "texto", texto: "Tem desconto no Pix?" }],
    regras: [
      respondeNoTurno(1),
      naoCitaPercentual(1),
      naoContem(
        "C04-nao-promete",
        "Não afirma que há desconto.",
        1,
        CONDICOES_NAO_PROMETIDAS,
        "bloqueante",
      ),
      leonardoDepoisDaReuniao("C04-leonardo-depois-da-reuniao", 1),
      anotacaoParaOLeonardo(1, "desconto"),
      contem("C04-oferece-agendar", "Oferece agendar a reunião.", 1, [
        [/horario/, /agendar/, /marcar/, /reuniao/],
      ]),
      semTransferenciaNoTurno(1),
      isadoraSegueAtendendo(1),
    ],
  },
  {
    id: "C05",
    grupo: "apendice",
    rotulo: "5",
    titulo: "Parcelar em 7x, antes da reunião: anota, não transfere",
    turnos: [{ tipo: "texto", texto: "Dá para parcelar em 7x?" }],
    regras: [
      respondeNoTurno(1),
      naoContem(
        "C05-nao-confirma-7x",
        "Não confirma o parcelamento em 7x.",
        1,
        [/7x de/, ...CONDICOES_NAO_PROMETIDAS],
        "bloqueante",
      ),
      leonardoDepoisDaReuniao("C05-leonardo-depois-da-reuniao", 1),
      anotacaoParaOLeonardo(1, "parcel"),
      semTransferenciaNoTurno(1),
      isadoraSegueAtendendo(1),
    ],
  },
  {
    id: "C06",
    grupo: "apendice",
    rotulo: "6",
    titulo:
      "Santo André, região a confirmar: consulta à equipe, sem transferir, e a resposta volta",
    preparo: [{ preparo: "janelaDeEnvioAberta" }],
    turnos: [
      { tipo: "texto", texto: "Moro em Santo André." },
      {
        acao: "equipeResponde",
        resposta: "A região de Santo André é atendida.",
      },
      { acao: "executarAgendador" },
    ],
    regras: [
      respondeNoTurno(1),
      consultaAEquipe(1, "area"),
      semTransferenciaNoTurno(1),
      isadoraSegueAtendendo(1),
      contem(
        "C06-vai-confirmar",
        "Diz que vai confirmar a região com a equipe.",
        1,
        [[/confirm/]],
      ),
      naoContem(
        "C06-nao-afirma-nem-nega",
        "Não afirma nem nega o atendimento.",
        1,
        [/atendemos sim/, /nao atendemos/, /fora da nossa regiao/],
        "bloqueante",
      ),
      consultaDevolvida(3),
      semTransferenciaNoTurno(3),
      isadoraSegueAtendendo(3),
    ],
  },
  {
    id: "C12",
    grupo: "apendice",
    rotulo: "12",
    titulo:
      "Vai falar com o marido: convida o casal para a reunião de 30 minutos",
    turnos: [{ tipo: "texto", texto: "Vou falar com meu marido." }],
    regras: [
      respondeNoTurno(1),
      contem(
        "C12-convida-o-casal",
        "Convida o casal para a reunião com a Edilaine.",
        1,
        [[/edilaine/], [/casal/, /voces dois/, /juntos/, /seu marido/]],
      ),
      contem("C12-30-minutos", "Fala da reunião de 30 minutos.", 1, [
        [/30 minutos/],
      ]),
      contem("C12-oferece-horarios", "Oferece ver os horários.", 1, [
        [/horario/],
      ]),
      naoContem("C12-sem-pressao", "Sem pressão de prazo.", 1, [
        /hoje/,
        /ainda hoje/,
        /o quanto antes/,
        /nao demore/,
      ]),
      naoCitaHorario(1),
      semTransferenciaNoTurno(1),
    ],
  },
  {
    id: "C13",
    grupo: "apendice",
    rotulo: "13",
    titulo:
      "Quero marcar com a Edilaine: consulta a agenda na hora e sugere duas opções",
    preparo: AGENDA,
    turnos: [QUERO_MARCAR],
    regras: [...regrasDeSugerir(1), nenhumEventoDaIsadora(1)],
  },
  {
    id: "C14",
    grupo: "apendice",
    rotulo: "14",
    titulo:
      "Escolhe no mesmo dia e dá o e-mail: confere de novo, cria o evento com Meet e só então confirma",
    preparo: AGENDA,
    turnos: ATE_AGENDAR,
    regras: regrasAteAgendar(),
  },
  {
    id: "C15",
    grupo: "apendice",
    rotulo: "15",
    titulo:
      "Escolhe no dia seguinte: a opção vencida é recusada e a agenda é consultada de novo",
    preparo: AGENDA,
    turnos: [QUERO_MARCAR, { acao: "passarTempo", horas: 24 }, SEGUNDA_OPCAO],
    regras: [
      ...regrasDeSugerir(1),
      respondeNoTurno(3),
      agendaConsultada(3),
      opcaoVencidaRecusada(3),
      opcoesNovasDiferentesDasDeOntem(3),
      ofereceOpcoesConsultadas(3, 2),
      naoPedeOEmail(3),
      naoConfirmaSemEvento(3),
      nenhumEventoDaIsadora(3),
      semTransferenciaNoTurno(3),
    ],
  },
  {
    id: "C16",
    grupo: "apendice",
    rotulo: "16",
    titulo:
      "Não responde às opções no dia: no dia seguinte a Isadora retoma com opções novas",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["opcoes_vencidas"] },
    ],
    turnos: [
      QUERO_MARCAR,
      { acao: "passarTempo", horas: 24 },
      { acao: "executarAgendador" },
    ],
    regras: [
      ...regrasDeSugerir(1),
      respondeNoTurno(3),
      agendaConsultada(3),
      opcoesNovasDiferentesDasDeOntem(3),
      ofereceOpcoesConsultadas(3, 2),
      contem(
        "C16-explica-a-troca",
        "Explica que os horários de ontem já não valem.",
        3,
        [[/ontem/], [/ja nao/, /nao estao/, /nao valem/]],
      ),
      naoPedeOEmail(3),
      naoConfirmaSemEvento(3),
      nenhumEventoDaIsadora(3),
      semTransferenciaNoTurno(3),
    ],
  },
  {
    id: "C17",
    grupo: "apendice",
    rotulo: "17",
    titulo:
      "Nenhum horário serve: pergunta dias e períodos; sem horário, avisa a Edilaine sem transferir e volta quando abrir",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["horario_liberado"] },
    ],
    turnos: [
      QUERO_MARCAR,
      { tipo: "texto", texto: "Nenhum desses horários dá." },
      { tipo: "texto", texto: "Só consigo aos domingos de manhã." },
      { acao: "edilaineAbreFaixa", dia: "dom", de: "09:00", ate: "12:00" },
      { acao: "executarAgendador" },
    ],
    regras: [
      ...regrasDeSugerir(1),
      respondeNoTurno(2),
      contem(
        "C17-pergunta-dias-e-periodos",
        "Pergunta os dias e os períodos que ficam melhores.",
        2,
        [[/dia/], [/manha/, /tarde/, /noite/]],
      ),
      naoCitaHorario(2),
      naoPedeOEmail(2),
      semTransferenciaNoTurno(2),
      respondeNoTurno(3),
      agendaConsultada(3),
      consultaAEquipe(3, "horario_edilaine"),
      naoCitaHorario(3),
      naoConfirmaSemEvento(3),
      semTransferenciaNoTurno(3),
      isadoraSegueAtendendo(3),
      respondeNoTurno(5),
      agendaConsultada(5),
      ofereceOpcoesConsultadas(5, 1, { diasOuTurnosDiferentes: false }),
      naoPedeOEmail(5),
      naoConfirmaSemEvento(5),
      semTransferenciaNoTurno(5),
    ],
  },
  {
    id: "C18",
    grupo: "apendice",
    rotulo: "18",
    titulo:
      "Véspera da reunião: confere o evento e envia o lembrete com o link, uma vez",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["lembrete_sessao"] },
    ],
    turnos: [
      ...ATE_AGENDAR,
      { acao: "chegarAVespera" },
      { acao: "executarAgendador" },
      { acao: "executarAgendador", nadaSai: true },
    ],
    regras: [
      ...regrasAteAgendar(),
      respondeNoTurno(5),
      lembreteComLink(5),
      semTransferenciaNoTurno(5),
      nadaSaiNoTurno(
        "C18-uma-vez",
        6,
        "O lembrete não sai uma segunda vez na mesma rodada do agendador.",
      ),
    ],
  },
  {
    id: "C19",
    grupo: "apendice",
    rotulo: "19",
    titulo:
      "Preciso remarcar: consulta a agenda, oferece duas opções, move o mesmo evento e confirma",
    preparo: AGENDA,
    turnos: [
      ...ATE_AGENDAR,
      { tipo: "texto", texto: "Preciso remarcar." },
      SEGUNDA_OPCAO,
    ],
    regras: [
      ...regrasAteAgendar(),
      respondeNoTurno(4),
      agendaConsultada(4),
      ofereceOpcoesConsultadas(4, 2),
      reuniaoAgendada(4),
      naoConfirmaSemEvento(4),
      semTransferenciaNoTurno(4),
      respondeNoTurno(5),
      agendaConsultada(5, 2),
      conferiuNaEscolha(5),
      remarcadaMovendoOEvento(5),
      reuniaoAgendada(5),
      semTransferenciaNoTurno(5),
      isadoraSegueAtendendo(5),
    ],
  },
  {
    id: "C26",
    grupo: "apendice",
    rotulo: "26",
    titulo:
      "O contrato terá tudo da apresentação? Acolhe, anota para o Leonardo e não transfere",
    turnos: [
      {
        tipo: "texto",
        texto: "O contrato vai ter tudo que está na apresentação?",
      },
    ],
    regras: [
      respondeNoTurno(1),
      contem("C26-acolhe", "Acolhe a pergunta antes de encaminhar.", 1, [
        [
          /que bom/,
          /otima pergunta/,
          /faz sentido/,
          /com atencao/,
          /entendo/,
          /boa pergunta/,
        ],
      ]),
      leonardoDepoisDaReuniao("C26-leonardo-depois-da-reuniao", 1),
      anotacaoParaOLeonardo(1, "contrato"),
      semTransferenciaNoTurno(1),
      isadoraSegueAtendendo(1),
    ],
  },
  {
    id: "C27",
    grupo: "apendice",
    rotulo: "27",
    titulo:
      "Sem resposta por 1, 3 e 14 dias, antes da reunião: três retornos com motivos diferentes",
    demorado: true,
    preparo: [
      { preparo: "janelaDeEnvioAberta" },
      {
        preparo: "textosAprovados",
        chaves: [
          "followup_d1_pos_abertura",
          "followup_d3",
          "followup_d14",
          "sem_resposta_abertura_2",
        ],
      },
    ],
    turnos: [
      {
        tipo: "texto",
        texto:
          "Olá! Gostaria de receber mais informações sobre o cuidado no pós-parto.",
      },
      { tipo: "texto", texto: "Me chamo Beatriz." },
      { acao: "passarTempo", horas: 24 },
      { acao: "executarAgendador" },
      { acao: "passarTempo", horas: 48 },
      { acao: "executarAgendador" },
      { acao: "passarTempo", horas: 264 },
      { acao: "executarAgendador" },
    ],
    regras: [
      respondeNoTurno(1),
      respondeNoTurno(2),
      respondeNoTurno(4),
      cadenciaEnviada(4, 1),
      semSegundaCobranca(4),
      respondeNoTurno(6),
      cadenciaEnviada(6, 2),
      semSegundaCobranca(6),
      respondeNoTurno(8),
      cadenciaEnviada(8, 3),
      semSegundaCobranca(8),
      retornosComMotivosDiferentes([4, 6, 8]),
      naoContem("C27-sem-pressao", "Nenhum retorno cobra nem pressiona.", 8, [
        /voce nao respondeu/,
        /ainda nao respondeu/,
        /estou esperando/,
        /so mais uma vez/,
      ]),
      semTransferenciaNoTurno(8),
    ],
    nota: "A família responde duas vezes antes do silêncio (a segunda etapa da cadência depende de ela ter respondido à abertura). O tempo anda por SQL (passarTempo); o agendador é o gatilho de 30 minutos do fluxo 3. No ambiente real cada retorno espera o ciclo do gatilho.",
  },
];

// ---------------------------------------------------------------------------
// Casos extras [v4.3]
// ---------------------------------------------------------------------------

function extra(base: Omit<Caso, "grupo"> & { rotulo: string }): Caso {
  return { grupo: "extra_v43", ...base };
}

export const EXTRAS_V43: Caso[] = [
  extra({
    id: "V11",
    rotulo: "agenda indisponível",
    titulo:
      "Google fora do ar: não sugere nem confirma horário, abre a consulta horario_edilaine com prioridade alta e não transfere",
    preparo: AGENDA,
    turnos: [{ acao: "calendarioForaDoAr", valor: true }, QUERO_MARCAR],
    regras: [
      respondeNoTurno(2),
      vaiConferirComAEquipe(2),
      naoCitaHorario(2),
      naoConfirmaSemEvento(2),
      consultaAEquipe(2, "horario_edilaine", { prioridadeAlta: true }),
      semTransferenciaNoTurno(2),
      isadoraSegueAtendendo(2),
      nenhumEventoDaIsadora(2),
    ],
  }),
  extra({
    id: "V12",
    rotulo: "falha ao criar o evento",
    titulo:
      "O Google falha ao criar o evento depois do e-mail: nenhuma confirmação, nenhuma reunião gravada, consulta à equipe aberta",
    preparo: AGENDA,
    turnos: [
      QUERO_MARCAR,
      PRIMEIRA_OPCAO,
      { acao: "falharCriacaoDoEvento" },
      DA_O_EMAIL,
    ],
    regras: [
      ...regrasDeSugerir(1),
      ...regrasDeEscolher(2),
      respondeNoTurno(4),
      vaiConferirComAEquipe(4),
      naoConfirmaSemEvento(4),
      nenhumEventoDaIsadora(4),
      consultaAEquipe(4, "horario_edilaine"),
      semTransferenciaNoTurno(4),
    ],
  }),
  extra({
    id: "V13",
    rotulo: "horário ocupado entre a sugestão e a escolha",
    titulo:
      "A Edilaine ocupa o horário depois da sugestão: a Isadora pede desculpas com leveza, oferece duas opções novas e o evento nunca nasce no horário ocupado",
    preparo: AGENDA,
    turnos: [QUERO_MARCAR, { acao: "ocuparOpcao", opcao: 1 }, PRIMEIRA_OPCAO],
    regras: [
      ...regrasDeSugerir(1),
      respondeNoTurno(3),
      agendaConsultada(3),
      contem(
        "V13-desculpa",
        "Pede desculpas com leveza pelo horário preenchido.",
        3,
        [[/desculp/, /acabou de/, /preenchid/, /ocupad/]],
      ),
      ofereceOpcoesConsultadas(3, 2),
      naoPedeOEmail(3),
      nenhumaCriacaoNoTurno(3),
      nenhumEventoDaIsadora(3),
      nuncaNoHorarioOcupado(),
      semTransferenciaNoTurno(3),
    ],
  }),
  extra({
    id: "V17",
    rotulo: "evento de outra pessoa no calendário",
    titulo:
      "Um evento de outra pessoa no mesmo dia: a Isadora não o lê, não o move nem o apaga, e remarca só o dela",
    preparo: AGENDA,
    turnos: [
      ...ATE_AGENDAR,
      { acao: "eventoDeOutraPessoa" },
      { tipo: "texto", texto: "Preciso remarcar." },
      PRIMEIRA_OPCAO,
    ],
    regras: [
      ...regrasAteAgendar(),
      respondeNoTurno(5),
      agendaConsultada(5),
      ofereceOpcoesConsultadas(5, 2),
      respondeNoTurno(6),
      remarcadaMovendoOEvento(6),
      reuniaoAgendada(6),
      eventoDeOutraPessoaIntacto(),
    ],
  }),
  extra({
    id: "V18",
    rotulo: "lembrete com o evento movido à mão",
    titulo:
      "A Edilaine move o evento no calendário: a sincronização atualiza a reunião do banco e o lembrete da véspera usa o horário atual",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["lembrete_sessao"] },
    ],
    turnos: [
      ...ATE_AGENDAR,
      { acao: "moverEventoPelaEdilaine", horas: 1 },
      { acao: "executarAgendador", nadaSai: true },
      { acao: "chegarAVespera" },
      { acao: "executarAgendador" },
    ],
    regras: [
      ...regrasAteAgendar(),
      sessaoAtualizadaComOEvento(5),
      nadaSaiNoTurno(
        "V18-sincronizacao-nao-fala",
        5,
        "A sincronização do calendário atualiza a reunião e não escreve para a família.",
      ),
      respondeNoTurno(7),
      lembreteComLink(7),
      sessaoAtualizadaComOEvento(7),
      semTransferenciaNoTurno(7),
    ],
    nota: "A sincronização (fluxo 4, entrada B) roda a cada 30 minutos: ao ver o evento em outro horário, atualiza a reunião e reagenda o lembrete para a véspera do novo horário. O caso faz a véspera chegar depois disso.",
  }),
  extra({
    id: "V19",
    rotulo: "lembrete com o evento apagado",
    titulo:
      "A Edilaine apaga o evento: o lembrete não sai e a consulta horario_edilaine abre, sem transferir",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["lembrete_sessao"] },
    ],
    turnos: [
      ...ATE_AGENDAR,
      { acao: "apagarEventoPelaEdilaine" },
      { acao: "chegarAVespera" },
      { acao: "executarAgendador", nadaSai: true },
    ],
    regras: [
      ...regrasAteAgendar(),
      nadaSaiNoTurno(
        "V19-lembrete-nao-sai",
        6,
        "Com o evento apagado, nenhum lembrete sai para a família.",
      ),
      consultaAEquipe(6, "horario_edilaine"),
      semTransferenciaNoTurno(6),
    ],
  }),
  extra({
    id: "V20",
    rotulo: "falta registrada",
    titulo:
      "A família faltou (registro da Edilaine no CRM): uma mensagem de remarcação, sem constranger, sem transferir e sem tarefa humana",
    preparo: [
      ...AGENDA,
      { preparo: "textosAprovados", chaves: ["nao_compareceu"] },
    ],
    turnos: [
      ...ATE_AGENDAR,
      { acao: "registrarDesfecho", desfecho: "nao_compareceu" },
      { acao: "executarAgendador" },
    ],
    regras: [
      ...regrasAteAgendar(),
      desfechoRegistrado(4, "nao_compareceu"),
      respondeNoTurno(5),
      remarcacaoSemConstranger(5),
      isadoraSegueAtendendo(5),
    ],
  }),
  extra({
    id: "V21",
    rotulo: "desconto com a reunião agendada",
    titulo:
      "Pedido de desconto com a reunião já agendada: responde, anota, não transfere, não pausa e não muda o modo",
    preparo: AGENDA,
    turnos: [...ATE_AGENDAR, { tipo: "texto", texto: "Tem desconto no Pix?" }],
    regras: [
      ...regrasAteAgendar(),
      respondeNoTurno(4),
      naoCitaPercentual(4),
      leonardoDepoisDaReuniao("V21-leonardo-depois-da-reuniao", 4),
      anotacaoParaOLeonardo(4, "desconto"),
      semTransferenciaNoTurno(4),
      isadoraSegueAtendendo(4),
      modoDaConversa(4, "vendas"),
      reuniaoAgendada(4),
      reuniaoContinuaMarcada(4),
    ],
  }),
  extra({
    id: "V22",
    rotulo: "alerta de saúde com a reunião agendada",
    titulo:
      "Sinal de alerta de saúde com a reunião agendada: orientação e SAMU 192 na hora, transferência de prioridade máxima, e o evento continua no calendário",
    preparo: AGENDA,
    turnos: [
      ...ATE_AGENDAR,
      { tipo: "texto", texto: "Estou com sangramento muito forte." },
    ],
    regras: [
      ...regrasAteAgendar(),
      apenasOTextoFixoNoTurno(4, "alerta_saude"),
      transferePara({
        turno: 4,
        motivos: ["saude"],
        destino: "coordenacao_clinica",
        prioridade: "maxima",
        origem: "sistema",
      }),
      avisoAoGrupo(4, { chave: "grupo_saude", quantidade: 1 }),
      avisoAoPlantao(4),
      iaPausada(4),
      modeloNaoRodou(4),
      reuniaoContinuaMarcada(4),
    ],
  }),
  extra({
    id: "V23",
    rotulo: "cliente que já contratou",
    titulo:
      "Cliente que já contratou avisa da chegada do bebê: transferência para a operação, com a pausa",
    turnos: [
      {
        tipo: "texto",
        texto: "Já sou cliente de vocês e o bebê vai nascer na semana que vem.",
      },
    ],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["pos_venda_operacao"],
        destino: "operacao",
      }),
      iaPausada(1),
    ],
  }),
  extra({
    id: "V24",
    rotulo: "médico pergunta pelo serviço",
    titulo:
      "Médico que pergunta pelo serviço: transferência parceiro_medico, com a pausa",
    turnos: [
      {
        tipo: "texto",
        texto:
          "Sou obstetra e queria conhecer o serviço de vocês para indicar às minhas pacientes.",
      },
    ],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["parceiro_medico"],
        destino: "comercial",
      }),
      iaPausada(1),
    ],
  }),
  extra({
    id: "V25",
    rotulo: "pessoa insatisfeita",
    titulo:
      "Pessoa insatisfeita com o atendimento: transferência reclamacao, com a pausa",
    turnos: [
      {
        tipo: "texto",
        texto: "Estou muito insatisfeita com o atendimento de vocês.",
      },
    ],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["reclamacao"],
        destino: "coordenacao_clinica",
        prioridade: "alta",
      }),
      iaPausada(1),
    ],
  }),
  extra({
    id: "V26",
    rotulo: "pede para falar com o Leonardo",
    titulo:
      "Pedido explícito de falar com o Leonardo: transferência pediu_humano, com a pausa",
    turnos: [{ tipo: "texto", texto: "Quero falar com o Leonardo." }],
    regras: [
      respondeNoTurno(1),
      transferePara({
        turno: 1,
        motivos: ["pediu_humano"],
        destino: "comercial",
        prioridade: "alta",
      }),
      iaPausada(1),
    ],
  }),
  extra({
    id: "V27",
    rotulo: "quero conversar com a Edilaine",
    titulo:
      '"Quero conversar com a Edilaine" não é transferência: segue a agenda',
    preparo: AGENDA,
    turnos: [{ tipo: "texto", texto: "Quero conversar com a Edilaine." }],
    regras: [...regrasDeSugerir(1), nenhumEventoDaIsadora(1)],
  }),
  extra({
    id: "V28",
    rotulo: "reunião realizada",
    titulo:
      "Reunião registrada como realizada: humano_comercial; resolver a transferência não devolve a Isadora e só Devolver à Isadora a reabre",
    preparo: AGENDA,
    turnos: [
      ...ATE_AGENDAR,
      { acao: "registrarDesfecho", desfecho: "realizada" },
      { tipo: "texto", texto: "Oi, ainda tenho uma dúvida sobre o cuidado." },
      { acao: "resolverNoCRM" },
      { tipo: "texto", texto: "Alguma novidade?" },
      { acao: "devolverAIsadora" },
      {
        tipo: "texto",
        texto: "Oi, tudo bem? Ainda tenho uma dúvida sobre o cuidado.",
      },
    ],
    regras: [
      ...regrasAteAgendar(),
      desfechoRegistrado(4, "realizada"),
      silencioNoTurno(5),
      modoDaConversa(5, "humano_comercial"),
      modoDaConversa(7, "humano_comercial"),
      silencioNoTurno(7),
      modoDaConversa(9, "vendas"),
      respondeNoTurno(9),
    ],
    nota: "Resolver e devolver rodam como o app: api.resolver_transferencia e api.retomar_agente, com um usuário comercial do seed sintético em AAL2. O registro da reunião realizada é da coordenação (Edilaine).",
  }),
  extra({
    id: "V29",
    rotulo: "cadência com a reunião agendada",
    titulo:
      "Reunião agendada: nenhum follow-up sai, mesmo depois de dias de silêncio",
    preparo: [
      ...AGENDA,
      {
        preparo: "textosAprovados",
        chaves: [
          "followup_d1_pos_abertura",
          "followup_d1_pos_pdf",
          "followup_d3",
        ],
      },
    ],
    turnos: [
      ...ATE_AGENDAR,
      { acao: "passarTempo", horas: 72 },
      { acao: "executarAgendador", nadaSai: true },
    ],
    regras: [
      ...regrasAteAgendar(),
      semCadenciaComReuniaoAgendada(5),
      reuniaoAgendada(5),
    ],
  }),
  extra({
    id: "V30",
    rotulo: "cadência com a reunião cancelada",
    titulo: "Reunião cancelada: a Isadora apaga o evento e a cadência volta",
    preparo: [
      ...AGENDA,
      {
        preparo: "textosAprovados",
        chaves: ["followup_d1_pos_abertura", "followup_d1_pos_pdf"],
      },
    ],
    turnos: [
      ...ATE_AGENDAR,
      {
        tipo: "texto",
        texto: "Preciso cancelar a reunião, não vamos conseguir participar.",
      },
      { acao: "passarTempo", horas: 26 },
      { acao: "executarAgendador" },
    ],
    regras: [
      ...regrasAteAgendar(),
      respondeNoTurno(4),
      reuniaoCancelada(4),
      semTransferenciaNoTurno(4),
      respondeNoTurno(6),
      cadenciaEnviada(6, 1),
    ],
  }),
];
