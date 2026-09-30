import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/selo";
import { dataEmBrasilia, horaEmBrasilia } from "@/lib/agenda/datas";
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

/**
 * Agenda por dia (P37 item 2): as visitas de todas as enfermeiras (ou de
 * uma) e as conversas de orientação marcadas, com os conflitos de cada
 * visita marcados antes de qualquer ação. Só a visita que ainda não começou
 * leva o "Reagendar". O dia de hoje leva o único acento dourado da tela.
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
    <div className="flex flex-col gap-8">
      {dias.map(({ dia, itens }) => {
        const doDia = itens.filter((i) => i.visita).length;
        return (
          <section
            key={dia}
            aria-labelledby={`dia-${dia}`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`dia-${dia}`}
              className={cn(
                "text-3 text-texto font-semibold",
                dia === hoje && "border-dourado border-l-2 pl-3",
              )}
            >
              {formatarDiaSemanaEData(`${dia}T12:00:00-03:00`) ?? dia}
              {dia === hoje ? " · hoje" : ""}
              <span className="text-apoio text-texto-2 ml-2 font-normal">
                {doDia === 1 ? "1 visita" : `${doDia} visitas`}
              </span>
            </h3>
            <ul className="flex flex-col gap-3">
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
        "rounded-3 bg-superficie shadow-1 flex flex-col gap-2 p-5",
        v.conflitos.length > 0 && "outline-aviso-borda outline outline-2",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-3 text-texto font-semibold">
          <span className="font-mono">{v.horaPrevista ?? "sem hora"}</span>
          {v.turno ? (
            <span className="text-apoio text-texto-2 ml-2 font-normal">
              {ROTULO_TURNO[v.turno]}
            </span>
          ) : null}
        </p>
        <Selo variante="marinho">
          <span className="font-mono">D{v.diaNumero}</span> de{" "}
          {v.diasContratados}
        </Selo>
      </div>
      <p className="text-corpo text-texto">
        <Link
          href={`/familias/${v.familiaId}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {v.nomeExibicao}
        </Link>
        <span className="text-texto-2">{v.bairro ? ` · ${v.bairro}` : ""}</span>
      </p>
      <p className="text-apoio text-texto-2">
        {v.profissionalNome} · {ROTULO_ESTADO_VISITA[v.estado]}
      </p>
      {v.conflitos.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Conflitos desta visita">
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
    </li>
  );
}

function ItemSessao({ sessao: s }: { sessao: SessaoVenda }) {
  return (
    <li className="rounded-3 bg-superficie-2 flex flex-col gap-1 p-5">
      <p className="text-3 text-texto font-semibold">
        <span className="font-mono">
          {s.agendadaPara ? horaEmBrasilia(s.agendadaPara) : ""}
        </span>
        <span className="text-apoio text-texto-2 ml-2 font-normal">
          conversa de orientação
        </span>
      </p>
      <p className="text-corpo text-texto">{s.nomeFamilia}</p>
      <p className="text-apoio text-texto-2">
        {s.conduzidaPorNome
          ? `Conduz ${s.conduzidaPorNome}`
          : "Sem quem conduza definido"}
      </p>
      <Link
        href={`/sessoes-venda/${s.id}`}
        className="text-apoio text-texto min-h-toque inline-flex items-center underline underline-offset-4"
      >
        Abrir a conversa
      </Link>
    </li>
  );
}
