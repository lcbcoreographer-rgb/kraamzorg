import type { ReactNode } from "react";
import { CascaPublica } from "@/components/shell/casca-publica";

/** Casca da página pública de candidatura (P51): a mesma da captação e do portal. */
export default function LayoutCandidatura({
  children,
}: {
  children: ReactNode;
}) {
  return <CascaPublica>{children}</CascaPublica>;
}
