import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Agenda · Kraamzorg OS" };

/**
 * Dono: P37 (agenda, escalas e equipe). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaAgenda() {
  return (
    <TelaEmConstrucao
      titulo="Agenda"
      texto="Aqui você vai ver as visitas, as sessões de venda e as consultas pré-natais da semana, com os conflitos marcados."
    />
  );
}
