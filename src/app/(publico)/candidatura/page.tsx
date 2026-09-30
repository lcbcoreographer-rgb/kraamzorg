import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import type { AberturaCandidatura } from "@/lib/dados/tipos-relacao";
import { configuracaoTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { FormularioCandidatura } from "@/modules/talentos/componentes/form-candidatura";

export const metadata: Metadata = {
  title: "Trabalhe com a Kraamzorg",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Página pública de candidatura (P51 item 3). Nasce DESLIGADA: enquanto o
 * parâmetro talentos_pagina_publica.ativa for falso, só mostra o aviso e não
 * renderiza formulário nem carrega o Turnstile. Não pede dado sensível.
 */
export default async function PaginaCandidatura() {
  let abertura: AberturaCandidatura | null = null;
  try {
    abertura = await (await obterRelacaoPublica()).abrirCandidatura();
  } catch {
    abertura = null;
  }
  const textos = abertura?.textos ?? {};

  if (!abertura || abertura.situacao !== "ok" || !abertura.termoVersao) {
    return (
      <section className="rounded-colo bg-areia-clara flex flex-col gap-4 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {textos.titulo ?? "Trabalhe com a Kraamzorg"}
        </h1>
        <p
          className="text-3 text-texto max-w-[60ch]"
          data-candidatura="desligada"
        >
          {textos.desligada ??
            "No momento a Kraamzorg não está recebendo candidaturas."}
        </p>
      </section>
    );
  }

  return (
    <article className="flex flex-col gap-6">
      <header className="rounded-colo bg-dourado-claro flex flex-col gap-3 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {textos.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[60ch]">{textos.abertura}</p>
      </header>
      <div className="rounded-3 bg-superficie shadow-1 p-5">
        <FormularioCandidatura
          siteKey={configuracaoTurnstile().siteKey}
          termoVersao={abertura.termoVersao}
          textos={textos}
        />
      </div>
      <p className="text-corpo text-texto-2 flex max-w-[60ch] items-start gap-3 px-1">
        <LockKeyhole
          className="mt-1 size-5 shrink-0"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {textos.privacidade}
      </p>
    </article>
  );
}
