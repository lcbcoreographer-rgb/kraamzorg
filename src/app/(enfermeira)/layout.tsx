import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CascaEnfermeira } from "@/components/shell/casca-app";
import { exigirSessao } from "@/lib/auth/sessao";
import { ProvedorPortal } from "@/modules/operacao/portal/componentes/provedor-portal";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icones/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kraamzorg", statusBarStyle: "default" },
};

/** Tela cheia no celular: o conteúdo respeita a área segura do aparelho. */
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Portal da enfermeira: abas inferiores sempre, conteúdo até 720 px (P38). O
 * provedor liga o motor offline do P12 e o service worker do app instalável
 * em todas as abas.
 */
export default async function LayoutEnfermeira({
  children,
}: {
  children: ReactNode;
}) {
  const sessao = await exigirSessao();
  return (
    <ProvedorPortal usuarioId={sessao.usuarioId}>
      <CascaEnfermeira sessao={sessao}>{children}</CascaEnfermeira>
    </ProvedorPortal>
  );
}
