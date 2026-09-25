import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Transferências · Kraamzorg OS" };

/**
 * Dono: P27 (tela do agente). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaTransferencias() {
  return (
    <TelaEmConstrucao
      titulo="Transferências"
      tituloVazio="A fila de transferências vai aparecer aqui"
      texto="Cada pedido que a Isadora passou para a equipe, por prioridade e prazo, com o botão para assumir a conversa."
      acao={{ rotulo: "Ver conversas", href: "/conversas" }}
    />
  );
}
