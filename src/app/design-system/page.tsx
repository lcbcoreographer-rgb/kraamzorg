import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vitrineLiberada } from "@/lib/ambiente";
import { VitrineDesignSystem } from "./vitrine";

/**
 * Vitrine dos componentes de src/components/ui (P10). Existe só em
 * desenvolvimento e homologação (P10 item 4): `vitrineLiberada()` libera por
 * lista explícita de `NEXT_PUBLIC_APP_ENV` e recusa também quando
 * `VERCEL_ENV` é "production", mesmo que a outra variável não tenha sido
 * configurada. Sem nenhuma das duas, ou com qualquer valor não reconhecido,
 * `notFound()` roda antes de montar qualquer coisa. Dados fictícios
 * (DESIGN.md, seção 9): famílias "Família Teste", equipe com nome inventado.
 */
export const metadata: Metadata = {
  title: "Design system · Kraamzorg OS",
  description:
    "Vitrine dos componentes de src/components/ui, fora do ar em produção.",
  robots: { index: false },
};

export default function PaginaDesignSystem() {
  if (!vitrineLiberada()) {
    notFound();
  }

  return <VitrineDesignSystem />;
}
