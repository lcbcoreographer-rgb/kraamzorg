import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Casca das páginas abertas para quem chega de fora (captação, candidatura,
 * portal da família): creme de fundo, o logo no topo uma vez e coluna única
 * de leitura, sem barra lateral nem nada que lembre o sistema da equipe
 * (DESIGN.md 11.9). Parágrafo da família nunca abaixo de 16 px.
 */
export function CascaPublica({ children }: { children: ReactNode }) {
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
