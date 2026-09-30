/**
 * Carregando uma conversa (telas.md C2): esqueleto do bloco da família com a
 * base em arco, do bloco de quem conduz e das bolhas, na mesma ordem da
 * tela pronta (direção "Colo").
 */
export default function CarregandoConversa() {
  return (
    <div
      role="status"
      aria-label="Carregando a conversa"
      className="flex flex-col gap-4 pt-2 motion-safe:animate-pulse"
    >
      <div className="rounded-colo bg-superficie-2 h-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-dourado-claro rounded-3 h-32 lg:col-start-2 lg:row-start-1" />
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <div className="bg-superficie rounded-3 shadow-1 h-16 w-4/5 self-start" />
          <div className="bg-superficie-2 rounded-3 h-20 w-4/5 self-end" />
          <div className="bg-superficie rounded-3 shadow-1 h-12 w-3/5 self-start" />
        </div>
      </div>
    </div>
  );
}
