import * as React from "react";
import { UserRound, UserX, Users } from "lucide-react";
import { XicaraQuente } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TileIcone } from "@/components/ui/tile-icone";
import type { TarefaEquipe } from "@/lib/dados/tipos-relacao";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import {
  fraseEquipe,
  fraseQuadroEquipes,
  type EquipeNoQuadro,
  type PessoaNoQuadro,
} from "../quadro-equipes";

/** "30/09, 17:00": dia, mês e hora, sem o ano (a lista é do agora). */
function diaHora(instante: string): string | null {
  const completo = formatarDataHora(instante);
  if (!completo) return null;
  const [data, hora] = completo.split(", ");
  return `${data!.slice(0, 5)}, ${hora}`;
}

function SeloPrazo({ tarefa }: { tarefa: TarefaEquipe }) {
  const quando = tarefa.venceEm ? diaHora(tarefa.venceEm) : null;
  if (!quando) return <Selo variante="contorno">Sem prazo</Selo>;
  return tarefa.vencida ? (
    <Selo variante="alerta">Venceu em {quando}</Selo>
  ) : (
    <Selo variante="neutro">Até {quando}</Selo>
  );
}

function CartaoTarefaEquipe({ tarefa }: { tarefa: TarefaEquipe }) {
  // O título quase sempre já traz a família; repetir só quando não traz.
  const familiaFora =
    tarefa.familia && !tarefa.titulo.includes(tarefa.familia)
      ? tarefa.familia
      : null;
  return (
    <li className="rounded-2 bg-superficie shadow-1 flex flex-col gap-2 p-3.5">
      <p className="text-apoio text-texto leading-snug font-semibold">
        {tarefa.titulo}
      </p>
      {familiaFora ? (
        <p className="text-mini text-texto-2">{familiaFora}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <SeloPrazo tarefa={tarefa} />
        {tarefa.prioridade !== "normal" ? (
          <Selo variante={tarefa.prioridade === "maxima" ? "alerta" : "aviso"}>
            {tarefa.prioridade === "maxima"
              ? "Prioridade máxima"
              : "Prioridade alta"}
          </Selo>
        ) : null}
        {tarefa.status === "em_andamento" ? (
          <Selo variante="neutro">Em andamento</Selo>
        ) : null}
      </div>
    </li>
  );
}

function BlocoPessoa({
  pessoa,
  idEquipe,
}: {
  pessoa: PessoaNoQuadro;
  idEquipe: string;
}) {
  const id = `${idEquipe}-${pessoa.nome ?? "sem-responsavel"}`.replace(
    /\s+/g,
    "-",
  );
  const sem = pessoa.nome === null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3
        id={id}
        className={cn(
          "text-apoio flex flex-wrap items-center gap-2 font-semibold",
          sem ? "text-aviso-texto" : "text-texto",
        )}
      >
        {sem ? (
          <UserX aria-hidden="true" className="size-4" strokeWidth={1.75} />
        ) : (
          <UserRound
            aria-hidden="true"
            className="text-texto-2 size-4"
            strokeWidth={1.75}
          />
        )}
        {pessoa.nome ?? "Sem responsável"}
        <span className="rounded-pilula bg-superficie text-mini text-texto inline-flex min-h-6 min-w-6 items-center justify-center px-2 font-mono font-medium tabular-nums">
          <span className="sr-only">, </span>
          {pessoa.tarefas.length}
        </span>
        {pessoa.vencidas > 0 ? (
          <span className="text-mini text-alerta font-semibold">
            {pessoa.vencidas === 1
              ? "1 vencida"
              : `${pessoa.vencidas} vencidas`}
          </span>
        ) : null}
      </h3>
      <ul className="flex flex-col gap-2">
        {pessoa.tarefas.map((tarefa) => (
          <CartaoTarefaEquipe key={tarefa.id} tarefa={tarefa} />
        ))}
      </ul>
    </section>
  );
}

function ColunaEquipe({ equipe }: { equipe: EquipeNoQuadro }) {
  const idTitulo = `equipe-${equipe.equipe}`;
  return (
    <section
      aria-labelledby={idTitulo}
      className="rounded-3 bg-areia-clara flex flex-col gap-5 p-4 lg:p-5"
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="argila" forma="quadrado">
          <Users />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2
            id={idTitulo}
            className="font-titulo text-2 text-texto font-medium"
          >
            {equipe.rotulo}
          </h2>
          <p className="text-apoio text-texto-2">{fraseEquipe(equipe)}</p>
        </div>
        <p className="flex shrink-0 flex-col items-end">
          <span className="font-titulo text-numero-sm text-texto tabular-nums">
            {equipe.abertas}
          </span>
          <span className="text-mini text-texto-2">
            {equipe.abertas === 1 ? "aberta" : "abertas"}
          </span>
        </p>
      </div>
      {equipe.pessoas.length === 0 ? (
        <p className="text-apoio text-texto-2">Nada em aberto nesta equipe.</p>
      ) : (
        equipe.pessoas.map((pessoa) => (
          <BlocoPessoa
            key={pessoa.nome ?? "sem"}
            pessoa={pessoa}
            idEquipe={idTitulo}
          />
        ))
      )}
    </section>
  );
}

/**
 * Quadro das tarefas por equipe (P51 item 1, refeito em 30/09): a frase do
 * total no topo e uma coluna por equipe, com o número de abertas, o que
 * venceu e, dentro, um bloco por pessoa. Cada tarefa mostra o prazo e a
 * prioridade em selo; a tarefa em si se resolve na tela Tarefas.
 */
export function QuadroEquipes({ quadro }: { quadro: EquipeNoQuadro[] }) {
  const comTarefa = quadro.filter((e) => e.abertas > 0 || e.pessoas.length);
  return (
    <section
      aria-label="Tarefas abertas por equipe"
      className="flex flex-col gap-6"
    >
      <p className="text-3 text-texto max-w-[60ch]">
        {fraseQuadroEquipes(quadro)}
      </p>
      {comTarefa.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={<XicaraQuente tamanho={104} />}
          titulo="Nenhuma tarefa aberta"
          texto="Quando a régua, uma cadência ou alguém da equipe abrir uma tarefa, a equipe dela aparece aqui, com quem cuida e o prazo."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {comTarefa.map((equipe) => (
            <ColunaEquipe key={equipe.equipe} equipe={equipe} />
          ))}
        </div>
      )}
    </section>
  );
}
