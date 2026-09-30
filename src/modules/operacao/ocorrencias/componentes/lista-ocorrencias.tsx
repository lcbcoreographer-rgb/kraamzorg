import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  CircleCheck,
  ClockAlert,
  LockKeyhole,
  OctagonPause,
  UserRound,
} from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { FolhaLupa, SinoCalmo } from "@/components/ilustracoes";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import type { Tom } from "@/components/ui/tons";
import type {
  ListaOcorrencias,
  OcorrenciaResumo,
  SituacaoOcorrencias,
} from "@/lib/dados/tipos-ocorrencia";
import { cn } from "@/lib/utils";
import {
  grupoDaOcorrencia,
  prazoDaOcorrencia,
  type PrazoTela,
  type SituacaoGrupo,
} from "../prazo";
import {
  ROTULO_PRIORIDADE,
  ROTULO_STATUS,
  ROTULO_TIPO,
  VARIANTE_PRIORIDADE,
  VARIANTE_STATUS,
} from "../rotulos";

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Frase do resumo: número em frase, sem painel de números soltos (voz.md, 5). */
export function fraseResumoOcorrencias(
  resumo: ListaOcorrencias["resumo"],
): string {
  if (resumo.abertas === 0) return "Nenhuma ocorrência aberta agora.";
  const partes = [
    `${plural(resumo.abertas, "ocorrência aberta", "ocorrências abertas")}.`,
  ];
  if (resumo.vencidas > 0) {
    partes.push(
      `${plural(resumo.vencidas, "passou", "passaram")} do prazo de resposta.`,
    );
  }
  if (resumo.privadas > 0) {
    partes.push(
      `${plural(resumo.privadas, "é privada", "são privadas")}, só da coordenação.`,
    );
  }
  return partes.join(" ");
}

const GRUPOS: Record<
  SituacaoGrupo,
  { titulo: string; icone: React.ReactNode; tom?: Tom; apoio: string }
> = {
  // Atraso é estado: o tile fica branco, e o estado mora no prazo de cada
  // ocorrência (o mesmo das tarefas vencidas).
  vencidas: {
    titulo: "Passaram do prazo",
    icone: <ClockAlert />,
    apoio: "Responda estas primeiro. A mais urgente está no topo.",
  },
  no_prazo: {
    titulo: "Dentro do prazo",
    icone: <CalendarClock />,
    tom: "lavanda",
    apoio: "Em ordem de prioridade e, depois, do prazo mais curto.",
  },
  fechadas: {
    titulo: "Fechadas",
    icone: <CircleCheck />,
    tom: "salvia",
    apoio: "Resolvidas ou encerradas, com o histórico guardado.",
  },
};

const ORDEM_GRUPOS: SituacaoGrupo[] = ["vencidas", "no_prazo", "fechadas"];

const COR_PRAZO: Record<PrazoTela["tom"], string> = {
  alerta: "text-alerta",
  aviso: "text-aviso-texto",
  neutro: "text-texto",
  sensivel: "text-sensivel",
};

function Prazo({ prazo }: { prazo: PrazoTela }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-mini text-texto-2 font-semibold">
        Prazo de resposta
      </span>
      <span
        className={cn(
          "text-corpo inline-flex items-center gap-1.5 font-semibold",
          COR_PRAZO[prazo.tom],
        )}
      >
        {prazo.tom === "alerta" ? (
          <ClockAlert
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
        ) : prazo.tom === "sensivel" ? (
          <OctagonPause
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
        ) : null}
        {prazo.frase}
      </span>
      {prazo.data ? (
        <span className="text-apoio text-texto-2">
          {prazo.rotuloData}{" "}
          <span className="font-mono tabular-nums">{prazo.data}</span>
        </span>
      ) : null}
    </div>
  );
}

