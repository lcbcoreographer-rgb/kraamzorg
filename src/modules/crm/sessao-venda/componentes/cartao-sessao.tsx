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
}: {
  sessao: SessaoVenda;
  hoje: string;
  mostrarDia?: boolean;
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
        "rounded-3 bg-superficie shadow-1 hover:shadow-2 ease-estado grid items-center gap-x-4 gap-y-1 p-4 no-underline transition-[box-shadow] duration-140",
        "min-h-toque text-inherit",
        mostrarDia
          ? "grid-cols-[minmax(0,1fr)_auto]"
          : "grid-cols-[auto_minmax(0,1fr)_auto]",
      )}
    >
      {mostrarDia ? null : (
        <span className="text-dado text-texto min-w-[3.25rem] font-mono tabular-nums">
          {quando}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-3 text-texto truncate font-semibold">
          {sessao.nomeFamilia}
        </span>
        {mostrarDia && quando ? (
          <span className="text-apoio text-texto">{quando}</span>
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
      <span className="flex items-center gap-2">
        {sensivel ? (
          <Selo variante="sensivel" icone={<OctagonPause strokeWidth={1.75} />}>
            Freio
          </Selo>
        ) : (
          <Selo variante={VARIANTE_STATUS[sessao.status]}>
            {ROTULO_STATUS[sessao.status]}
          </Selo>
        )}
        <ChevronRight
          className="text-texto-3 size-5 shrink-0"
          aria-hidden="true"
          strokeWidth={1.75}
        />
      </span>
    </Link>
  );
}
