/** Carregando uma tela do portal: esqueleto na forma do cartão de visita, sem spinner. */
export default function CarregandoPortal() {
  return (
    <div
      role="status"
      aria-label="Carregando a tela"
      className="flex flex-col gap-4 pt-6 motion-safe:animate-pulse"
    >
      <div className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5">
        <div className="bg-marinho-14 rounded-1 h-5 w-1/3" />
        <div className="bg-marinho-14 rounded-1 h-6 w-2/3" />
        <div className="bg-marinho-08 rounded-1 h-4 w-4/5" />
        <div className="bg-marinho-08 rounded-1 h-12" />
      </div>
    </div>
  );
}
