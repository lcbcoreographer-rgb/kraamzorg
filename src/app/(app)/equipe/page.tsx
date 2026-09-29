import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Equipe · Kraamzorg OS" };

/**
 * Dono: P37 (agenda, escalas e equipe). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaEquipe() {
  return (
    <TelaEmConstrucao
      titulo="Equipe"
      texto="Aqui você vai ver como está cada enfermeira hoje e a semana da equipe em turnos."
    />
  );
}
