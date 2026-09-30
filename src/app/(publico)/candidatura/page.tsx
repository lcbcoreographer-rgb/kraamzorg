import type { Metadata } from "next";
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
      <section className="flex flex-col gap-4">
        <h1 className="font-titulo text-1 text-texto font-normal">
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
      <h1 className="font-titulo text-1 text-texto font-normal">
        {textos.titulo}
      </h1>
      <p className="text-3 text-texto max-w-[60ch]">{textos.abertura}</p>
      <FormularioCandidatura
        siteKey={configuracaoTurnstile().siteKey}
        termoVersao={abertura.termoVersao}
        textos={textos}
      />
      <p className="text-corpo text-texto-2 max-w-[60ch]">
        {textos.privacidade}
      </p>
    </article>
  );
}
