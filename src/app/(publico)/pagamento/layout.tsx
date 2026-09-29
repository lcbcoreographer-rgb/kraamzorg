import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Casca da página de retorno do pagamento (DESIGN.md 11.9): a mesma do
 * formulário público, creme de fundo, logo no topo uma vez e coluna única de
 * leitura, sem nada que lembre o sistema da equipe.
 */
export default function LayoutPagamento({ children }: { children: ReactNode }) {
  return (
    <main
      id="conteudo"
      className="flex min-h-dvh justify-center px-4 pt-8 pb-16"
    >
      <div className="max-w-leitura flex w-full flex-col gap-8">
        <Image
          src="/brand/logo-provisorio.png"
          alt="Kraamzorg Brasil"
          width={104}
          height={89}
          priority
        />
        {children}
      </div>
    </main>
  );
}
