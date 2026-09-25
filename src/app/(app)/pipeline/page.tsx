import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Pipeline · Kraamzorg OS" };

/**
 * Dono: P15 (pipelines 1 e 2). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaPipeline() {
  return (
    <TelaEmConstrucao
      titulo="Pipeline"
      tituloVazio="As famílias por estágio vão aparecer aqui"
      texto="No celular, uma lista por estágio; no computador, o quadro com as colunas. Cada família mostra só os passos permitidos para ela."
      acao={{ rotulo: "Ver famílias", href: "/familias" }}
    />
  );
}
