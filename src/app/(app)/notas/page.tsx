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
      texto="Aqui você vai ver as notas fiscais emitidas, as que ainda estão em processamento e as que voltaram com erro."
    />
  );
}
