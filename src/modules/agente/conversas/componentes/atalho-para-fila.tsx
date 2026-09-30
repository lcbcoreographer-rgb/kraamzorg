"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { lerFiltro } from "../lista";

/**
 * A frase e o atalho do lado vazio: com a lista já em "Esperando alguém",
 * o botão para lá sai e a frase aponta a lista ao lado. Lê o filtro da
 * URL no cliente, porque trocar de filtro não recarrega o servidor.
 */
export function AtalhoParaFila() {
  const naFila = lerFiltro(useSearchParams().get("filtro")) === "esperando";
  return (
    <>
      <p className="text-apoio text-texto-2">
        {naFila
          ? "Estão na lista ao lado, com a prioridade máxima primeiro e depois o prazo que vence antes. Comece pela primeira."
          : "Prioridade máxima primeiro, depois o prazo que vence antes."}
      </p>
      {naFila ? null : (
        <Botao asChild tamanho="compacto">
          <Link href="/conversas?filtro=esperando">Ver quem espera</Link>
        </Botao>
      )}
    </>
  );
}
