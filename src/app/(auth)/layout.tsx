import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Casca das telas de acesso (protótipo entrar.html): sóbria, no creme,
 * logo provisório como arquivo e uma coluna de até 400 px. No celular a
 * coluna começa no alto (teclado aberto não esconde o botão); a partir de
 * 600 px fica centralizada.
 */
export default function LayoutAcesso({ children }: { children: ReactNode }) {
  return (
    <main
      id="conteudo"
      className="tablet:place-items-center grid min-h-dvh place-items-start justify-items-center px-4 pt-10 pb-12"
    >
      <div className="max-w-acesso flex w-full flex-col gap-6">
        <Image
          src="/brand/logo-provisorio.png"
          alt="Kraamzorg Brasil"
          width={132}
          height={113}
          priority
        />
        {children}
      </div>
    </main>
  );
}
