/**
 * Carregando a agenda: esqueleto na forma dos cartões de visita, sem
 * spinner e parado para quem pediu menos movimento (DESIGN.md, 11.7).
 */
export default function CarregandoAgenda() {
  return (
    <div
      role="status"
      aria-label="Carregando a agenda"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-1 h-8 w-40" />
      <div className="bg-marinho-08 rounded-1 h-4 w-3/4 max-w-96" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-superficie rounded-3 shadow-1 flex flex-col gap-2 p-5"
        >
          <div className="bg-marinho-14 rounded-1 h-5 w-1/4" />
          <div className="bg-marinho-08 rounded-1 h-4 w-3/5" />
          <div className="bg-marinho-08 rounded-1 h-4 w-2/5" />
        </div>
      ))}
    </div>
  );
}
