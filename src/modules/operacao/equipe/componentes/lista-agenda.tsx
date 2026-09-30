import Link from "next/link";
import { MapPin, MessagesSquare, TriangleAlert, UserRound } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import {
  dataEmBrasilia,
  diaDaSemanaDesdeSegunda,
  horaEmBrasilia,
} from "@/lib/agenda/datas";
import type { VisitaAgenda } from "@/lib/dados/tipos-equipe";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";
import { formatarDiaSemanaEData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { fraseConflito, ROTULO_ESTADO_VISITA, ROTULO_TURNO } from "../textos";

interface Compromisso {
  ordem: string;
  chave: string;
  visita?: VisitaAgenda;
  sessao?: SessaoVenda;
}

function agruparPorDia(
  visitas: VisitaAgenda[],
  sessoes: SessaoVenda[],
): { dia: string; itens: Compromisso[] }[] {
  const porDia = new Map<string, Compromisso[]>();
  const empurra = (dia: string, item: Compromisso) => {
    const lista = porDia.get(dia) ?? [];
    lista.push(item);
    porDia.set(dia, lista);
  };
  for (const v of visitas) {
    empurra(v.data, {
      ordem: `${v.horaPrevista ?? "99:99"}-${v.profissionalNome}`,
      chave: v.visitaId,
      visita: v,
    });
  }
  for (const s of sessoes) {
    if (!s.agendadaPara) continue;
    const dia = dataEmBrasilia(s.agendadaPara);
    if (!dia) continue;
    empurra(dia, {
      ordem: `${horaEmBrasilia(s.agendadaPara) ?? "99:99"}-conversa`,
      chave: `sessao-${s.id}`,
      sessao: s,
    });
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, itens]) => ({
      dia,
      itens: itens.sort((a, b) => a.ordem.localeCompare(b.ordem)),
    }));
}

const DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

/**
 * A semana em sete blocos (direção "Colo"; referência: o calendário de
 * estudo em blocos): o dia da semana, a data e quantas visitas tem, em
 * número grande. Hoje fica no bloco dourado (o agora); os outros dias em
 * lavanda (o tempo). Dia com visita é link para a lista daquele dia.
 */
