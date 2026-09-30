import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { inter, jost, plexMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kraamzorg OS",
  description:
    "Sistema operacional da Kraamzorg Brasil: CRM comercial, operação domiciliar pós-parto, registro assistencial offline e a agente de WhatsApp Isadora.",
};

/**
 * Toda página é dinâmica: a CSP com nonce (`src/proxy.ts`, P14) só chega ao
 * HTML de página renderizada a cada requisição. Página pré-gerada no build
 * não tem nonce e o navegador barraria os scripts dela. O app inteiro fica
 * atrás de login, então nada aqui perde com isso.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  return (
    <html
      lang="pt-BR"
      className={`h-full antialiased ${jost.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
