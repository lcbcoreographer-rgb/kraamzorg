import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Casca da pesquisa pública da família (DESIGN.md 11.9): creme de fundo, logo
 * no topo uma vez, coluna única de leitura, sem barra lateral e sem nada que
 * lembre o sistema da equipe. Igual à do formulário do contrato.
 */
export default function LayoutPesquisa({ children }: { children: ReactNode }) {
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
