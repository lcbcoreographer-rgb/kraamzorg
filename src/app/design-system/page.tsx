import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estaEmProducao } from "@/lib/ambiente";
import { VitrineDesignSystem } from "./vitrine";

/**
 * Vitrine dos componentes de src/components/ui (P10). Existe só fora de
 * produção: em produção, `estaEmProducao()` (NEXT_PUBLIC_APP_ENV) devolve
 * `notFound()` antes de montar qualquer coisa. Dados fictícios (DESIGN.md,
 * seção 9): famílias "Família Teste", equipe com nome inventado.
 */
export const metadata: Metadata = {
  title: "Design system · Kraamzorg OS",
  description:
    "Vitrine dos componentes de src/components/ui, fora do ar em produção.",
};

export default function PaginaDesignSystem() {
  if (estaEmProducao()) {
    notFound();
  }

  return <VitrineDesignSystem />;
}
