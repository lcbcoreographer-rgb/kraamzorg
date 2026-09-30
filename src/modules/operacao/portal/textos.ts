import { diaDaSemanaDesdeSegunda } from "@/lib/agenda/datas";
import type {
  EnderecoAtendimento,
  FamiliaPortal,
  VisitaPortal,
} from "@/lib/dados/tipos-equipe";
import type { EstadoSensivel } from "@/lib/dados/tipos";
import { ROTULO_TURNO } from "../equipe/textos";

/**
 * Textos do portal da enfermeira (P38, docs/design/voz.md): fala curta,
 * clínica e no imperativo gentil, sem elogio automático. A frase mais
 * acolhedora do portal é a que diz que nada se perdeu ("Salvo no aparelho").
 */

const DIAS_LONGOS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
] as const;

/** "quinta 24/09" a partir de "2026-09-24". */
export function diaEmFrase(dia: string): string {
  return `${DIAS_LONGOS[diaDaSemanaDesdeSegunda(dia)]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** "Hoje, quinta 24/09" (título de abertura do Hoje, DESIGN.md 11.4). */
export function tituloDeHoje(dia: string): string {
  return `Hoje, ${diaEmFrase(dia)}`;
}

const NUMEROS = ["Nenhuma", "Uma", "Duas", "Três", "Quatro", "Cinco", "Seis"];

/** "Duas visitas, manhã e tarde." / "Uma visita, à tarde." / "Nenhuma visita hoje." */
export function fraseDoDia(
  visitas: readonly Pick<VisitaPortal, "turno">[],
): string {
  if (visitas.length === 0) return "Nenhuma visita marcada para hoje.";
  const quantas = NUMEROS[visitas.length] ?? String(visitas.length);
  const turnos = [
    ...new Set(visitas.map((v) => v.turno).filter(Boolean)),
  ] as (keyof typeof ROTULO_TURNO)[];
  const substantivo = visitas.length === 1 ? "visita" : "visitas";
  if (turnos.length === 0) return `${quantas} ${substantivo}.`;
  if (visitas.length === 1) {
    return `${quantas} ${substantivo}, ${turnos[0] === "manha" ? "de manhã" : "à tarde"}.`;
  }
  return `${quantas} ${substantivo}, ${turnos.map((t) => ROTULO_TURNO[t]).join(" e ")}.`;
}

/** "às 09:00" para uma visita, "a primeira às 09:00" para várias. */
function primeiraHora(horas: readonly (string | null)[]): string | null {
  const ordenadas = horas.filter((h): h is string => Boolean(h)).sort();
  if (ordenadas.length === 0) return null;
  return horas.length === 1
    ? `às ${ordenadas[0]}`
    : `a primeira às ${ordenadas[0]}`;
}

/**
 * Rótulo e contexto do trio de números do Hoje (DESIGN.md, 2.2): nenhum
 * número sozinho, cada um com a frase que diz o que fazer com ele.
 */
export function resumoDoHoje(
  hoje: {
    visitas: readonly Pick<VisitaPortal, "horaPrevista">[];
    fichasPendentes: readonly unknown[];
  },
  amanha: readonly { horaPrevista: string | null }[],
): Record<
  "visitas" | "fichas" | "amanha",
  { rotulo: string; contexto: string }
> {
  const fichas = hoje.fichasPendentes.length;
  return {
    visitas: {
      rotulo: hoje.visitas.length === 1 ? "visita hoje" : "visitas hoje",
      contexto:
        primeiraHora(hoje.visitas.map((v) => v.horaPrevista)) ??
        (hoje.visitas.length > 0 ? "sem hora marcada" : "dia sem visita"),
    },
    fichas: {
      rotulo: fichas === 1 ? "ficha pendente" : "fichas pendentes",
      contexto: fichas === 0 ? "tudo em dia" : "falta o registro",
    },
    amanha: {
      rotulo: amanha.length === 1 ? "visita amanhã" : "visitas amanhã",
      contexto:
        primeiraHora(amanha.map((v) => v.horaPrevista)) ??
        (amanha.length > 0 ? "sem hora marcada" : "nada marcado ainda"),
    },
  };
}

export function enderecoEmTexto(
  endereco: EnderecoAtendimento | null,
  cidade: string | null,
  bairro: string | null,
): string | null {
  const partes = [
    endereco?.logradouro,
    endereco?.numero,
    endereco?.complemento,
    endereco?.bairro ?? bairro,
    cidade,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return partes.length > 0 ? partes.join(", ") : null;
}

/** Ligação de mapa do aparelho (esquema geo:), sem passar por site nenhum. */
export function ligacaoDeMapa(endereco: string): string {
  return `geo:0,0?q=${encodeURIComponent(endereco)}`;
}

/** O estado sensível da família, com a frase do estado (DESIGN.md, 11.8 regra 5). */
export function fraseEstadoSensivel(estado: EstadoSensivel): string | null {
  switch (estado) {
    case "normal":
      return null;
    case "atencao":
      return "Família em atenção. Fale com a coordenação antes de combinar algo novo.";
    case "bloqueio_total":
    case "encerrado_sensivel":
      return "Família em pausa. Nenhuma mensagem automática sai; o contato é humano e pelo nome.";
  }
}

/** "D2 de 6" e a linha do tempo da família. */
export function diaDeTotal(diaNumero: number, total: number): string {
  return `D${diaNumero} de ${total}`;
}

/** As visitas de amanhã, das famílias atribuídas, ordenadas por hora. */
export function visitasDoDiaSeguinte(
  familias: readonly FamiliaPortal[],
  amanha: string,
): {
  familiaId: string;
  nomeExibicao: string;
  diaNumero: number;
  horaPrevista: string | null;
}[] {
  return familias
    .flatMap((f) =>
      f.visitas
        .filter(
          (v) =>
            v.data === amanha &&
            v.estado !== "cancelada" &&
            v.estado !== "reagendada",
        )
        .map((v) => ({
          familiaId: f.familiaId,
          nomeExibicao: f.nomeExibicao,
          diaNumero: v.diaNumero,
          horaPrevista: v.horaPrevista,
        })),
    )
    .sort((a, b) =>
      (a.horaPrevista ?? "99:99").localeCompare(b.horaPrevista ?? "99:99"),
    );
}

const ROTULO_ACOMPANHAMENTO: Record<string, string> = {
  aguardando: "Aguardando o início",
  ativo: "Acompanhamento marcado",
  em_execucao: "Em acompanhamento",
  ultima_visita_realizada: "Última visita feita",
  pendencias: "Com pendências",
  encerrado: "Encerrado",
  suspenso: "Em pausa",
  interrompido_familia: "Interrompido pela família",
  interrompido_clinico: "Interrompido por decisão clínica",
  intercorrencia: "Com intercorrência",
};

export function rotuloAcompanhamento(
  estado: string | null | undefined,
): string {
  return estado
    ? (ROTULO_ACOMPANHAMENTO[estado] ?? "Em acompanhamento")
    : "Sem acompanhamento marcado";
}

type VisitaDaFamilia = FamiliaPortal["visitas"][number];

/**
 * A visita que a enfermeira faz a seguir na família: a primeira de hoje em
 * diante que ainda não foi feita nem cancelada. Nulo quando não há.
 */
export function proximaVisitaDaFamilia(
  familia: Pick<FamiliaPortal, "visitas">,
  hoje: string,
): VisitaDaFamilia | null {
  const abertas = familia.visitas
    .filter(
      (v) =>
        v.data >= hoje &&
        (v.estado === "agendada" ||
          v.estado === "confirmada" ||
          v.estado === "a_caminho" ||
          v.estado === "iniciada"),
    )
    .sort((a, b) =>
      `${a.data}${a.horaPrevista ?? ""}`.localeCompare(
        `${b.data}${b.horaPrevista ?? ""}`,
      ),
    );
  return abertas[0] ?? null;
}

/** "Próxima visita: quinta 01/10 às 09:00, dia 3." */
export function fraseProximaVisita(visita: VisitaDaFamilia | null): string {
  if (!visita) return "Nenhuma visita marcada por enquanto.";
  const hora = visita.horaPrevista ? ` às ${visita.horaPrevista}` : "";
  return `Próxima visita: ${diaEmFrase(visita.data)}${hora}, dia ${visita.diaNumero}.`;
}
