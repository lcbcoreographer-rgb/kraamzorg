import Link from "next/link";
import { ChevronRight, OctagonPause } from "lucide-react";
import { Selo } from "@/components/ui/selo";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";
import { cn } from "@/lib/utils";
import {
  horaBrasilia,
  quandoSessao,
  ROTULO_STATUS,
  VARIANTE_STATUS,
} from "../agenda";
import { textoIdadeGestacional } from "../../pipeline/idade-gestacional";

/**
 * Linha da agenda (DESIGN.md 11.9): a família pelo nome, o tempo dela (IG
 * ou "nasceu em"), a hora em mono, quem conduz e o estado. O cartão
 * inteiro abre a conversa. Família em estado sensível perde a hora de
 * venda e ganha o octógono, sem vermelho.
 */
export function CartaoSessao({
  sessao,
  hoje,
  mostrarDia = false,
  fundo = "branco",
}: {
  sessao: SessaoVenda;
  hoje: string;
  mostrarDia?: boolean;
  /**
   * "branco" (padrão, com sombra leve): o que ainda vai acontecer ou pede
   * registro. "tom": areia-clara sem sombra, para o que já passou
   * (DESIGN.md, 2.5: o que já foi guardado).
   */
  fundo?: "branco" | "tom";
}) {
  const sensivel =
    sessao.estadoSensivel === "bloqueio_total" ||
    sessao.estadoSensivel === "encerrado_sensivel";
  const tempo = textoIdadeGestacional(sessao.dpp, hoje, sessao.dataNascimento);
  const quando = sessao.agendadaPara
    ? mostrarDia
      ? quandoSessao(sessao.agendadaPara)
      : horaBrasilia(sessao.agendadaPara)
    : null;

  return (
    <Link
      href={`/sessoes-venda/${sessao.id}`}
      className={cn(
        "rounded-3 ease-estado grid items-center gap-x-4 gap-y-1 p-3 pr-4 no-underline transition-[box-shadow,transform] duration-140 active:scale-[0.99]",
        "min-h-toque text-inherit",
        fundo === "tom" && !sensivel
          ? "bg-areia-clara hover:shadow-1"
          : "bg-superficie shadow-1 hover:shadow-2",
        // No celular o selo desce para baixo do texto, e o nome fica com a
        // largura toda; a partir de 600 px o selo volta para a direita.
        mostrarDia
          ? "tablet:grid-cols-[minmax(0,1fr)_auto_auto] grid-cols-[minmax(0,1fr)_auto] pl-4"
          : "tablet:grid-cols-[auto_minmax(0,1fr)_auto_auto] grid-cols-[auto_minmax(0,1fr)_auto]",
      )}
    >
      {mostrarDia ? null : (
        // A hora num bloquinho de agenda (lavanda, o tempo), como uma folha
        // de calendário presa à linha. Família em estado sensível: sem tom.
        <span
          className={cn(
            "rounded-2 text-dado-lg text-texto tablet:row-span-1 row-span-2 flex min-h-14 min-w-16 items-center justify-center self-stretch px-2 font-mono font-medium tabular-nums",
            sensivel ? "border-linha border" : "bg-lavanda-clara",
          )}
        >
          {quando}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-3 text-texto leading-snug font-semibold">
          {sessao.nomeFamilia}
        </span>
        {mostrarDia && quando ? (
          <span className="text-apoio text-texto font-medium">{quando}</span>
        ) : null}
        <span className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {tempo && !sensivel ? (
            <span className="font-mono tabular-nums">{tempo}</span>
          ) : null}
          {sessao.conduzidaPorNome ? (
            <span>com {sessao.conduzidaPorNome}</span>
          ) : null}
          {sessao.agendadaPor === "isadora" ? (
            <span>marcada pela Isadora</span>
          ) : null}
          {sessao.conversaCom === "leonardo" && !sensivel ? (
            <span>conversa com o Leonardo</span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "tablet:row-start-1 tablet:mt-0 row-start-2 mt-1 flex",
          mostrarDia
            ? "tablet:col-start-2 col-start-1"
            : "tablet:col-start-3 col-start-2",
        )}
      >
        {sensivel ? (
          <Selo variante="sensivel" icone={<OctagonPause strokeWidth={1.75} />}>
            Freio
          </Selo>
        ) : (
          <Selo variante={VARIANTE_STATUS[sessao.status]}>
            {ROTULO_STATUS[sessao.status]}
          </Selo>
        )}
      </span>
      <ChevronRight
        className={cn(
          "text-texto-3 tablet:row-span-1 row-span-2 size-5 shrink-0",
          mostrarDia
            ? "tablet:col-start-3 col-start-2 row-start-1"
            : "tablet:col-start-4 col-start-3 row-start-1",
        )}
        aria-hidden="true"
        strokeWidth={1.75}
      />
    </Link>
  );
}
