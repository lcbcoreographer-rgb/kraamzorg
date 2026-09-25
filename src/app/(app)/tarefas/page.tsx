import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Tarefas · Kraamzorg OS" };

/**
 * Dono: P18 (mensageria, tarefas e notificações). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaTarefas() {
  return (
    <TelaEmConstrucao
      titulo="Tarefas"
      tituloVazio="As suas tarefas vão aparecer aqui"
      texto="Por prioridade e prazo, com o texto sugerido, o botão para abrir no WhatsApp e o registro do que foi enviado."
    />
  );
}
