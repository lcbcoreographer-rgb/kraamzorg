import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Conversas · Kraamzorg OS" };

/**
 * Dono: P27 (tela do agente). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaConversas() {
  return (
    <TelaEmConstrucao
      titulo="Conversas"
      tituloVazio="As conversas do WhatsApp vão aparecer aqui"
      texto="Em que mão está cada conversa: com a Isadora, com a equipe, pausada ou fora do comercial."
      acao={{ rotulo: "Ver transferências", href: "/transferencias" }}
    />
  );
}
