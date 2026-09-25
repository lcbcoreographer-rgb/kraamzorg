import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vitrineLiberada } from "@/lib/ambiente";
import { DemonstracaoSync } from "./demonstracao";

/**
 * Formulário de demonstração do motor offline (P12, item 5). Existe só
 * fora de produção, no mesmo padrão de `/design-system` (P10 item 4):
 * `vitrineLiberada()` libera por lista explícita de `NEXT_PUBLIC_APP_ENV`
 * e recusa também quando `VERCEL_ENV` é "production".
 */
export const metadata: Metadata = {
  title: "Sincronização offline · Kraamzorg OS",
  description:
    "Demonstração do motor offline (Dexie, fila por campo), fora do ar em produção.",
  robots: { index: false },
};

export default function PaginaDevSync() {
  if (!vitrineLiberada()) {
    notFound();
  }

  return <DemonstracaoSync />;
}
