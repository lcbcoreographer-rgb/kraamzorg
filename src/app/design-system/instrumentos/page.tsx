import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vitrineLiberada } from "@/lib/ambiente";
import { VitrineInstrumentos } from "./vitrine-instrumentos";

/**
 * Vitrine do gerador de formulário (P34), com as definições v1 de
 * supabase/dados/instrumentos e um bebê ou gêmeos fictícios. Mesma trava da
 * /design-system: só existe em desenvolvimento e homologação. Não grava
 * nada: usa a persistência em memória.
 */
export const metadata: Metadata = {
  title: "Instrumentos · Kraamzorg OS",
  description:
    "Vitrine do gerador de formulário dos instrumentos clínicos, fora do ar em produção.",
  robots: { index: false },
};

export default function PaginaVitrineInstrumentos() {
  if (!vitrineLiberada()) {
    notFound();
  }
  return <VitrineInstrumentos />;
}
