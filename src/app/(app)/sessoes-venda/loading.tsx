/**
 * Carregando a agenda das sessões de venda: esqueleto na forma das linhas
 * da agenda, sem spinner, parado para quem pediu menos movimento.
 */
export default function CarregandoSessoesVenda() {
  return (
    <div
      role="status"
      aria-label="Carregando a agenda das conversas"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-1 h-8 w-56" />
      <div className="bg-marinho-08 rounded-1 h-4 w-3/4 max-w-96" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-superficie rounded-3 shadow-1 grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-4 p-4"
        >
          <div className="bg-marinho-14 rounded-1 h-4" />
          <div className="flex flex-col gap-2">
            <div className="bg-marinho-14 rounded-1 h-5 w-2/5" />
            <div className="bg-marinho-08 rounded-1 h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
