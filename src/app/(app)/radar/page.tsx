import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Radar · Kraamzorg OS" };

/**
 * Dono: P36 (designação e radar de nascimentos). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaRadar() {
  return (
    <TelaEmConstrucao
      titulo="Radar"
      tituloVazio="O radar de nascimentos vai aparecer aqui"
      texto="As famílias que podem nascer nas próximas semanas, com titular e backup de cada uma e a ocupação por praça."
    />
  );
}
