/**
 * Carregando a ficha (telas.md C4, estado "carregando"): esqueleto com a
 * forma do cabeçalho de areia, das abas e da linha do tempo, sem spinner
 * no meio do conteúdo. Sem animação quando a pessoa pediu menos movimento.
 */
export default function CarregandoFicha() {
  return (
    <div
      role="status"
      aria-label="Carregando a ficha da família"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-superficie-2 -mx-4 flex flex-col gap-4 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8 lg:pt-6">
        <div className="bg-marinho-14 rounded-1 h-7 w-3/5 max-w-80" />
        <div className="bg-marinho-08 rounded-1 h-4 w-2/5 max-w-60" />
        <div className="tablet:grid-cols-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="bg-marinho-08 rounded-1 h-3 w-12" />
              <div className="bg-marinho-14 rounded-1 h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <div className="border-linha flex gap-4 border-b pb-3">
            <div className="bg-marinho-08 rounded-1 h-4 w-24" />
            <div className="bg-marinho-08 rounded-1 h-4 w-20" />
            <div className="bg-marinho-08 rounded-1 h-4 w-20" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[8px_minmax(0,1fr)] gap-4">
              <div className="bg-marinho-14 rounded-pilula" />
              <div className="flex flex-col gap-1.5 pb-4">
                <div className="bg-marinho-08 rounded-1 h-3 w-28" />
                <div className="bg-marinho-14 rounded-1 h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-superficie rounded-3 shadow-1 h-40" />
      </div>
    </div>
  );
}
