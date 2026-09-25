import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

/**
 * Dono: P38 (portal da enfermeira). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaMinhasFamilias() {
  return (
    <TelaEmConstrucao
      titulo="Famílias"
      tituloVazio="As famílias atribuídas a você vão aparecer aqui"
      texto="Cada família com o dia do acompanhamento. Quando a coordenação oferecer uma família, a oferta aparece em Hoje para você aceitar ou recusar."
    />
  );
}
