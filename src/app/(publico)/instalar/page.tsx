import type { Metadata, Viewport } from "next";
import { TelaInstalar } from "@/modules/operacao/instalacao/tela-instalar";

// Sem dado nenhum e sem nome de família. A página liga o manifesto e o ícone
// da tela inicial: é dela que o navegador reconhece o app como instalável.
export const metadata: Metadata = {
  title: "Instalar o aplicativo · Kraamzorg",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icones/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kraamzorg", statusBarStyle: "default" },
};

export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Instalação guiada do aplicativo da enfermeira (P11 item 2). Pública: quem
 * recebe o link do guia ainda não entrou.
 */
export default function PaginaInstalar() {
  return <TelaInstalar />;
}
