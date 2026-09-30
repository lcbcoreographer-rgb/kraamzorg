import { ConfirmarEntrada } from "@/modules/familia/componentes/confirmar-entrada";

/**
 * Página do link do e-mail (P49). O link só abre esta página; quem gasta o
 * link é o botão, tocado por uma pessoa. Assim antivírus e pré-visualização
 * de e-mail, que abrem o endereço sozinhos, não deixam o link vencido.
 * O link traz um código de uso único, nunca nome nem e-mail.
 */
export default async function PaginaConfirmarEntrada({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; demo?: string }>;
}) {
  const { token_hash: tokenHash, demo } = await searchParams;
  const valido = Boolean(tokenHash || demo);
  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-titulo text-1 text-texto font-normal">
        {valido ? "Tudo certo para entrar" : "Este link não está completo"}
      </h1>
      <p className="text-3 text-texto max-w-[60ch]">
        {valido
          ? "Toque no botão para abrir o portal da sua família."
          : "Peça um novo link com o e-mail que você deu à Kraamzorg."}
      </p>
      {valido ? (
        <ConfirmarEntrada
          tokenHash={tokenHash ?? ""}
          demo={demo ?? ""}
          rotulo="Abrir o portal"
        />
      ) : (
        <a
          className="text-corpo text-texto underline underline-offset-4"
          href="/familia/entrar"
        >
          Pedir um novo link
        </a>
      )}
    </section>
  );
}
