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
      tituloVazio="A agenda da semana vai aparecer aqui"
      texto="Visitas, sessões de venda e consultas pré-natais, com os conflitos marcados."
    />
  );
}
