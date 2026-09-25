import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vitrineLiberada } from "@/lib/ambiente";
import { exigirSessao } from "@/lib/auth/sessao";
import { DemonstracaoSync } from "./demonstracao";

/**
 * Formulário de demonstração do motor offline (P12, item 5). Existe só
 * fora de produção, no mesmo padrão de `/design-system` (P10 item 4):
 * `vitrineLiberada()` libera por lista explícita de `NEXT_PUBLIC_APP_ENV`
 * e recusa também quando `VERCEL_ENV` é "production".
 *
 * Exige sessão com a regra do proxy (`/dev/sync` em RESTRITAS, só para
 * quem trabalha em AAL2): `POST /api/sync` confere o `usuarioId` de cada
 * item contra a sessão, por isso a fila da demonstração usa o da sessão.
 */
export const metadata: Metadata = {
  title: "Sincronização offline · Kraamzorg OS",
  description:
    "Demonstração do motor offline (Dexie, fila por campo), fora do ar em produção.",
  robots: { index: false },
};

export default async function PaginaDevSync() {
  if (!vitrineLiberada()) {
    notFound();
  }

  const sessao = await exigirSessao("/dev/sync");
  return <DemonstracaoSync usuarioId={sessao.usuarioId} />;
}
