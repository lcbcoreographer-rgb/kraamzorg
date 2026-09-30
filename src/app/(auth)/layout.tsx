import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Casca das telas de acesso (protótipo entrar.html; direção "Colo",
 * DESIGN.md 2.1 e 2.4). O logo mora num bloco dourado-claro com a base em
 * arco, o colo do símbolo segurando a marca; embaixo dele (no celular) ou
 * ao lado (no computador), a coluna de até 400 px com o formulário. No
 * celular a coluna começa no alto (teclado aberto não esconde o botão).
 */
export default function LayoutAcesso({ children }: { children: ReactNode }) {
  return (
    <main
      id="conteudo"
      className="grid min-h-dvh justify-items-center px-4 pt-4 pb-12 lg:place-items-center lg:px-8 lg:py-10"
    >
      <div className="flex w-full max-w-[960px] flex-col items-center gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-stretch lg:gap-12">
        <div className="rounded-colo bg-dourado-claro flex w-full flex-col items-center justify-center gap-3 px-6 pt-8 pb-14 lg:min-h-[520px] lg:pb-20">
          <Image
            src="/brand/logo-provisorio.png"
            alt="Kraamzorg Brasil"
            width={132}
            height={113}
            priority
            className="lg:h-auto lg:w-[176px]"
          />
          <p className="font-titulo text-marca text-texto">Kraamzorg OS</p>
        </div>
        <div className="max-w-acesso flex w-full flex-col justify-center gap-6">
          {children}
        </div>
      </div>
    </main>
  );
}
