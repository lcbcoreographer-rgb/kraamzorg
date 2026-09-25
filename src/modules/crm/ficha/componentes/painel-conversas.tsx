import Link from "next/link";
import { Bot, MessageCircle, User } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { formatarDataHora } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { ConversaResumoTela } from "../tipos";

/**
 * Aba Conversas, em leitura (P16 item 1: "conversas do WhatsApp, leitura
 * para comercial, coordenação e diretoria"). Sem ação nenhuma aqui: enviar
 * mensagem ou assumir a conversa é `/conversas` (P27), fora desta pasta.
 */
export function PainelConversas({
  conversa,
}: {
  conversa: ConversaResumoTela | null;
}) {
  if (!conversa || conversa.mensagens.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma conversa ainda"
        texto="Quando esta família escrever no WhatsApp, as últimas mensagens aparecem aqui, em leitura."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {conversa.mensagens.map((mensagem) => {
          const daFamilia = mensagem.direcao === "entrada";
          const daIsadora = !daFamilia && mensagem.enviadoPor === "ia";
          return (
            <div
              key={mensagem.id}
              className={cn(
                "rounded-3 max-w-[85%] px-4 py-2.5",
                daFamilia
                  ? "bg-superficie shadow-1 self-start"
                  : daIsadora
                    ? "bg-superficie-2 self-end"
                    : "bg-marinho text-texto-inverso self-end",
              )}
            >
              {!daFamilia ? (
                <p className="text-mini mb-0.5 flex items-center gap-1 font-semibold opacity-80">
                  {daIsadora ? (
                    <Bot aria-hidden="true" className="size-3.5" />
                  ) : (
                    <User aria-hidden="true" className="size-3.5" />
                  )}
                  {daIsadora ? "Isadora (IA)" : "Equipe"}
                </p>
              ) : null}
              <p className="text-corpo">{mensagem.conteudo}</p>
              <p className="text-mini mt-1 opacity-70">
                {formatarDataHora(mensagem.enviadaEm)}
              </p>
            </div>
          );
        })}
      </div>
      <Link
        href={`/conversas/${conversa.conversaId}`}
        className="text-apoio min-h-toque inline-flex items-center gap-1.5 self-start font-semibold underline underline-offset-2"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        Abrir em Conversas
      </Link>
    </div>
  );
}
