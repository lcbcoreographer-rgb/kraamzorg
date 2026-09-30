/**
 * P28 · Regras da agenda da Isadora (P25b, PRD 11.14, Treinamento v3 seção 3).
 *
 * Cada regra confere uma frase das "Regras da agenda" do treinamento sobre o
 * que o calendário de teste recebeu (`ResultadoCaso.agenda`) e sobre o banco
 * (reunião, opções, consultas à equipe). Nenhuma frase exata da Isadora: só
 * comportamento. As que dependem do que o modelo escolhe (consultar, pedir o
 * e-mail, criar) são `modelo`; as que o sistema garante sozinho (opção que
 * vence no dia, evento que só nasce com o horário livre) são `sistema`.
 *
 * Bloqueantes, por ordem do treinamento (seção 8): horário sem consulta e
 * reunião confirmada sem evento criado reprovam a versão.
 */
import { horarioEmPalavras } from "./agenda";
import {
  estadoAntesDoTurno,
  estadoDepoisDoTurno,
  falha,
  limitar,
  normalizar,
  regra,
  textosDaFamilia,
  transferenciasNovas,
} from "./regras";
import type {
  ChamadaDeAgenda,
  EstadoBanco,
  Gravidade,
  OpcaoLida,
  Origem,
  Regra,
  ResultadoCaso,
} from "./tipos";

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const PALAVRAS_DE_CONFIRMACAO = [
  "agendei",
  "agendada",
  "agendado",
  "marcada",
  "marcado",
  "confirmada",
  "confirmado",
  "prontinho",
  "combinado",
];

function chamadasDoTurno(res: ResultadoCaso, turno: number): ChamadaDeAgenda[] {
  return (res.agenda?.chamadas ?? []).filter((c) => c.turno === turno);
}

/** Consultas de ocupado e livre feitas no turno (a agenda consultada "agora"). */
function consultasDoTurno(
  res: ResultadoCaso,
  turno: number,
): ChamadaDeAgenda[] {
  return chamadasDoTurno(res, turno).filter(
    (c) => c.operacao === "livre-ocupado",
  );
}

function eventosDaIsadora(res: ResultadoCaso) {
  return (res.agenda?.eventos ?? []).filter(
    (e) => e.id.startsWith("kraam") && e.status !== "cancelled",
  );
}

function opcoesNovas(res: ResultadoCaso, turno: number): OpcaoLida[] {
  const antes = new Set(
    (estadoAntesDoTurno(res, turno)?.opcoes ?? []).map((o) => o.id),
  );
  return estadoDepoisDoTurno(res, turno).opcoes.filter((o) => !antes.has(o.id));
}

function sessaoAgendada(estado: EstadoBanco) {
  return estado.sessoes.find((s) => s.status === "agendada");
}

