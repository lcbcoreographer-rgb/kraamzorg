import type { Metadata } from "next";

// Sem nome de família no título; sem indexação e sem Referer.
export const metadata: Metadata = {
  title: "Pagamento · Kraamzorg Brasil",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Para onde a família volta depois do link de pagamento (P32, `redirect_url`
 * da InfinitePay). A página não sabe se o pagamento foi concluído: quem
 * confirma é o meio de pagamento, pelo webhook. Por isso o texto diz o que
 * acontece depois, sem afirmar que deu certo nem que deu errado.
 */
export default function PaginaPagamentoRecebido() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-titulo text-display text-texto font-normal">
        Obrigado.
      </h1>
      <p className="text-corpo text-texto max-w-[52ch]">
        Quando o meio de pagamento confirmar, a equipe da Kraamzorg recebe o
        aviso e entra em contato com você pelo WhatsApp.
      </p>
      <p className="text-corpo text-texto-2 max-w-[52ch]">
        Se alguma coisa não saiu como você esperava, é só nos chamar por lá.
        Nada mais precisa ser feito por aqui.
      </p>
    </div>
  );
}
