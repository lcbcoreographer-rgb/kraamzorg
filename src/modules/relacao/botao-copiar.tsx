"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";

/**
 * Copia um texto (link, código) para a área de transferência e diz o que
 * aconteceu. Se o navegador não deixar, o texto continua visível ao lado
 * para a pessoa selecionar (voz.md: erro diz o que fazer).
 */
export function BotaoCopiar({
  texto,
  rotulo,
  rotuloAcessivel,
}: {
  texto: string;
  rotulo: string;
  rotuloAcessivel: string;
}) {
  const [estado, definirEstado] = React.useState<
    "parado" | "copiado" | "falhou"
  >("parado");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      definirEstado("copiado");
    } catch {
      definirEstado("falhou");
    }
    window.setTimeout(() => definirEstado("parado"), 4000);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Botao
        type="button"
        variante="secundario"
        tamanho="compacto"
        onClick={copiar}
        aria-label={rotuloAcessivel}
        iconeEsquerda={
          estado === "copiado" ? (
            <Check aria-hidden="true" className="size-4" strokeWidth={1.75} />
          ) : (
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
          )
        }
      >
        {estado === "copiado" ? "Copiado" : rotulo}
      </Botao>
      <span role="status" className="text-mini text-texto-2 min-h-4">
        {estado === "copiado"
          ? "Pronto para colar."
          : estado === "falhou"
            ? "Não deu para copiar daqui. Selecione o texto e copie."
            : ""}
      </span>
    </span>
  );
}
