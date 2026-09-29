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
      texto="Aqui você vai ver os links de pagamento, as parcelas e as baixas confirmadas pelo meio de pagamento."
    />
  );
}
