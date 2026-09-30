import type { ReactNode } from "react";
import { CascaPublica } from "@/components/shell/casca-publica";

/** Casca da página de captação `/c/[canal]` (P47): a mesma do formulário público. */
export default function LayoutCaptacao({ children }: { children: ReactNode }) {
  return <CascaPublica>{children}</CascaPublica>;
}
