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
      tituloVazio="Os alertas abertos vão aparecer aqui"
      texto="Quando um valor do checklist passar do limite, o alerta aparece aqui e na tela da visita, com o que falta registrar."
    />
  );
}