export function SemanaEmBlocos({
  dias,
  visitas,
  hoje,
}: {
  dias: string[];
  visitas: VisitaAgenda[];
  hoje: string;
}) {
  return (
    <ol
      aria-label="Visitas por dia da semana"
      className="grid grid-cols-7 gap-1.5 lg:gap-2"
    >
      {dias.map((dia) => {
        const doDia = visitas.filter((v) => v.data === dia);
        const conflito = doDia.some((v) => v.conflitos.length > 0);
        const ehHoje = dia === hoje;
        const frase = `${formatarDiaSemanaEData(`${dia}T12:00:00-03:00`) ?? dia}: ${
          doDia.length === 1 ? "1 visita" : `${doDia.length} visitas`
        }${conflito ? ", com conflito" : ""}${ehHoje ? ", hoje" : ""}`;
        const visual = (
          <span aria-hidden="true" className="contents">
            <span className="text-mini text-texto-2">
              {DIAS_CURTOS[diaDaSemanaDesdeSegunda(dia)]}
            </span>
            <span className="text-dado text-texto font-mono">
              {dia.slice(8, 10)}
            </span>
            <span
              className={cn(
                "font-titulo text-numero-sm mt-1 font-medium tabular-nums",
                doDia.length > 0 ? "text-texto" : "text-texto-2",
              )}
            >
              {doDia.length}
            </span>
            {conflito ? (
              <TriangleAlert className="text-aviso-texto mt-0.5 size-4" />
            ) : null}
          </span>
        );
        const classes = cn(
          "rounded-2 flex min-h-[92px] flex-col items-center px-1 py-2 text-center no-underline",
          ehHoje ? "bg-dourado-claro ring-dourado ring-2" : "bg-lavanda-clara",
        );
        return (
          <li key={dia} aria-current={ehHoje ? "date" : undefined}>
            {doDia.length > 0 ? (
              <Link
                href={`#dia-${dia}`}
                aria-label={frase}
                className={cn(
                  classes,
                  "ease-estado transition-transform duration-140 active:scale-[0.97]",
                )}
              >
                {visual}
              </Link>
            ) : (
              <div className={classes}>
                <span className="sr-only">{frase}</span>
                {visual}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Agenda por dia (P37 item 2; direção "Colo"): cada dia é um bloco de
 * tempo (lavanda; hoje em dourado, o único acento da tela) com as visitas
 * de todas as enfermeiras (ou de uma) e as conversas de orientação
 * marcadas. A hora fica numa coluna à esquerda, como numa agenda de papel;
 * os conflitos de cada visita aparecem antes de qualquer ação, e só a
 * visita que ainda não começou leva o "Reagendar".
 */
export function ListaAgenda({
  visitas,
  sessoes,
  hoje,
  limiteVisitasDia,
}: {
  visitas: VisitaAgenda[];
  sessoes: SessaoVenda[];
  hoje: string;
  limiteVisitasDia: number;
}) {
  const dias = agruparPorDia(visitas, sessoes);
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-start gap-4",
        dias.length > 1 && "xl:grid-cols-2",
      )}
    >
      {dias.map(({ dia, itens }) => {
        const doDia = itens.filter((i) => i.visita).length;
        const ehHoje = dia === hoje;
        return (
          <section
            key={dia}
            aria-labelledby={`dia-${dia}`}
            className={cn(
              "rounded-3 flex scroll-mt-24 flex-col gap-3 p-3 lg:p-4",
              ehHoje ? "bg-dourado-claro" : "bg-lavanda-clara",
            )}
          >
            <h3
              id={`dia-${dia}`}
              className="font-titulo text-2 text-texto flex flex-wrap items-center gap-2 px-2 pt-1 font-medium"
            >
              {formatarDiaSemanaEData(`${dia}T12:00:00-03:00`) ?? dia}
              {ehHoje ? (
                <span className="rounded-pilula bg-dourado text-mini text-marinho px-2.5 py-0.5 font-sans font-semibold">
                  hoje
                </span>
              ) : null}
              <span className="text-apoio text-texto-2 font-sans font-normal">
                {doDia === 1 ? "1 visita" : `${doDia} visitas`}
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {itens.map((item) =>
                item.visita ? (
                  <ItemVisita
                    key={item.chave}
                    visita={item.visita}
                    limite={limiteVisitasDia}
                  />
                ) : item.sessao ? (
                  <ItemSessao key={item.chave} sessao={item.sessao} />
                ) : null,
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ItemVisita({ visita: v }: { visita: VisitaAgenda; limite: number }) {
  return (
    <li
      data-visita={v.visitaId}
      data-conflito={v.conflitos.length > 0 ? "sim" : undefined}
      className={cn(
        "rounded-2 bg-superficie shadow-1 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 p-4 lg:grid-cols-[5rem_minmax(0,1fr)]",
        v.conflitos.length > 0 && "outline-aviso-borda outline outline-2",
      )}
    >
      <p className="flex flex-col">
        <span className="text-dado-lg text-texto font-mono font-semibold">
          {v.horaPrevista ?? "sem hora"}
        </span>
        {v.turno ? (
          <span className="text-mini text-texto-2">
            {ROTULO_TURNO[v.turno]}
          </span>
        ) : null}
      </p>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="text-corpo text-texto min-w-0">
            <Link
              href={`/familias/${v.familiaId}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {v.nomeExibicao}
            </Link>
          </p>
          <Selo variante="marinho">
            <span className="font-mono">D{v.diaNumero}</span> de{" "}
            {v.diasContratados}
          </Selo>
        </div>
        <p className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {v.bairro ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-4" />
              {v.bairro}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden="true" className="size-4" />
            {v.profissionalNome}
          </span>
          <span>{ROTULO_ESTADO_VISITA[v.estado]}</span>
        </p>
        {v.conflitos.length > 0 ? (
          <ul
            className="rounded-2 bg-aviso-lavado flex flex-col gap-1 px-3 py-2"
            aria-label="Conflitos desta visita"
          >
            {v.conflitos.map((c, i) => (
              <li
                key={`${c.codigo}-${i}`}
                className="text-apoio text-aviso-texto flex items-start gap-2"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {fraseConflito(c)}
              </li>
            ))}
          </ul>
        ) : null}
        {v.movivel ? (
          <Botao
            asChild
            variante="secundario"
            tamanho="compacto"
            className="self-start"
          >
            <Link
              href={`/agenda/visitas/${v.visitaId}`}
              aria-label={`Reagendar o D${v.diaNumero} de ${v.nomeExibicao}`}
            >
              Reagendar
            </Link>
          </Botao>
        ) : null}
      </div>
    </li>
  );
}

function ItemSessao({ sessao: s }: { sessao: SessaoVenda }) {
  return (
    <li className="rounded-2 bg-argila-clara grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 p-4 lg:grid-cols-[5rem_minmax(0,1fr)]">
      <p className="flex flex-col">
        <span className="text-dado-lg text-texto font-mono font-semibold">
          {s.agendadaPara ? horaEmBrasilia(s.agendadaPara) : ""}
        </span>
      </p>
      <div className="flex min-w-0 items-start gap-3">
        <TileIcone tom="argila" tamanho="p">
          <MessagesSquare />
        </TileIcone>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-apoio text-texto-2">Conversa de orientação</p>
          <p className="text-corpo text-texto font-semibold">{s.nomeFamilia}</p>
          <p className="text-apoio text-texto-2">
            {s.conduzidaPorNome
              ? `Conduz ${s.conduzidaPorNome}`
              : "Sem quem conduza definido"}
          </p>
          <Link
            href={`/sessoes-venda/${s.id}`}
            className="text-apoio text-texto min-h-toque inline-flex items-center self-start underline underline-offset-4"
          >
            Abrir a conversa
          </Link>
        </div>
      </div>
    </li>
  );
}