function CartaoOcorrencia({ o, agora }: { o: OcorrenciaResumo; agora: Date }) {
  const prazo = prazoDaOcorrencia(o, agora);
  const sensivel = o.tipo === "intercorrencia";
  const quem = o.familiaNome ?? o.profissionalNome;
  return (
    <li
      className="rounded-3 bg-superficie shadow-1 ease-estado hover:bg-marinho-08 relative grid gap-x-8 gap-y-4 p-5 transition-[background-color] duration-140 lg:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,14rem)] lg:items-start lg:px-6"
      data-ocorrencia={o.id}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {o.privada ? (
          <Selo
            variante="neutro"
            icone={<LockKeyhole />}
            className="self-start"
          >
            Privada, só coordenação e diretoria
          </Selo>
        ) : null}
        <h3 className="text-3 text-texto font-semibold">
          {/* O cartão inteiro abre a ocorrência; o nome do link é o título. */}
          <Link
            href={`/ocorrencias/${o.id}`}
            className="after:rounded-3 underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {o.titulo}
          </Link>
        </h3>
        <p className="text-apoio flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-texto font-medium">
            {quem ?? "Sem família"}
          </span>
          <span className="text-texto-2">{ROTULO_TIPO[o.tipo]}</span>
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Selo variante={VARIANTE_STATUS[o.status]}>
            {ROTULO_STATUS[o.status]}
          </Selo>
          {/* Intercorrência sem âmbar e sem vermelho (DESIGN.md, 11.8). */}
          <Selo
            variante={sensivel ? "sensivel" : VARIANTE_PRIORIDADE[o.prioridade]}
          >
            {ROTULO_PRIORIDADE[o.prioridade]}
          </Selo>
        </div>
      </div>

      <div className="border-linha grid grid-cols-2 gap-4 border-t pt-4 lg:contents">
        <div className="flex flex-col gap-0.5 lg:pt-0.5">
          <span className="text-mini text-texto-2 font-semibold">
            Quem cuida
          </span>
          {o.responsavelNome ? (
            <span className="text-corpo text-texto inline-flex items-center gap-1.5">
              <UserRound
                aria-hidden="true"
                className="text-texto-2 size-4 shrink-0"
                strokeWidth={1.75}
              />
              {o.responsavelNome}
            </span>
          ) : (
            <span className="text-corpo text-aviso-texto font-semibold">
              Sem responsável
            </span>
          )}
        </div>
        <div className="lg:pt-0.5">
          <Prazo prazo={prazo} />
        </div>
      </div>
    </li>
  );
}

export function ListaOcorrenciasTela({
  lista,
  situacao,
  agora = new Date(),
}: {
  lista: ListaOcorrencias;
  situacao: SituacaoOcorrencias;
  agora?: Date;
}) {
  const grupos = ORDEM_GRUPOS.map((grupo) => ({
    grupo,
    itens: lista.ocorrencias.filter((o) => grupoDaOcorrencia(o) === grupo),
  })).filter((g) => g.itens.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-3 text-texto max-w-[60ch]">
        {fraseResumoOcorrencias(lista.resumo)}
      </p>
      <AbasPilula
        rotulo="Filtrar ocorrências"
        ativa={situacao}
        className="self-start"
        abas={[
          { valor: "abertas", rotulo: "Abertas", href: "/ocorrencias" },
          {
            valor: "fechadas",
            rotulo: "Fechadas",
            href: "/ocorrencias?situacao=fechadas",
          },
          {
            valor: "todas",
            rotulo: "Todas",
            href: "/ocorrencias?situacao=todas",
          },
        ]}
      />
      {grupos.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={
            situacao === "abertas" ? (
              <SinoCalmo tamanho={112} />
            ) : (
              <FolhaLupa tamanho={112} />
            )
          }
          titulo={
            situacao === "abertas"
              ? "Nenhuma ocorrência aberta"
              : "Nenhuma ocorrência aqui"
          }
          texto="Quando a equipe abrir uma ocorrência, ou uma pesquisa voltar com nota baixa, ela aparece aqui com o prazo de resposta."
        />
      ) : (
        <div className="flex flex-col gap-10 pt-2">
          {grupos.map(({ grupo, itens }) => {
            const g = GRUPOS[grupo];
            return (
              <SecaoBloco
                key={grupo}
                idTitulo={`t-ocorrencias-${grupo}`}
                titulo={g.titulo}
                icone={g.icone}
                tom={g.tom ?? "areia"}
                semTom={!g.tom}
                contagem={itens.length}
                apoio={g.apoio}
              >
                <ul className="flex flex-col gap-3">
                  {itens.map((o) => (
                    <CartaoOcorrencia key={o.id} o={o} agora={agora} />
                  ))}
                </ul>
              </SecaoBloco>
            );
          })}
        </div>
      )}
    </div>
  );
}
