import { obterRelacaoPublica } from "@/lib/dados/publico-relacao";
import { configuracaoTurnstile } from "@/lib/integracoes/turnstile/cliente";
import { FormularioEntrar } from "@/modules/familia/componentes/formulario-entrar";

/**
 * Entrada do portal da família (P49): o e-mail que a pessoa deu à Kraamzorg e
 * um link, sem senha. Textos de mensagem_modelo, em rascunho até a aprovação.
 */
export default async function PaginaEntrarNoPortal({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  let textos: Record<string, string> = {};
  let link: Record<string, string> = {};
  try {
    const pagina = await (await obterRelacaoPublica()).paginaEntradaPortal();
    textos = pagina.entrar;
    link = pagina.link;
  } catch {
    textos = {};
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="rounded-colo bg-dourado-claro flex flex-col gap-3 px-5 pt-6 pb-12">
        <h1 className="font-titulo text-display text-texto font-normal">
          {textos.titulo ?? "Entrar no portal da família"}
        </h1>
        <p className="text-3 text-texto max-w-[60ch]">{textos.apoio}</p>
      </header>
      {aviso === "link" && link.invalido ? (
        <p
          role="status"
          className="rounded-2 bg-superficie border-linha text-3 text-texto border px-4 py-3"
        >
          {link.invalido}
        </p>
      ) : null}
      <div className="rounded-3 bg-superficie shadow-1 flex flex-col gap-4 p-5">
        <FormularioEntrar
          siteKey={configuracaoTurnstile().siteKey}
          textos={textos}
        />
      </div>
    </section>
  );
}
