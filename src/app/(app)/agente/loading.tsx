/**
 * Carregando o painel da Isadora: o modo e a retomada lado a lado, os
 * números do mês e a base de conhecimento, cada um no bloco do tom dele
 * (direção "Colo").
 */
export default function CarregandoAgente() {
  return (
    <div
      role="status"
      aria-label="Carregando o painel da Isadora"
      className="flex flex-col gap-6 pt-2 motion-safe:animate-pulse"
    >
      <div className="bg-marinho-14 rounded-pilula h-8 w-32" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-dourado-claro rounded-3 h-48" />
        <div className="bg-lavanda-clara rounded-3 h-48" />
      </div>
      <div className="bg-argila-clara rounded-3 h-40" />
      <div className="bg-areia-clara rounded-3 h-56" />
    </div>
  );
}
