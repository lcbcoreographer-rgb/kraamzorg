import type { Metadata } from "next";
import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import type { PaginaCaptacao } from "@/lib/dados/tipos-relacao";
import { configuracaoTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { BotaoWhatsApp } from "@/modules/captacao/componentes/botao-whatsapp";
import { utmDaBusca } from "@/modules/captacao/tipos";

// Título sem nome de canal nem de família; sem indexação e sem Referer.
export const metadata: Metadata = {
  title: "Kraamzorg Brasil",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Página de captação de um canal (P47 item 2): explica em poucas frases o que
 * é a Kraamzorg e leva ao WhatsApp com uma mensagem pronta e o código de
 * origem. Não pede nenhum dado; guarda só os UTM da visita. Textos de
 * mensagem_modelo (canal site), em rascunho até o Leonardo aprovar.
 */
export default async function PaginaCaptacao({
  params,
  searchParams,
}: {
  params: Promise<{ canal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { canal } = await params;
  const utm = utmDaBusca(await searchParams);

  let pagina: PaginaCaptacao | null = null;
  try {
    pagina = await (await obterRelacaoPublica()).paginaCaptacao(canal);
  } catch {
    pagina = null;
  }
  const textos = pagina?.textos ?? {};

  if (!pagina || pagina.situacao !== "ok") {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-titulo text-1 text-texto font-normal">
          {textos.titulo ?? "Kraamzorg Brasil"}
        </h1>
        <p className="text-3 text-texto">
          {textos.indisponivel ??
            "Este link não está disponível agora. Tente de novo em instantes."}
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
      <p className="text-corpo text-texto max-w-[60ch]">
        {textos.como_funciona}
      </p>
      <BotaoWhatsApp
        canal={canal}
        utm={utm}
        siteKey={configuracaoTurnstile().siteKey}
        textos={textos}
      />
      <p className="text-corpo text-texto-2 max-w-[60ch]">
        {textos.privacidade}
      </p>
    </article>
  );
}