function dataDeHoje(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function diaLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function meta(
  id: string,
  descricao: string,
  turno: number,
  origem: Origem,
  gravidade: Gravidade,
) {
  return { id, descricao, origem, gravidade, turno };
}

// ---------------------------------------------------------------------------
// Sugerir
// ---------------------------------------------------------------------------

/** A agenda é consultada no turno, pelo menos `minimo` vezes ("nunca oferece horário sem consulta"). */
export function agendaConsultada(turno: number, minimo = 1): Regra {
  const id = `A-consulta-t${turno}`;
  return regra(
    meta(
      id,
      `A agenda da Edilaine é consultada no turno ${turno}${minimo > 1 ? ` (pelo menos ${minimo} vezes: na escolha e antes de criar)` : ""}.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const n = consultasDoTurno(res, turno).length;
      return n >= minimo
        ? []
        : [falha(id, `${n} consulta(s) ao calendário no turno ${turno}`)];
    },
  );
}

export function agendaNaoConsultada(turno: number): Regra {
  const id = `A-sem-consulta-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhuma consulta ao calendário no turno ${turno}.`,
      turno,
      "modelo",
      "conteudo",
    ),
    (res) =>
      consultasDoTurno(res, turno).length === 0
        ? []
        : [falha(id, "O calendário foi consultado")],
  );
}

/**
 * A resposta oferece `quantas` opções, todas as que as ferramentas acabaram
 * de gravar (texto no formato da agenda), de 30 minutos, respeitando a
 * antecedência e, quando pedido, em dias ou turnos diferentes.
 */
export function ofereceOpcoesConsultadas(
  turno: number,
  quantas = 2,
  { diasOuTurnosDiferentes = true }: { diasOuTurnosDiferentes?: boolean } = {},
): Regra {
  const id = `A-opcoes-t${turno}`;
  return regra(
    meta(
      id,
      `Oferece ${quantas} opção(ões) de 30 minutos que a agenda acabou de devolver e o banco guardou com a data de hoje${diasOuTurnosDiferentes && quantas > 1 ? ", em dias ou turnos diferentes" : ""}.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const novas = opcoesNovas(res, turno).filter(
        (o) => o.descartada_em === null && o.escolhida_em === null,
      );
      if (novas.length !== quantas)
        achados.push(
          falha(
            id,
            `${novas.length} opção(ões) gravada(s) no turno ${turno}, esperado ${quantas}`,
          ),
        );
      const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
      for (const o of novas) {
        const horario = horarioEmPalavras(o.inicio);
        const citou =
          texto.includes(normalizar(horario.diaSemana)) &&
          texto.includes(horario.data) &&
          texto.includes(normalizar(horario.hora));
        if (!citou)
          achados.push(
            falha(id, `A resposta não cita a opção gravada "${horario.texto}"`),
          );
        if (Date.parse(o.fim) - Date.parse(o.inicio) !== 30 * 60_000)
          achados.push(
            falha(id, `Opção "${horario.texto}" não tem 30 minutos`),
          );
        if (diaLocal(o.consultada_em) !== dataDeHoje())
          achados.push(falha(id, "Opção sem a data de hoje"));
        // valida_ate é a meia-noite que fecha o dia: o último segundo de validade ainda é hoje.
        if (
          diaLocal(new Date(Date.parse(o.valida_ate) - 1000).toISOString()) !==
          dataDeHoje()
        )
          achados.push(
            falha(id, `Opção "${horario.texto}" não vence no fim de hoje`),
          );
        if (Date.parse(o.inicio) < Date.parse(o.consultada_em) + 24 * 3_600_000)
          achados.push(
            falha(id, `Opção "${horario.texto}" dentro da antecedência mínima`),
          );
      }
      if (diasOuTurnosDiferentes && novas.length >= 2) {
        const [a, b] = novas.map((o) => horarioEmPalavras(o.inicio));
        const turnoDoDia = (h: string) =>
          Number(h.replace(/h.*/, "")) < 12 ? "manha" : "tarde";
        if (
          a &&
          b &&
          a.data === b.data &&
          turnoDoDia(a.hora) === turnoDoDia(b.hora)
        )
          achados.push(
            falha(
              id,
              `As duas opções são do mesmo dia e turno: ${a.texto} e ${b.texto}`,
            ),
          );
      }
      return achados;
    },
  );
}

/** Nenhum horário de reunião é citado na resposta (ex.: quando a agenda não devolveu nada). */
export function naoCitaHorario(turno: number): Regra {
  const id = `A-sem-horario-t${turno}`;
  return regra(
    meta(
      id,
      `A resposta do turno ${turno} não cita dia e hora de reunião.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const texto = textosDaFamilia(res, turno).join("\n");
      return /(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)[^.?!\n]{0,25}\d{1,2}h/i.test(
        texto,
      )
        ? [falha(id, `Citou horário: "${limitar(texto)}"`)]
        : [];
    },
  );
}

// ---------------------------------------------------------------------------
// E-mail e criação do evento
// ---------------------------------------------------------------------------

export function pedeOEmail(turno: number): Regra {
  const id = `A-pede-email-t${turno}`;
  return regra(
    meta(
      id,
      `Pede o e-mail para o convite no turno ${turno} (o único dado que ela pede).`,
      turno,
      "modelo",
      "conteudo",
    ),
    (res) =>
      /e-?mail/i.test(normalizar(textosDaFamilia(res, turno).join("\n")))
        ? []
        : [falha(id, "Não pediu o e-mail")],
  );
}

export function naoPedeOEmail(turno: number): Regra {
  const id = `A-sem-email-t${turno}`;
  return regra(
    meta(
      id,
      `Não pede o e-mail no turno ${turno}: o horário ainda não foi escolhido e conferido.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) =>
      /e-?mail/i.test(normalizar(textosDaFamilia(res, turno).join("\n")))
        ? [falha(id, "Pediu o e-mail cedo demais")]
        : [],
  );
}

/** O horário escolhido foi conferido no turno e ficou registrado como livre (segunda consulta). */
export function conferiuNaEscolha(turno: number): Regra {
  const id = `A-conferiu-t${turno}`;
  return regra(
    meta(
      id,
      `Na escolha, a agenda é consultada de novo e a opção fica registrada como conferida (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      if (consultasDoTurno(res, turno).length < 1)
        achados.push(falha(id, "Nenhuma consulta ao calendário na escolha"));
      const conferida = estadoDepoisDoTurno(res, turno).opcoes.some(
        (o) => o.conferida_em !== null,
      );
      if (!conferida)
        achados.push(falha(id, "Nenhuma opção conferida no banco"));
      return achados;
    },
  );
}

/**
 * O evento nasce com o horário livre: a última consulta ao calendário vem
 * antes da criação; o evento tem 30 minutos, Google Meet, convite enviado pelo
 * Google e o e-mail da família; a reunião fica no banco e o P1 avança. Só
 * depois a família recebe a confirmação, com dia, data e hora do evento.
 */
export function eventoCriadoEConfirmado(turno: number, email: string): Regra {
  const id = `A-evento-t${turno}`;
  return regra(
    meta(
      id,
      `Consulta a agenda uma última vez, cria o evento (30 min, Meet, convite, ${email}) e só então confirma, com dia, data e hora do evento (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const chamadas = chamadasDoTurno(res, turno);
      const ordem = chamadas.map((c) => c.operacao);
      const criacao = chamadas.find((c) => c.operacao === "criar");
      if (!criacao)
        return [falha(id, `Nenhum evento criado no turno ${turno}`)];
      const ultimaConsulta = ordem.lastIndexOf("livre-ocupado");
      if (ultimaConsulta < 0 || ultimaConsulta > ordem.indexOf("criar"))
        achados.push(
          falha(id, "A agenda não foi consultada imediatamente antes de criar"),
        );
      if (
        Date.parse(criacao.end ?? "") - Date.parse(criacao.start ?? "") !==
        30 * 60_000
      )
        achados.push(falha(id, "O evento não tem 30 minutos"));
      if (criacao.comMeet !== true) achados.push(falha(id, "Sem Google Meet"));
      if (criacao.sendUpdates !== "all")
        achados.push(falha(id, "O Google não envia o convite"));
      if (!(criacao.attendees ?? []).includes(email.toLowerCase()))
        achados.push(falha(id, `${email} não está entre os convidados`));
      if (!String(criacao.id ?? "").startsWith("kraam"))
        achados.push(falha(id, "Evento sem a marca de origem da Isadora"));

      const estado = estadoDepoisDoTurno(res, turno);
      const sessao = sessaoAgendada(estado);
      if (!sessao) achados.push(falha(id, "Nenhuma reunião agendada no banco"));
      else {
        if (sessao.agendada_por !== "isadora")
          achados.push(
            falha(id, `Reunião agendada por ${sessao.agendada_por}`),
          );
        if (!sessao.tem_evento)
          achados.push(
            falha(id, "A reunião não guarda o evento do calendário"),
          );
        if (!sessao.link_reuniao?.startsWith("https://"))
          achados.push(falha(id, "A reunião não guarda o link do Meet"));
      }
      if (estado.oportunidade?.estagio_p1 !== "sessao_venda_agendada")
        achados.push(
          falha(
            id,
            `P1 em ${estado.oportunidade?.estagio_p1}, esperado sessao_venda_agendada`,
          ),
        );
      // O calendário só é conhecido no fim do caso: o evento criado aqui pode ter sido movido
      // ou apagado depois. O horário conferido é o da chamada de criação.
      const evento = eventosDaIsadora(res).find((e) => e.id === criacao.id);
      if (!evento && turno === res.caso.turnos.length)
        achados.push(falha(id, "O evento não está ativo no calendário"));
      if (criacao.start) {
        const horario = horarioEmPalavras(criacao.start);
        const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
        if (
          !texto.includes(normalizar(horario.diaSemana)) ||
          !texto.includes(horario.data) ||
          !texto.includes(normalizar(horario.hora))
        )
          achados.push(
            falha(
              id,
              `A confirmação não traz o horário do evento (${horario.texto})`,
            ),
          );
        if (
          sessao?.agendada_para &&
          Date.parse(criacao.start) !== Date.parse(sessao.agendada_para)
        )
          achados.push(
            falha(id, "A reunião do banco e o evento têm horários diferentes"),
          );
      }
      return achados;
    },
  );
}

/** A confirmação só vem depois do evento: nenhuma palavra de confirmação sem evento criado. */
export function naoConfirmaSemEvento(turno: number): Regra {
  const id = `A-sem-confirmacao-t${turno}`;
  return regra(
    meta(
      id,
      `Não confirma a reunião no turno ${turno}: o evento não foi criado.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      if (
        chamadasDoTurno(res, turno).some(
          (c) => c.operacao === "criar" && eventosDaIsadora(res).length > 0,
        )
      )
        return [];
      const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
      for (const p of PALAVRAS_DE_CONFIRMACAO)
        if (new RegExp(`\\b${p}\\b`).test(texto) && !texto.includes("?"))
          achados.push(falha(id, `"${p}" sem evento criado`));
      return achados;
    },
  );
}

/** Nenhum evento da Isadora existe no calendário (a criação não aconteceu ou foi desfeita). */
export function nenhumEventoDaIsadora(turno: number): Regra {
  const id = `A-sem-evento-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhum evento da Isadora ativo no calendário e nenhuma reunião agendada no banco (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      // Só o fim do caso é conhecido para o calendário; o banco vale por turno.
      const achados = [];
      if (turno === res.caso.turnos.length && eventosDaIsadora(res).length > 0)
        achados.push(falha(id, "Há evento da Isadora ativo no calendário"));
      if (sessaoAgendada(estadoDepoisDoTurno(res, turno)))
        achados.push(falha(id, "Há reunião agendada no banco"));
      return achados;
    },
  );
}

export function reuniaoAgendada(turno: number): Regra {
  const id = `A-reuniao-agendada-t${turno}`;
  return regra(
    meta(
      id,
      `A reunião está agendada no banco, marcada pela Isadora, e o P1 está em sessao_venda_agendada (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const estado = estadoDepoisDoTurno(res, turno);
      const sessao = sessaoAgendada(estado);
      const achados = [];
      if (!sessao || sessao.agendada_por !== "isadora")
        achados.push(falha(id, "Sem reunião agendada pela Isadora"));
      if (estado.oportunidade?.estagio_p1 !== "sessao_venda_agendada")
        achados.push(falha(id, `P1 em ${estado.oportunidade?.estagio_p1}`));
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Opções que vencem, horário ocupado
// ---------------------------------------------------------------------------

/** Nenhuma chamada ao calendário no turno (a opção vencida nem chega ao Google). */
export function calendarioIntocado(turno: number): Regra {
  const id = `A-calendario-intocado-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhuma chamada ao calendário no turno ${turno}: a opção de ontem não vale, o banco recusa antes.`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const n = chamadasDoTurno(res, turno).length;
      return n === 0 ? [] : [falha(id, `${n} chamada(s) ao calendário`)];
    },
  );
}

/** Nenhum evento é criado no turno (por exemplo, o horário escolhido acabou de ser ocupado). */
export function nenhumaCriacaoNoTurno(turno: number): Regra {
  const id = `A-sem-criacao-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhum evento é criado no turno ${turno}.`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) =>
      chamadasDoTurno(res, turno).some((c) => c.operacao === "criar")
        ? [falha(id, "Criou um evento")]
        : [],
  );
}

/** O horário ocupado nunca é criado: nenhum evento da Isadora começa nele. */
export function nuncaNoHorarioOcupado(): Regra {
  const id = "A-nunca-no-horario-ocupado";
  return regra(
    meta(
      id,
      "Nenhum evento da Isadora começa no horário que a Edilaine ocupou.",
      1,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const ocupadas = res.estado.opcoes.filter(
        (o) => o.descartada_em !== null,
      );
      return eventosDaIsadora(res)
        .filter((e) =>
          ocupadas.some((o) => Date.parse(o.inicio) === Date.parse(e.start)),
        )
        .map((e) => falha(id, `Evento em horário ocupado: ${e.start}`));
    },
  );
}

/** As opções antigas (do dia anterior) já não valem para escolha, e as novas são outras. */
export function opcoesNovasDiferentesDasDeOntem(turno: number): Regra {
  const id = `A-opcoes-novas-t${turno}`;
  return regra(
    meta(
      id,
      `As opções do turno ${turno} são novas, consultadas agora, e nenhuma repete a de ontem sem checar.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const antes = estadoAntesDoTurno(res, turno)?.opcoes ?? [];
      const novas = opcoesNovas(res, turno);
      const achados = [];
      if (novas.length === 0)
        achados.push(falha(id, "Nenhuma opção nova gravada"));
      if (consultasDoTurno(res, turno).length < 1)
        achados.push(
          falha(id, "As opções novas não vieram de uma consulta ao calendário"),
        );
      for (const o of novas)
        if (antes.some((a) => a.id === o.id))
          achados.push(falha(id, "Reusou a opção de ontem"));
      const vivasDeOntem = antes.filter(
        (a) => a.descartada_em === null && a.escolhida_em === null,
      );
      const depois = estadoDepoisDoTurno(res, turno).opcoes;
      for (const a of vivasDeOntem) {
        const agora = depois.find((o) => o.id === a.id);
        if (
          agora &&
          agora.descartada_em === null &&
          Date.parse(agora.valida_ate) > Date.now()
        )
          achados.push(falha(id, "Opção de ontem continua valendo"));
      }
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Consulta à equipe (sem transferir)
// ---------------------------------------------------------------------------

export function consultaAEquipe(
  turno: number,
  tipo: "area" | "duvida" | "horario_edilaine",
  opcoes: { prioridadeAlta?: boolean } = {},
): Regra {
  const id = `A-consulta-equipe-${tipo}-t${turno}`;
  return regra(
    meta(
      id,
      `Abre a consulta ${tipo} à equipe no turno ${turno}, sem transferir a conversa e sem pausar a Isadora.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const antes = new Set(
        (estadoAntesDoTurno(res, turno)?.consultas ?? []).map((c) => c.id),
      );
      const estado = estadoDepoisDoTurno(res, turno);
      const novas = estado.consultas.filter((c) => !antes.has(c.id));
      const achada = novas.find((c) => c.tipo === tipo);
      const achados = [];
      if (!achada)
        return [
          falha(
            id,
            `Consultas novas no turno ${turno}: ${novas.map((c) => c.tipo).join(", ") || "nenhuma"}`,
          ),
        ];
      if (achada.status !== "aberta" && achada.status !== "respondida")
        achados.push(falha(id, `Consulta ${achada.status}`));
      if (opcoes.prioridadeAlta && achada.prioridade !== "alta")
        achados.push(falha(id, "A consulta não subiu com prioridade alta"));
      for (const h of transferenciasNovas(res, turno))
        achados.push(falha(id, `Transferência ${h.motivo} aberta`));
      const c = estado.conversa;
      if (
        c &&
        ((c.agente_pausado_ate &&
          Date.parse(c.agente_pausado_ate) > Date.now()) ||
          c.agente_encerrado_em)
      )
        achados.push(falha(id, "A conversa foi pausada ou passou ao Leonardo"));
      return achados;
    },
  );
}

/** Não abre consulta nenhuma no turno. */
export function semConsultaAEquipe(turno: number): Regra {
  const id = `A-sem-consulta-equipe-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhuma consulta à equipe no turno ${turno}.`,
      turno,
      "modelo",
      "conteudo",
    ),
    (res) => {
      const antes = new Set(
        (estadoAntesDoTurno(res, turno)?.consultas ?? []).map((c) => c.id),
      );
      return estadoDepoisDoTurno(res, turno).consultas.some(
        (c) => !antes.has(c.id),
      )
        ? [falha(id, "Abriu uma consulta")]
        : [];
    },
  );
}

/** A Isadora não está pausada nem passou ao Leonardo (segue atendendo). */
export function isadoraSegueAtendendo(turno: number): Regra {
  const id = `A-isadora-segue-t${turno}`;
  return regra(
    meta(
      id,
      "A Isadora não pausou nem passou a conversa ao Leonardo.",
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const c = estadoDepoisDoTurno(res, turno).conversa;
      if (!c) return [falha(id, "Conversa não encontrada")];
      const pausada =
        c.agente_pausado_ate !== null &&
        Date.parse(c.agente_pausado_ate) > Date.now();
      return pausada || c.agente_encerrado_em !== null
        ? [falha(id, "A conversa saiu da Isadora")]
        : [];
    },
  );
}

// ---------------------------------------------------------------------------
// Anotação para o Leonardo
// ---------------------------------------------------------------------------

export function anotacaoParaOLeonardo(turno: number, trecho: string): Regra {
  const id = `A-anotacao-t${turno}`;
  return regra(
    meta(
      id,
      `Anota para o Leonardo (${trecho}) no resumo, sem transferir e sem pausar (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const antes = (estadoAntesDoTurno(res, turno)?.oportunidade
        ?.qualificacao?.["anotacoes_comerciais"] ?? []) as { texto?: string }[];
      const depois = (estadoDepoisDoTurno(res, turno).oportunidade
        ?.qualificacao?.["anotacoes_comerciais"] ?? []) as { texto?: string }[];
      if (depois.length <= antes.length)
        achados.push(falha(id, "Nenhuma anotação nova no resumo"));
      else if (
        !depois
          .slice(antes.length)
          .some((a) => normalizar(a.texto ?? "").includes(normalizar(trecho)))
      )
        achados.push(falha(id, `A anotação não traz "${trecho}"`));
      for (const h of transferenciasNovas(res, turno))
        achados.push(falha(id, `Transferência ${h.motivo} aberta`));
      const c = estadoDepoisDoTurno(res, turno).conversa;
      if (
        c &&
        ((c.agente_pausado_ate &&
          Date.parse(c.agente_pausado_ate) > Date.now()) ||
          c.agente_encerrado_em)
      )
        achados.push(falha(id, "A conversa foi pausada ou passou ao Leonardo"));
      return achados;
    },
  );
}

/** Diz que o Leonardo trata isso depois da reunião com a Edilaine, sem prometer retorno dele antes. */
export function leonardoDepoisDaReuniao(id: string, turno: number): Regra {
  return regra(
    meta(
      id,
      `Diz que o Leonardo trata depois da reunião com a Edilaine (turno ${turno}), sem prometer contato antes.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
      const achados = [];
      if (
        !/leonardo/.test(texto) ||
        !/depois da reuniao|depois da conversa/.test(texto)
      )
        achados.push(
          falha(id, "Não disse que o Leonardo trata depois da reunião"),
        );
      if (
        /vai te chamar|vai entrar em contato|vai te ligar|te chama hoje/.test(
          texto,
        )
      )
        achados.push(
          falha(id, "Prometeu contato do Leonardo antes da reunião"),
        );
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Remarcar, lembrete, calendário mexido por outra pessoa
// ---------------------------------------------------------------------------

export function remarcadaMovendoOEvento(turno: number): Regra {
  const id = `A-remarcada-t${turno}`;
  return regra(
    meta(
      id,
      `Consulta a agenda, move o mesmo evento (sem criar outro), a sessão antiga fica remarcada e a nova, agendada (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const chamadas = chamadasDoTurno(res, turno);
      if (chamadas.filter((c) => c.operacao === "atualizar").length !== 1)
        achados.push(falha(id, "O evento não foi movido exatamente uma vez"));
      if (chamadas.some((c) => c.operacao === "criar"))
        achados.push(falha(id, "Criou um evento novo em vez de mover"));
      const ordem = chamadas.map((c) => c.operacao);
      if (ordem.lastIndexOf("livre-ocupado") > ordem.indexOf("atualizar"))
        achados.push(falha(id, "A agenda não foi consultada antes de mover"));
      if (ordem.indexOf("livre-ocupado") < 0)
        achados.push(falha(id, "A agenda não foi consultada"));
      const estado = estadoDepoisDoTurno(res, turno);
      if (!estado.sessoes.some((s) => s.status === "remarcada"))
        achados.push(falha(id, "Nenhuma sessão remarcada no banco"));
      const atual = sessaoAgendada(estado);
      if (!atual)
        achados.push(falha(id, "Nenhuma reunião agendada depois de remarcar"));
      if (eventosDaIsadora(res).length !== 1)
        achados.push(
          falha(
            id,
            `${eventosDaIsadora(res).length} eventos ativos, esperado 1`,
          ),
        );
      const evento = eventosDaIsadora(res)[0];
      if (
        evento &&
        atual?.agendada_para &&
        Date.parse(evento.start) !== Date.parse(atual.agendada_para)
      )
        achados.push(falha(id, "O evento e a reunião têm horários diferentes"));
      const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
      if (evento) {
        const h = horarioEmPalavras(evento.start);
        if (!texto.includes(h.data) || !texto.includes(normalizar(h.hora)))
          achados.push(
            falha(id, `A confirmação não traz o novo horário (${h.texto})`),
          );
      }
      return achados;
    },
  );
}

/** O lembrete da véspera sai uma vez, com o horário e o link do evento. */
export function lembreteComLink(turno: number): Regra {
  const id = `A-lembrete-t${turno}`;
  return regra(
    meta(
      id,
      `Envia uma vez o lembrete da véspera, com o horário do evento e o link do Meet (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const textos = textosDaFamilia(res, turno);
      if (textos.length !== 1)
        achados.push(
          falha(id, `${textos.length} mensagens no turno, esperada 1`),
        );
      const evento = eventosDaIsadora(res)[0];
      const sessao = sessaoAgendada(estadoDepoisDoTurno(res, turno));
      const texto = textos.join("\n");
      if (!/https:\/\/meet\.google\.com\/\S+/.test(texto))
        achados.push(falha(id, "Sem o link do Meet"));
      if (sessao?.link_reuniao && !texto.includes(sessao.link_reuniao))
        achados.push(falha(id, "O link não é o da reunião"));
      if (evento) {
        const h = horarioEmPalavras(evento.start);
        if (!normalizar(texto).includes(normalizar(h.hora)))
          achados.push(falha(id, `Sem o horário do evento (${h.hora})`));
      }
      if (!sessao?.lembrete_enviado_em)
        achados.push(falha(id, "lembrete_enviado_em não foi gravado"));
      if (!chamadasDoTurno(res, turno).some((c) => c.operacao === "obter"))
        achados.push(
          falha(
            id,
            "O evento não foi conferido no calendário antes do lembrete",
          ),
        );
      return achados;
    },
  );
}

/** Nenhuma mensagem sai para a família no turno (lembrete que não pode sair, follow-up que não vale). */
export function nadaSaiNoTurno(
  id: string,
  turno: number,
  descricao: string,
): Regra {
  return regra(meta(id, descricao, turno, "sistema", "bloqueante"), (res) => {
    const textos = textosDaFamilia(res, turno);
    return textos.length === 0
      ? []
      : [falha(id, `Saiu para a família: "${limitar(textos.join(" | "))}"`)];
  });
}

/** O evento de outra pessoa continua ativo e nunca foi tocado (nem lido pelo título). */
export function eventoDeOutraPessoaIntacto(): Regra {
  const id = "A-evento-alheio-intacto";
  return regra(
    meta(
      id,
      "O evento de outra pessoa continua no calendário e nenhuma ferramenta o leu, moveu ou apagou.",
      1,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const alheios = res.agenda?.eventosAlheios ?? [];
      if (alheios.length === 0)
        return [falha(id, "O caso não criou o evento de outra pessoa")];
      const achados = [];
      for (const idAlheio of alheios) {
        const evento = res.agenda?.eventos.find((e) => e.id === idAlheio);
        if (!evento || evento.status === "cancelled")
          achados.push(falha(id, "O evento de outra pessoa sumiu"));
        if (
          (res.agenda?.chamadas ?? []).some(
            (c) =>
              (c.operacao === "atualizar" ||
                c.operacao === "excluir" ||
                c.operacao === "obter") &&
              (c.eventoId === idAlheio || c.id === idAlheio),
          )
        )
          achados.push(
            falha(id, "Uma ferramenta leu ou mexeu no evento de outra pessoa"),
          );
      }
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Falta, realizada, cadência
// ---------------------------------------------------------------------------

export function desfechoRegistrado(
  turno: number,
  desfecho: "realizada" | "nao_compareceu",
): Regra {
  const id = `A-desfecho-${desfecho}-t${turno}`;
  return regra(
    meta(
      id,
      desfecho === "realizada"
        ? `Reunião realizada: a conversa vai a humano_comercial, o handoff reuniao_realizada abre para o comercial e o P1 avança (turno ${turno}).`
        : `A família não veio: o P1 volta a qualificado, a conversa segue com a Isadora e nenhuma tarefa humana nasce (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const estado = estadoDepoisDoTurno(res, turno);
      const achados = [];
      const status = desfecho === "realizada" ? "realizada" : "nao_compareceu";
      if (!estado.sessoes.some((s) => s.status === status))
        achados.push(falha(id, `Nenhuma sessão ${status} no banco`));
      if (desfecho === "realizada") {
        if (estado.conversa?.agente_encerrado_motivo !== "reuniao_realizada")
          achados.push(
            falha(
              id,
              `Encerramento ${estado.conversa?.agente_encerrado_motivo}`,
            ),
          );
        if (estado.modo !== "humano_comercial")
          achados.push(
            falha(id, `Modo ${estado.modo}, esperado humano_comercial`),
          );
        const h = estado.transferencias.find(
          (t) => t.motivo === "reuniao_realizada",
        );
        if (!h || h.destino !== "comercial" || h.status !== "aberto")
          achados.push(
            falha(id, "Sem handoff reuniao_realizada aberto para o comercial"),
          );
        if (estado.oportunidade?.estagio_p1 !== "sessao_venda_realizada")
          achados.push(falha(id, `P1 em ${estado.oportunidade?.estagio_p1}`));
      } else {
        if (estado.oportunidade?.estagio_p1 !== "qualificado")
          achados.push(
            falha(
              id,
              `P1 em ${estado.oportunidade?.estagio_p1}, esperado qualificado`,
            ),
          );
        if (estado.conversa?.agente_encerrado_em)
          achados.push(falha(id, "A conversa saiu da Isadora depois da falta"));
      }
      return achados;
    },
  );
}

/** A remarcação depois da falta: uma mensagem, sem constranger, sem transferir. */
export function remarcacaoSemConstranger(turno: number): Regra {
  const id = `A-remarcacao-falta-t${turno}`;
  return regra(
    meta(
      id,
      `Uma mensagem de remarcação depois da falta, sem cobrar, sem transferir e sem tarefa humana (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const textos = textosDaFamilia(res, turno);
      if (textos.length !== 1)
        achados.push(falha(id, `${textos.length} mensagens, esperada 1`));
      const texto = normalizar(textos.join("\n"));
      if (!/(horario|remarc|outro dia|novo)/.test(texto))
        achados.push(falha(id, "Não oferece ver outro horário"));
      if (
        /(voce nao veio|voce faltou|nao compareceu|nao apareceu|falhou)/.test(
          texto,
        )
      )
        achados.push(falha(id, "Constrange a família"));
      for (const h of transferenciasNovas(res, turno))
        achados.push(falha(id, `Transferência ${h.motivo} aberta`));
      const estado = estadoDepoisDoTurno(res, turno);
      if (
        estado.execucoes.some(
          (e) =>
            e.automacao_id === "reuniao_falta_remarcar" &&
            e.status !== "executada",
        )
      )
        achados.push(falha(id, "A execução da remarcação não fechou"));
      return achados;
    },
  );
}

/** Quantas mensagens da cadência (1, 3 e 14 dias) já saíram, e que cada uma tem motivo novo. */
export function cadenciaEnviada(turno: number, etapa: 1 | 2 | 3): Regra {
  const id = `A-cadencia-${etapa}-t${turno}`;
  return regra(
    meta(
      id,
      `O retorno ${etapa} da cadência (1, 3 e 14 dias) sai no turno ${turno}, uma mensagem, sem "só passando" nem cobrança.`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const textos = textosDaFamilia(res, turno);
      if (textos.length !== 1)
        achados.push(
          falha(id, `${textos.length} mensagens no turno, esperada 1`),
        );
      const texto = normalizar(textos.join("\n"));
      if (
        /so passando|nao quero incomodar|desculpa insistir|e ai, decidiu|conseguiu fechar|voce nao respondeu/.test(
          texto,
        )
      )
        achados.push(
          falha(id, `Fórmula proibida: "${limitar(textos.join(" | "))}"`),
        );
      const executadas = estadoDepoisDoTurno(res, turno).execucoes.filter(
        (e) =>
          e.status === "executada" &&
          (e.automacao_id === "followup_d1" ||
            e.automacao_id === "followup_d3_d14"),
      );
      if (executadas.length !== etapa)
        achados.push(
          falha(
            id,
            `${executadas.length} retornos executados, esperado ${etapa}`,
          ),
        );
      return achados;
    },
  );
}

/** As mensagens da cadência têm textos diferentes (motivo novo a cada retorno). */
export function retornosComMotivosDiferentes(turnos: number[]): Regra {
  const id = "A-cadencia-motivos-diferentes";
  return regra(
    meta(
      id,
      "Cada retorno da cadência traz um motivo novo: os textos não se repetem.",
      turnos[0] ?? 1,
      "modelo",
      "conteudo",
    ),
    (res) => {
      const textos = turnos.map((t) =>
        normalizar(textosDaFamilia(res, t).join(" ")),
      );
      return new Set(textos).size === textos.length
        ? []
        : [falha(id, "Dois retornos com o mesmo texto")];
    },
  );
}

/** Nenhum retorno da cadência sai enquanto há reunião agendada. */
export function semCadenciaComReuniaoAgendada(turno: number): Regra {
  const id = `A-sem-cadencia-t${turno}`;
  return regra(
    meta(
      id,
      `Nenhum follow-up sai com a reunião agendada (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      if (textosDaFamilia(res, turno).length > 0)
        achados.push(falha(id, "Saiu mensagem para a família"));
      const executou = estadoDepoisDoTurno(res, turno).execucoes.some(
        (e) =>
          e.status === "executada" && e.automacao_id.startsWith("followup"),
      );
      if (executou) achados.push(falha(id, "Um follow-up foi executado"));
      return achados;
    },
  );
}

/** O calendário foi consultado e a resposta não inventa horário (Google fora do ar: vai conferir com a equipe). */
export function vaiConferirComAEquipe(turno: number): Regra {
  const id = `A-vai-conferir-t${turno}`;
  return regra(
    meta(
      id,
      `Diz que vai conferir com a equipe, sem sugerir nem confirmar horário (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const texto = normalizar(textosDaFamilia(res, turno).join("\n"));
      const achados = [];
      if (!/(confer|equipe|edilaine)/.test(texto))
        achados.push(falha(id, "Não disse que vai conferir com a equipe"));
      return achados;
    },
  );
}

// ---------------------------------------------------------------------------
// Devolutiva, opção vencida, reunião que segue de pé
// ---------------------------------------------------------------------------

/** A resposta da equipe a uma consulta (área ou dúvida) volta à família no turno, e o banco registra a devolução. */
export function consultaDevolvida(turno: number): Regra {
  const id = `A-devolutiva-t${turno}`;
  return regra(
    meta(
      id,
      `A resposta da equipe volta à família por iniciativa da Isadora e a consulta fica devolvida (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const antes = new Set(
        (estadoAntesDoTurno(res, turno)?.consultas ?? [])
          .filter((c) => c.devolvida_em !== null)
          .map((c) => c.id),
      );
      const devolvidas = estadoDepoisDoTurno(res, turno).consultas.filter(
        (c) => c.devolvida_em !== null && !antes.has(c.id),
      );
      const achados = [];
      if (devolvidas.length === 0)
        achados.push(falha(id, "Nenhuma consulta foi devolvida à família"));
      if (textosDaFamilia(res, turno).length === 0)
        achados.push(falha(id, "Nada saiu para a família"));
      return achados;
    },
  );
}

/** A opção vencida não é escolhida nem conferida: o banco a recusa antes de tocar no calendário. */
export function opcaoVencidaRecusada(turno: number): Regra {
  const id = `A-opcao-vencida-recusada-t${turno}`;
  return regra(
    meta(
      id,
      `A opção de ontem não é escolhida nem conferida (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const usadas = estadoDepoisDoTurno(res, turno).opcoes.filter(
        (o) => o.escolhida_em !== null || o.conferida_em !== null,
      );
      return usadas.length === 0
        ? []
        : [falha(id, "Uma opção vencida foi conferida ou escolhida")];
    },
  );
}

/** A reunião do banco tem o mesmo horário do evento que está no calendário agora (a Edilaine o moveu à mão). */
export function sessaoAtualizadaComOEvento(turno: number): Regra {
  const id = `A-sessao-atualizada-t${turno}`;
  return regra(
    meta(
      id,
      `A reunião guardada no banco passa a ter o horário atual do evento (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const sessao = sessaoAgendada(estadoDepoisDoTurno(res, turno));
      const evento = eventosDaIsadora(res)[0];
      if (!sessao?.agendada_para || !evento)
        return [falha(id, "Sem reunião agendada ou sem evento ativo")];
      return Date.parse(sessao.agendada_para) === Date.parse(evento.start)
        ? []
        : [falha(id, "A reunião e o evento têm horários diferentes")];
    },
  );
}

/** A reunião continua marcada no banco e o evento continua ativo no calendário. */
export function reuniaoContinuaMarcada(turno: number): Regra {
  const id = `A-reuniao-continua-t${turno}`;
  return regra(
    meta(
      id,
      `A reunião e o evento seguem de pé (turno ${turno}).`,
      turno,
      "sistema",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      if (!sessaoAgendada(estadoDepoisDoTurno(res, turno)))
        achados.push(falha(id, "A reunião não está mais agendada"));
      if (
        turno === res.caso.turnos.length &&
        eventosDaIsadora(res).length !== 1
      )
        achados.push(falha(id, "O evento saiu do calendário"));
      return achados;
    },
  );
}

/** A reunião foi cancelada: sessão cancelada no banco e nenhum evento ativo. */
export function reuniaoCancelada(turno: number): Regra {
  const id = `A-reuniao-cancelada-t${turno}`;
  return regra(
    meta(
      id,
      `A reunião foi cancelada: sessão cancelada no banco e evento apagado (turno ${turno}).`,
      turno,
      "modelo",
      "bloqueante",
    ),
    (res) => {
      const achados = [];
      const estado = estadoDepoisDoTurno(res, turno);
      if (!estado.sessoes.some((s) => s.status === "cancelada"))
        achados.push(falha(id, "Nenhuma sessão cancelada no banco"));
      if (sessaoAgendada(estado))
        achados.push(falha(id, "Ainda há reunião agendada"));
      if (turno === res.caso.turnos.length && eventosDaIsadora(res).length > 0)
        achados.push(falha(id, "O evento continua ativo no calendário"));
      return achados;
    },
  );
}

// `PALAVRAS_DE_CONFIRMACAO` é lida também pelos testes do catálogo.
export { PALAVRAS_DE_CONFIRMACAO };
