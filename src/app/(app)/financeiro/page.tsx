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
      texto="Aqui você vai ver a receita do mês, as cobranças em aberto e o pagamento da equipe."
      acao={{ rotulo: "Ver cobranças", href: "/cobrancas" }}
    />
  );
}
