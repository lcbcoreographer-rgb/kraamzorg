/**
 * Carregando a conversa ao lado da lista (telas.md C2, estado
 * "carregando"): o cabeçalho com o avatar, a faixa do topo e as bolhas,
 * na mesma ordem da conversa pronta, sem spinner. Sem animação quando a
 * pessoa pediu menos movimento.
 */
export function EsqueletoConversa() {
  return (
    <div
      role="status"
      aria-label="Carregando a conversa"
      className="lg:rounded-3 lg:shadow-1 flex h-full min-h-0 flex-col overflow-hidden motion-safe:animate-pulse"
    >
      <div className="bg-superficie flex items-center gap-3 px-4 py-3">
        <div className="bg-argila-clara rounded-pilula size-12 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="bg-marinho-14 rounded-pilula h-5 w-2/5" />
          <div className="bg-marinho-08 rounded-pilula h-4 w-1/4" />
        </div>
      </div>
      <div className="bg-fundo flex flex-1 flex-col gap-3 px-4 py-3">
        <div className="bg-argila-clara rounded-3 h-24" />
        <div className="bg-superficie rounded-3 shadow-1 h-14 w-3/5 self-start" />
        <div className="bg-superficie-2 rounded-3 h-20 w-3/5 self-end" />
        <div className="bg-superficie rounded-3 shadow-1 h-12 w-2/5 self-start" />
      </div>
      <div className="bg-superficie h-24" />
    </div>
  );
}
