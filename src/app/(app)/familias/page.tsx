import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Famílias · Kraamzorg OS" };

/**
 * Dono: P16 (ficha 360 e estado sensível). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaFamilias() {
  return (
    <TelaEmConstrucao
      titulo="Famílias"
      tituloVazio="A lista de famílias vai aparecer aqui"
      texto="Busca por nome ou telefone e acesso à ficha de cada família, com as quatro datas e o freio em um toque."
    />
  );
}
