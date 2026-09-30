import * as React from "react";
import { Inbox, OctagonPause, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { iniciais } from "../lista";

/**
 * Avatar da conversa, como no WhatsApp: as iniciais num tile redondo.
 * Tom pelo assunto (DESIGN.md, 2.5 e 2.7): pessoas e conversas em argila.
 * Família em estado sensível perde o tom e fica em ameixa lavado, com o
 * octógono de pausa no lugar das iniciais (seção 11.8); fora do comercial
 * (não lead) fica neutro. Decorativo: o nome está logo ao lado.
 */
export function AvatarContato({
  nome,
  jeito = "pessoa",
  tamanho = "m",
  className,
}: {
  nome: string | null;
  jeito?: "pessoa" | "sensivel" | "neutro" | "pedido";
  /** m = 48 px (lista), p = 40 px (cabeçalho da conversa no celular). */
  tamanho?: "m" | "p";
  className?: string;
}) {
  const letras = jeito === "pessoa" || jeito === "neutro" ? iniciais(nome) : "";
  const Icone =
    jeito === "sensivel"
      ? OctagonPause
      : jeito === "pedido"
        ? Inbox
        : UserRound;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "rounded-pilula font-titulo inline-flex shrink-0 items-center justify-center font-medium",
        tamanho === "m" ? "text-2 size-12" : "text-3 size-10",
        jeito === "sensivel"
          ? "bg-sensivel-lavado text-sensivel"
          : jeito === "neutro"
            ? "bg-marinho-08 text-texto"
            : "bg-argila-media text-texto",
        className,
      )}
    >
      {letras ? (
        letras
      ) : (
        <Icone
          className={tamanho === "m" ? "size-5" : "size-[18px]"}
          strokeWidth={1.75}
        />
      )}
    </span>
  );
}
