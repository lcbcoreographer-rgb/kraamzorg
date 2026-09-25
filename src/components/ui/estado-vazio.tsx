import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio (DESIGN.md, seção 6). Contorno tracejado no lugar do
 * conteúdo, título que diz o que é, texto que diz por que está vazio e o
 * que vai aparecer, e a próxima ação como botão. Nunca omitido: o vazio é
 * desenhado, não uma tela em branco.
 */
export interface EstadoVazioProps {
  titulo: React.ReactNode;
  texto: React.ReactNode;
  /** Botão com a próxima ação (ex: um `<Botao>`). */
  acao?: React.ReactNode;
  /** Nível do título na hierarquia da página (padrão h3). */
  nivelTitulo?: "h2" | "h3";
  className?: string;
}

export function EstadoVazio({
  titulo,
  texto,
  acao,
  nivelTitulo: Titulo = "h3",
  className,
}: EstadoVazioProps) {
  return (
    <div
      className={cn(
        "rounded-3 border-marinho-50 flex flex-col items-start gap-3 border-[1.5px] border-dashed p-6",
        className,
      )}
    >
      <Titulo className="font-titulo text-2 text-texto font-medium">
        {titulo}
      </Titulo>
      <p className="text-corpo text-texto-2 max-w-[52ch]">{texto}</p>
      {acao}
    </div>
  );
}
