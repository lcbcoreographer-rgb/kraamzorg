import type { Metadata } from "next";
import { LockKeyhole, MessageCircle } from "lucide-react";
import { TileIcone } from "@/components/ui/tile-icone";
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
      <section className="rounded-3 bg-superficie border-linha flex flex-col gap-4 border p-5">
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
      <header className="rounded-colo bg-dourado-claro flex flex-col gap-3 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {textos.titulo}
        </h1>
        <p className="text-3 text-texto max-w-[60ch]">{textos.abertura}</p>
      </header>
      {/* [polimento] O bloco da conversa em argila médio, com o tile da
          conversa encaixado na borda de cima (DESIGN.md, 2.4: encaixe). */}
      <section className="rounded-3 bg-argila-media mt-6 flex flex-col gap-5 p-5 pt-0">
        <TileIcone
          tom="branco"
          tamanho="g"
          className="ring-fundo -mt-7 ring-[6px]"
        >
          <MessageCircle />
        </TileIcone>
        <p className="text-corpo text-texto -mt-1 max-w-[60ch]">
          {textos.como_funciona}
        </p>
        <BotaoWhatsApp
          canal={canal}
          utm={utm}
          siteKey={configuracaoTurnstile().siteKey}
          textos={textos}
        />
      </section>
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
