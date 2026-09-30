/**
 * Carregando a lista de conversas (telas.md C5, estado "carregando"):
 * esqueleto com a forma dos números que filtram e dos cartões com a bolha
 * da última mensagem (direção "Colo"), sem spinner. Sem animação quando a
 * pessoa pediu menos movimento.
 */
export default function CarregandoConversas() {
  return (
    <div
      role="status"
      aria-label="Carregando as conversas"
      className="flex flex-col gap-6 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-pilula h-8 w-40" />
      <div className="tablet:grid-cols-6 grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-areia-clara rounded-3 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="bg-argila-clara rounded-2 size-11" />
              <div className="bg-marinho-14 rounded-pilula h-5 w-3/5" />
            </div>
            <div className="bg-areia-clara rounded-2 h-14" />
            <div className="bg-marinho-08 rounded-pilula min-h-toque w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}
