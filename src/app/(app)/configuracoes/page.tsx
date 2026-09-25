import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Configurações · Kraamzorg OS" };

/**
 * Dono: P13 (configurações). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaConfiguracoes() {
  return (
    <TelaEmConstrucao
      titulo="Configurações"
      tituloVazio="Os ajustes do sistema vão aparecer aqui"
      texto="Parâmetros, pacotes e preços com vigência, regiões, mensagens e termos de alerta. A coordenação vê só termos de alerta e instrumentos."
    />
  );
}
