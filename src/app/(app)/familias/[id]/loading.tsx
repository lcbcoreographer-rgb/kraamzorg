/**
 * Carregando a ficha (telas.md C4, estado "carregando"): esqueleto com a
 * forma do que vem (direção "Colo"): o bloco da família com a base em arco,
 * a trilha das abas em pílula e os marcos em blocos, sem spinner no meio do
 * conteúdo. Sem animação quando a pessoa pediu menos movimento.
 */
export default function CarregandoFicha() {
  return (
    <div
      role="status"
      aria-label="Carregando a ficha da família"
      className="flex flex-col gap-6 pt-2 motion-safe:animate-pulse"
    >
      <div className="rounded-colo bg-superficie-2 flex flex-col gap-4 px-4 pt-4 pb-12 lg:px-8 lg:pt-6">
        <div className="bg-marinho-14 rounded-pilula h-7 w-3/5 max-w-80" />
        <div className="bg-marinho-08 rounded-pilula h-4 w-2/5 max-w-60" />
        <div className="tablet:grid-cols-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="bg-marinho-08 rounded-pilula h-3 w-12" />
              <div className="bg-marinho-14 rounded-pilula h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-pilula bg-areia h-[52px] w-full max-w-md" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
              <div className="bg-marinho-14 rounded-pilula mx-auto mt-4 size-3" />
              <div className="rounded-2 bg-areia-clara flex flex-col gap-1.5 px-4 py-3">
                <div className="bg-marinho-08 rounded-pilula h-3 w-28" />
                <div className="bg-marinho-14 rounded-pilula h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-3 bg-argila-clara h-40" />
      </div>
    </div>
  );
}
