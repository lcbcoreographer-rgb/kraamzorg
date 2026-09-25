import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Cobranças · Kraamzorg OS" };

/**
 * Dono: P32 (cobrança pela InfinitePay). Rota criada pela casca (P10) com o estado vazio; o módulo
 * dono troca este conteúdo, só nesta pasta.
 */
export default function PaginaCobrancas() {
  return (
    <TelaEmConstrucao
      titulo="Cobranças"
      tituloVazio="As cobranças vão aparecer aqui"
      texto="Links de pagamento, parcelas e baixas confirmadas pelo meio de pagamento."
    />
  );
}
