import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

/**
 * Dono: P38 (portal da enfermeira). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaMinhasFamilias() {
  return (
    <TelaEmConstrucao
      titulo="Famílias"
      texto="Aqui você vai ver as famílias que você acompanha, cada uma com o dia do acompanhamento."
    />
  );
}
