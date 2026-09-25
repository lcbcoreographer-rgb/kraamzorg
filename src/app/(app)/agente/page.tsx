import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Isadora · Kraamzorg OS" };

/**
 * Dono: P27 (tela do agente). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaAgente() {
  return (
    <TelaEmConstrucao
      titulo="Isadora"
      tituloVazio="Os ajustes da Isadora vão aparecer aqui"
      texto="Modo de operação, números de teste, base de conhecimento, retomada de quem parou de responder e os números do mês."
    />
  );
}
