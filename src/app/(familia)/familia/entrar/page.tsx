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
      <h1 className="font-titulo text-1 text-texto font-normal">
        {textos.titulo ?? "Entrar no portal da família"}
      </h1>
      {aviso === "link" && link.invalido ? (
        <p role="status" className="text-3 text-texto">
          {link.invalido}
        </p>
      ) : null}
      <p className="text-3 text-texto max-w-[60ch]">{textos.apoio}</p>
      <FormularioEntrar
        siteKey={configuracaoTurnstile().siteKey}
        textos={textos}
      />
    </section>
  );
}
