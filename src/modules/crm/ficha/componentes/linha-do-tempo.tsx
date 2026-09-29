import { Lock } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { EventoTela } from "../tipos";
import { rotuloTipoEvento } from "../rotulos";

/**
 * Linha do tempo da ficha (P16 item 1; DESIGN.md seção 6, protótipo
 * `comercial-ficha.html`, classe `c4-linha`): a régua como espinha, marcos
 * na vertical. Os eventos restritos já chegam filtrados por quem pode ver
 * (o repositório da fundação decide); este componente só desenha o que
 * recebeu, com o título já em frase (`tituloEvento`, em `dados.ts`).
 */
export function LinhaDoTempo({
  eventos,
  emLuto = false,
}: {
  eventos: EventoTela[];
  /**
   * Família em bloqueio total ou encerrada em estado sensível: o vazio sai
   * sem contorno tracejado e sem "ainda" (DESIGN.md 11.5 e 11.8: tracejado
   * quer dizer "ainda não" e nunca aparece em luto, onde nada está
   * pendente).
   */
  emLuto?: boolean;
}) {
  if (eventos.length === 0 && emLuto) {
    return (
      <p className="text-corpo text-texto-2">
        Nenhum marco registrado para esta família.
      </p>
    );
  }
  if (eventos.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum marco registrado ainda"
        texto="O que acontece com esta família entra aqui, do mais recente para o mais antigo."
      />
    );
  }

  return (
    <ol className="flex flex-col" aria-label="Marcos da família">
      {eventos.map((evento, i) => (
        <li
          key={evento.id}
          className="grid grid-cols-[8px_minmax(0,1fr)] gap-4"
        >
          <span
            aria-hidden="true"
            className={cn(
              "rounded-pilula my-1",
              i === 0 ? "bg-dourado" : "bg-marinho",
            )}
          />
          <div className="flex flex-col gap-0.5 pb-4">
            <span className="text-mini text-texto-2 font-mono font-medium tabular-nums">
              {formatarDataHora(evento.criadoEm) ?? evento.criadoEm}
            </span>
            <span className="text-corpo text-texto flex items-center gap-1.5 font-semibold">
              {evento.restrito ? (
                <Lock
                  aria-hidden="true"
                  className="text-texto-2 size-3.5 shrink-0"
                />
              ) : null}
              {evento.titulo || rotuloTipoEvento(evento.tipo)}
            </span>
            {evento.restrito ? (
              <span className="text-mini text-texto-2">
                Evento restrito, visível só para a coordenação e a diretoria.
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
