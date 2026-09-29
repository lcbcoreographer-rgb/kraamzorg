import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Alertas · Kraamzorg OS" };

/**
 * Dono: P40 (motor de alertas clínicos). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaAlertas() {
  return (
    <TelaEmConstrucao
      titulo="Alertas"
      texto="Aqui você vai ver os alertas abertos das famílias que você acompanha, com o que falta registrar em cada um."
    />
  );
}
