import type { ReactNode } from "react";
import { CascaApp } from "@/components/shell/casca-app";
import { exigirSessao } from "@/lib/auth/sessao";

/**
 * Painel de diretoria, comercial, coordenação, financeiro e marketing. O
 * proxy já barrou quem não entrou ou não fez o MFA; aqui a sessão é lida
 * de novo (segunda barreira: pode ter sido revogada no meio do caminho) e
 * a casca monta a navegação do papel.
 */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const sessao = await exigirSessao();
  return <CascaApp sessao={sessao}>{children}</CascaApp>;
}
