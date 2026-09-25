/**
 * Carregando o painel da Isadora: regra de retomada, modo, base de
 * conhecimento e números do mês.
 */
export default function CarregandoAgente() {
  return (
    <div
      role="status"
      aria-label="Carregando o painel da Isadora"
      className="flex flex-col gap-8 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-1 h-7 w-32" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="bg-marinho-14 rounded-1 h-5 w-56" />
          <div className="bg-marinho-08 rounded-1 h-4 w-4/5" />
          <div className="bg-superficie-2 rounded-3 h-24" />
        </div>
      ))}
    </div>
  );
}
