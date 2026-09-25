import type { ReactNode } from "react";
import { CascaEnfermeira } from "@/components/shell/casca-app";
import { exigirSessao } from "@/lib/auth/sessao";

/** Portal da enfermeira: abas inferiores sempre, conteúdo até 720 px (P38). */
export default async function LayoutEnfermeira({
  children,
}: {
  children: ReactNode;
}) {
  const sessao = await exigirSessao();
  return <CascaEnfermeira sessao={sessao}>{children}</CascaEnfermeira>;
}
