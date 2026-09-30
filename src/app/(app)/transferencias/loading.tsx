/**
 * Carregando a fila de transferências (telas.md C1, estado "carregando"),
 * na forma da tela (direção "Colo"): o título da seção com o tile e os
 * cartões com o prazo em pílula.
 */
export default function CarregandoTransferencias() {
  return (
    <div
      role="status"
      aria-label="Carregando a fila de transferências"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-pilula h-8 w-48" />
      <div className="flex items-center gap-3 pt-2">
        <div className="bg-argila-clara rounded-2 size-11" />
        <div className="bg-marinho-14 rounded-pilula h-5 w-40" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5 lg:max-w-[62%]"
        >
          <div className="flex justify-between gap-3">
            <div className="bg-marinho-14 rounded-pilula h-5 w-2/5" />
            <div className="bg-areia-clara rounded-pilula h-7 w-28" />
          </div>
          <div className="bg-marinho-08 rounded-pilula h-4 w-3/5" />
          <div className="bg-marinho-08 rounded-pilula h-4 w-4/5" />
          <div className="bg-marinho-14 rounded-pilula min-h-toque w-44" />
        </div>
      ))}
    </div>
  );
}
