import { Bot } from "lucide-react";
import { formatarDataHora } from "@/lib/formatacao";
import type { Mensagem } from "@/lib/dados/tipos";

function horaCurta(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);
}

function Bolha({ mensagem, nomeQuemAssumiu }: { mensagem: Mensagem; nomeQuemAssumiu?: string | null }) {
  if (mensagem.enviadoPor === "sistema") {
    return (
      <span className="text-mini text-texto-2 self-center text-center">
        {mensagem.conteudo}
      </span>
    );
  }

  const daFamilia = mensagem.direcao === "entrada";
  const daIsadora = mensagem.enviadoPor === "ia";

  return (
    <div
      className={
        daFamilia
          ? "bg-superficie shadow-1 max-w-[85%] self-start rounded-3 rounded-bl-1 px-4 py-3"
          : daIsadora
            ? "bg-superficie-2 max-w-[85%] self-end rounded-3 rounded-br-1 px-4 py-3"
            : "bg-marinho text-texto-inverso max-w-[85%] self-end rounded-3 rounded-br-1 px-4 py-3"
      }
    >
      {daIsadora ? (
        <div className="text-apoio text-texto-2 mb-1 flex items-center gap-1.5 font-semibold">
          <Bot aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Isadora (IA)
        </div>
      ) : !daFamilia ? (
        <div className="text-apoio text-texto-inverso-2 mb-1 font-semibold">
          {nomeQuemAssumiu ?? "Equipe"}
        </div>
      ) : null}
      <p className="text-corpo whitespace-pre-wrap">{mensagem.conteudo}</p>
      <div
        className={
          daFamilia || daIsadora
            ? "text-mini text-texto-2 mt-1 font-mono"
            : "text-mini text-texto-inverso-2 mt-1 font-mono"
        }
      >
        {horaCurta(mensagem.enviadaEm)}
      </div>
    </div>
  );
}

/**
 * Linha de mensagens (P27 item 1, protótipo `comercial-conversa.html`, C2;
 * DESIGN.md, componente "Conversa"): família à esquerda, Isadora à direita
 * em areia, pessoa da equipe à direita em marinho.
 */
export function FioMensagens({
  mensagens,
  nomeQuemAssumiu,
}: {
  mensagens: Mensagem[];
  nomeQuemAssumiu?: string | null;
}) {
  if (mensagens.length === 0) {
    return (
      <p className="text-apoio text-texto-2">
        Ainda não há mensagens registradas nesta conversa.
      </p>
    );
  }

  let ultimoDia = "";

  return (
    <div className="flex flex-col gap-3 pb-4" aria-live="polite">
      {mensagens.map((mensagem) => {
        const dia = formatarDataHora(mensagem.enviadaEm)?.slice(0, 10) ?? "";
        const mostrarDia = dia !== ultimoDia;
        ultimoDia = dia;
        return (
          <div key={mensagem.id} className="flex flex-col gap-3">
            {mostrarDia ? (
              <span className="text-mini text-texto-2 self-center font-mono">{dia}</span>
            ) : null}
            <Bolha mensagem={mensagem} nomeQuemAssumiu={nomeQuemAssumiu} />
          </div>
        );
      })}
    </div>
  );
}
