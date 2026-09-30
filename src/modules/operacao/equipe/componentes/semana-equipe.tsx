import { TriangleAlert } from "lucide-react";
import { diaDaSemanaDesdeSegunda } from "@/lib/agenda/datas";
import type {
  CelulaEscala,
  DiaEscala,
  EstadoCelulaEscala,
} from "@/lib/dados/tipos-equipe";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { ROTULO_CELULA } from "../textos";

/**
 * Semana da equipe (DESIGN.md, seção 6, `semana`): sete dias, dois turnos
 * por dia, legenda sempre visível. Cada célula diz o estado por forma e por
 * palavra (leitor de tela): visita é marinho cheio, reservada é hachura,
 * backup é tracejado, oferta é dourado lavado, folga é areia e livre fica
 * vazio. Conflito (duas visitas no turno, ou visita em dia de folga) ganha
 * contorno e ícone de aviso; o dia em sobrecarga leva o aviso no cabeçalho.
 */

const DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

export function rotuloDiaCurto(dia: string): string {
  return `${DIAS_CURTOS[diaDaSemanaDesdeSegunda(dia)]} ${dia.slice(8, 10)}`;
}

const CLASSE_CELULA: Record<EstadoCelulaEscala, string> = {
  visita: "bg-marinho text-texto-inverso border-marinho",
  reservada:
    "bg-hachura-aviso border-[1.5px] border-aviso-borda text-aviso-texto",
  backup: "border-[1.5px] border-dashed border-marinho-50 text-texto-2",
  oferta: "bg-dourado-lavado border-[1.5px] border-dourado text-texto",
  folga: "bg-areia border border-linha text-texto-2",
  livre: "bg-superficie border border-linha text-texto-3",
};

function Celula({
  celula,
  turno,
  dia,
}: {
  celula: CelulaEscala;
  turno: "manhã" | "tarde";
  dia: string;
}) {
  const descricao = `${rotuloDiaCurto(dia)}, ${turno}: ${ROTULO_CELULA[celula.estado].toLowerCase()}${
    celula.visitas > 0
      ? `, ${celula.visitas} ${celula.visitas === 1 ? "visita" : "visitas"}`
      : ""
  }${celula.conflito ? ", com conflito de agenda" : ""}`;
  return (
    <div
      role="img"
      aria-label={descricao}
      data-estado={celula.estado}
      data-conflito={celula.conflito ? "sim" : undefined}
      className={cn(
        "rounded-2 text-mini flex min-h-10 items-center justify-center gap-0.5 font-mono font-semibold",
        CLASSE_CELULA[celula.estado],
        celula.conflito && "outline-alerta outline outline-2 outline-offset-1",
      )}
    >
      {celula.conflito ? (
        <TriangleAlert className="size-[13px] shrink-0" aria-hidden="true" />
      ) : null}
      {celula.visitas > 0 ? celula.visitas : null}
    </div>
  );
}

export function SemanaEquipe({
  dias,
  hoje,
  nome,
}: {
  dias: DiaEscala[];
  hoje: string;
  nome: string;
}) {
  return (
    <figure aria-label={`Semana de ${nome}`} className="min-w-0">
      <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] items-center gap-x-1 gap-y-1">
        <span aria-hidden="true" />
        {dias.map((d) => (
          <span
            key={d.dia}
            className={cn(
              "text-mini text-texto-2 flex flex-col items-center font-mono leading-tight",
              d.dia === hoje &&
                "text-texto border-dourado border-b-2 font-semibold",
              d.sobrecarga && "text-alerta",
            )}
          >
            <span>{rotuloDiaCurto(d.dia).split(" ")[0]}</span>
            <span>{d.dia.slice(8, 10)}</span>
            {d.sobrecarga ? (
              <span className="sr-only">
                Mais visitas do que o limite do dia
              </span>
            ) : null}
          </span>
        ))}
        <span className="text-mini text-texto-2 pr-1">manhã</span>
        {dias.map((d) => (
          <Celula
            key={`m-${d.dia}`}
            celula={d.manha}
            turno="manhã"
            dia={d.dia}
          />
        ))}
        <span className="text-mini text-texto-2 pr-1">tarde</span>
        {dias.map((d) => (
          <Celula
            key={`t-${d.dia}`}
            celula={d.tarde}
            turno="tarde"
            dia={d.dia}
          />
        ))}
      </div>
    </figure>
  );
}

const ESTADOS_LEGENDA: EstadoCelulaEscala[] = [
  "visita",
  "reservada",
  "backup",
  "oferta",
  "folga",
  "livre",
];

/** Legenda sempre visível da semana (uma vez por tela). */
export function LegendaSemana() {
  return (
    <ul
      aria-label="Legenda da semana"
      className="text-apoio text-texto-2 flex flex-wrap gap-x-4 gap-y-2"
    >
      {ESTADOS_LEGENDA.map((estado) => (
        <li key={estado} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "rounded-1 inline-block size-4",
              CLASSE_CELULA[estado],
            )}
          />
          {ROTULO_CELULA[estado]}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="rounded-1 outline-alerta bg-superficie inline-block size-4 outline outline-2"
        />
        Conflito
      </li>
    </ul>
  );
}

export function rotuloSemana(inicio: string, fim: string): string {
  return `${formatarData(inicio) ?? inicio} a ${formatarData(fim) ?? fim}`;
}
