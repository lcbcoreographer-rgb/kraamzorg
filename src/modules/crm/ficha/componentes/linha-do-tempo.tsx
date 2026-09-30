import { Lock } from "lucide-react";
import { MantaDobrada } from "@/components/ilustracoes";
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
  semTom = emLuto,
}: {
  eventos: EventoTela[];
  /**
   * Família em bloqueio total ou encerrada em estado sensível: o vazio sai
   * sem contorno tracejado e sem "ainda" (DESIGN.md 11.5 e 11.8: tracejado
   * quer dizer "ainda não" e nunca aparece em luto, onde nada está
   * pendente).
   */
  emLuto?: boolean;
  /** Freio puxado em qualquer estado: blocos sem tom de apoio. */
  semTom?: boolean;
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
        semTom={semTom}
        ilustracao={semTom ? undefined : <MantaDobrada tamanho={104} />}
        titulo="Nenhum marco registrado ainda"
        texto="O que acontece com esta família entra aqui, do mais recente para o mais antigo."
      />
    );
  }

  // Direção "Colo" (DESIGN.md, 2.3): cada marco é um bloco macio preso à
  // espinha por um ponto. O mais recente é o agora (dourado-claro); os
  // outros, o que já foi guardado (areia-clara). Em luto, nada de tom:
  // blocos brancos com contorno e o ponto em ameixa (seção 11.8).
  return (
    <ol className="flex flex-col" aria-label="Marcos da família">
      {eventos.map((evento, i) => {
        const ultimo = i === eventos.length - 1;
        return (
          <li
            key={evento.id}
            className="grid grid-cols-[20px_minmax(0,1fr)] gap-3"
          >
            <span aria-hidden="true" className="flex flex-col items-center">
              <span
                className={cn(
                  "rounded-pilula mt-4 size-3 shrink-0",
                  semTom
                    ? "bg-sensivel"
                    : i === 0
                      ? "bg-dourado shadow-anel-hoje"
                      : "bg-marinho",
                )}
              />
              {ultimo ? null : (
                <span className="bg-marinho-14 rounded-pilula my-1 w-0.5 flex-1" />
              )}
            </span>
            <div
              className={cn(
                "rounded-2 mb-2 flex flex-col gap-1 px-4 py-3",
                semTom
                  ? "bg-superficie border-linha border"
                  : i === 0
                    ? "bg-dourado-claro"
                    : "bg-areia-clara",
              )}
            >
              <span className="text-mini text-texto-2 font-mono font-medium tabular-nums">
                {formatarDataHora(evento.criadoEm) ?? evento.criadoEm}
              </span>
              <span className="text-corpo text-texto flex items-center gap-1.5 leading-snug font-semibold">
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
        );
      })}
    </ol>
  );
}
