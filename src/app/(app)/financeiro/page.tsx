import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Financeiro · Kraamzorg OS" };

/**
 * Dono: P46 (financeiro, DRE e pagamento da equipe). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaFinanceiro() {
  return (
    <TelaEmConstrucao
      titulo="Financeiro"
      tituloVazio="O resumo financeiro vai aparecer aqui"
      texto="Receita do mês, cobranças em aberto e pagamento da equipe."
      acao={{ rotulo: "Ver cobranças", href: "/cobrancas" }}
    />
  );
}
