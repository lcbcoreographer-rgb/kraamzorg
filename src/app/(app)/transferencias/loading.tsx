/**
 * Carregando a fila de transferências (telas.md C1, estado "carregando").
 */
export default function CarregandoTransferencias() {
  return (
    <div
      role="status"
      aria-label="Carregando a fila de transferências"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-1 h-7 w-48" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-superficie rounded-3 shadow-1 flex flex-col gap-2 p-4"
        >
          <div className="flex justify-between gap-3">
            <div className="bg-marinho-14 rounded-1 h-5 w-2/5" />
            <div className="bg-marinho-08 rounded-1 h-4 w-24" />
          </div>
          <div className="bg-marinho-08 rounded-1 h-4 w-3/5" />
          <div className="bg-marinho-08 rounded-1 h-4 w-4/5" />
          <div className="bg-marinho-14 rounded-pilula min-h-toque w-44" />
        </div>
      ))}
    </div>
  );
}
