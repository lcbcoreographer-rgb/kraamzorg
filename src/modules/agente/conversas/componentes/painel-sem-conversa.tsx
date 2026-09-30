import * as React from "react";
import { Inbox } from "lucide-react";
import { SinoCalmo } from "@/components/ilustracoes";
import { TileIcone } from "@/components/ui/tile-icone";
import type { TransferenciaTela } from "../../tipos";
import { AtalhoParaFila } from "./atalho-para-fila";

/**
 * O lado direito sem conversa aberta, como o WhatsApp Web. Com gente
 * esperando, o bloco diz quantas e leva ao filtro "Esperando alguém" (a
 * antiga fila); sem ninguém esperando, o estado vazio com o sino calmo
 * (DESIGN.md, 5.1: a ilustração só conta "nada aberto").
 */
export function PainelSemConversa({
  fila,
}: {
  fila: TransferenciaTela[] | null;
}) {
  const esperando = fila?.filter((t) => t.status === "aberto").length ?? 0;

  return (
    <section
      aria-labelledby="t-sem-conversa"
      className="bg-superficie rounded-3 shadow-1 flex h-full min-h-0 flex-col items-center justify-center gap-6 overflow-y-auto p-10 text-center"
    >
      {esperando === 0 ? <SinoCalmo tamanho={128} /> : null}
      <div className="flex max-w-[44ch] flex-col items-center gap-2">
        <h2
          id="t-sem-conversa"
          className="font-titulo text-1 text-texto font-medium"
        >
          {esperando === 0
            ? "Nenhuma conversa esperando você"
            : "Escolha uma conversa na lista"}
        </h2>
        <p className="text-corpo text-texto-2">
          {esperando === 0
            ? "Escolha uma conversa na lista para ler e responder. A Isadora continua a triagem e avisa aqui quando alguém quiser contratar, marcar a conversa ou falar com uma pessoa."
            : "Ela abre aqui ao lado, com a transferência no topo quando houver, e o campo para responder embaixo."}
        </p>
      </div>
      {esperando > 0 ? (
        <div className="bg-argila-clara rounded-3 flex w-full max-w-md flex-col items-start gap-4 p-5 text-left">
          <div className="flex items-center gap-3">
            <TileIcone tom="argila" forma="quadrado">
              <Inbox />
            </TileIcone>
            <p className="text-texto flex items-baseline gap-2">
              <span className="font-titulo text-numero font-medium tabular-nums">
                {esperando}
              </span>
              <span className="text-3 font-semibold">
                {esperando === 1
                  ? "conversa esperando alguém"
                  : "conversas esperando alguém"}
              </span>
            </p>
          </div>
          <AtalhoParaFila />
        </div>
      ) : null}
    </section>
  );
}
