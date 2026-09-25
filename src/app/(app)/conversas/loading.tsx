/**
 * Carregando a lista de conversas (telas.md C5, estado "carregando"):
 * esqueleto com a forma dos filtros e dos cartões, sem spinner. Sem
 * animação quando a pessoa pediu menos movimento.
 */
export default function CarregandoConversas() {
  return (
    <div
      role="status"
      aria-label="Carregando as conversas"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-1 h-7 w-40" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-marinho-08 rounded-pilula min-h-toque w-28 shrink-0"
          />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-superficie rounded-3 shadow-1 flex flex-col gap-2 p-4"
        >
          <div className="bg-marinho-14 rounded-1 h-5 w-3/5" />
          <div className="bg-marinho-08 rounded-1 h-4 w-28" />
          <div className="bg-marinho-08 rounded-1 h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}
