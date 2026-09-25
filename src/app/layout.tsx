import type { Metadata } from "next";
import type { ReactNode } from "react";
import { inter, jost, plexMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kraamzorg OS",
  description:
    "Sistema operacional da Kraamzorg Brasil: CRM comercial, operação domiciliar pós-parto, registro assistencial offline e a agente de WhatsApp Isadora.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`h-full antialiased ${jost.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
