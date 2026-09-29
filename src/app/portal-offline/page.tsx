import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { CascoOffline } from "@/modules/operacao/portal/componentes/casco-offline";

export const metadata: Metadata = {
  title: "Sem sinal · Kraamzorg OS",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icones/apple-touch-icon.png" },
};

export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Casco do portal da enfermeira sem sinal (P38 item 2). Pública e sem dado:
 * o service worker a guarda, e ela lê o IndexedDB do aparelho. Ver
 * `public/sw.js` e `CascoOffline`.
 */
export default function PaginaPortalOffline() {
  return (
    <Suspense fallback={null}>
      <CascoOffline />
    </Suspense>
  );
}
