/**
 * P28 · O calendário de teste da Edilaine (P25b, PRD 11.14 e Apêndice C).
 *
 * O roteiro faz, no calendário, o que a Edilaine faria no Google: ocupar um
 * horário, mover ou apagar o evento da Isadora, criar um evento de outra
 * pessoa, derrubar o serviço. Os dois executores usam a mesma interface:
 *
 * - o local guarda o calendário em memória (`n8n/src/lib/calendario-simulado.mjs`,
 *   o mesmo que os testes do n8n usam);
 * - o real fala com a rota de controle do app de homologação
 *   (`/api/teste/uazapi/agenda`, protegida pelo segredo das rotas internas),
 *   que guarda o mesmo calendário para o n8n com `homologacao.agendaSimulada`.
 *
 * Nenhum calendário, e-mail ou evento de verdade entra aqui.
 */
import type {
  ChamadaDeAgenda,
  EventoDeAgenda,
  ResultadoDeAgenda,
} from "./tipos";

/** O calendário da reunião inicial (config.agenda.calendarId do build; só serve de chave no teste). */
export const CALENDARIO_DE_TESTE =
  "EXEMPLO-calendario-reuniao-inicial@group.calendar.google.invalid";

/** O e-mail fictício da família nos casos de agenda (domínio reservado para exemplos). */
export const EMAIL_DA_CARLA = "carla@example.com";

export interface CalendarioDeTeste {
  /** Chamadas que o calendário recebeu até agora, na ordem (sem o turno). */
  chamadas(): Promise<Omit<ChamadaDeAgenda, "turno">[]>;
  eventos(): Promise<EventoDeAgenda[]>;
  ocupar(inicioIso: string, fimIso: string): Promise<void>;
  liberarTudo(): Promise<void>;
  /** Cria no calendário um evento que não é da Isadora (id sem a marca dela) e devolve o id. */
  criarEventoAlheio(inicioIso: string, fimIso: string): Promise<string>;
  moverEvento(
    eventoId: string,
    inicioIso: string,
    fimIso: string,
  ): Promise<void>;
  apagarEvento(eventoId: string): Promise<void>;
  foraDoAr(valor: boolean): Promise<void>;
  /** A próxima chamada da operação falha uma vez (`*` vale para qualquer uma). */
  falharProxima(
    operacao: string,
    mensagem: string,
    codigo: number,
  ): Promise<void>;
  reiniciar(): Promise<void>;
}

/** Instante local (São Paulo) daqui a `dias` dias, na hora `HH:MM`, em ISO com deslocamento. */
export function instanteLocal(diasDaquiA: number, hora: string): string {
  const agora = new Date(Date.now() + diasDaquiA * 86_400_000);
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(agora);
  return new Date(`${dia}T${hora}:00-03:00`).toISOString();
}

export function somarMinutos(iso: string, minutos: number): string {
  return new Date(Date.parse(iso) + minutos * 60_000).toISOString();
}

export function resumirEvento(bruto: Record<string, unknown>): EventoDeAgenda {
  const inicio = (bruto["start"] as { dateTime?: string } | undefined)
    ?.dateTime;
  const fim = (bruto["end"] as { dateTime?: string } | undefined)?.dateTime;
  const convidados = Array.isArray(bruto["attendees"])
    ? (bruto["attendees"] as { email?: string }[]).map((a) =>
        String(a.email ?? ""),
      )
    : [];
  return {
    id: String(bruto["id"] ?? ""),
    status: String(bruto["status"] ?? ""),
    summary: String(bruto["summary"] ?? ""),
    start: String(inicio ?? ""),
    end: String(fim ?? ""),
    attendees: convidados,
    temMeet: typeof bruto["hangoutLink"] === "string",
  };
}

export async function fotografar(
  calendario: CalendarioDeTeste,
  alheios: string[],
  turnoDe: (indice: number) => number,
): Promise<ResultadoDeAgenda> {
  const chamadas = await calendario.chamadas();
  return {
    calendarioId: CALENDARIO_DE_TESTE,
    chamadas: chamadas.map((c, i) => ({ ...c, turno: turnoDe(i) })),
    eventos: await calendario.eventos(),
    eventosAlheios: alheios,
  };
}

// ---------------------------------------------------------------------------
// Horário em palavras, como a Isadora o diz ("sexta, 02/10, às 14h")
// ---------------------------------------------------------------------------

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export interface HorarioEmPalavras {
  diaSemana: string;
  data: string;
  hora: string;
  texto: string;
}

/** O mesmo formato de `privado.agenda_texto` no banco e de `textoDoHorario` no fluxo 4 (São Paulo). */
export function horarioEmPalavras(iso: string): HorarioEmPalavras {
  const partes: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hourCycle: "h23",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(iso)))
    partes[p.type] = p.value;
  const indice = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    partes["weekday"] ?? "",
  );
  const hora = Number(partes["hour"]) % 24;
  const minuto = Number(partes["minute"]);
  const diaSemana = DIAS[indice] ?? "";
  const data = `${partes["day"]}/${partes["month"]}`;
  const horaTexto = `${hora}h${minuto === 0 ? "" : String(minuto).padStart(2, "0")}`;
  return {
    diaSemana,
    data,
    hora: horaTexto,
    texto: `${diaSemana}, ${data}, às ${horaTexto}`,
  };
}
