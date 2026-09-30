import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CascaPublica } from "@/components/shell/casca-publica";

// Título sem nome de família, sem indexação e sem Referer: o link do e-mail e
// a página não deixam rastro de quem é a família (CLAUDE.md: nome de paciente
// nunca em URL, título ou log).
export const metadata: Metadata = {
  title: "Portal da família · Kraamzorg Brasil",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** Casca do portal da família (P49): creme, logo uma vez e coluna de leitura. */
export default function LayoutFamilia({ children }: { children: ReactNode }) {
  return <CascaPublica>{children}</CascaPublica>;
}
