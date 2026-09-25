import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Notas · Kraamzorg OS" };

/**
 * Dono: P43 (nota fiscal de serviço). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaNotas() {
  return (
    <TelaEmConstrucao
      titulo="Notas"
      tituloVazio="As notas fiscais vão aparecer aqui"
      texto="Notas emitidas, em processamento e com erro, ligadas a cada cobrança."
    />
  );
}
