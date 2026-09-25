import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { DestinoHandoff } from "@/lib/dados/tipos";
import type { TransferenciaTela } from "../../tipos";
import { CartaoTransferencia } from "./cartao-transferencia";

/**
 * Fila de transferências, já ordenada por prioridade e prazo pelo
 * repositório (P27 item 2, PRD 11.4). Server Component: quem interage
 * (assumir, reenviar aviso) é `CartaoTransferencia`.
 */
export function FilaTransferencias({
  fila,
  usuarioId,
  destinoDoPapel,
  telefonePlantao,
}: {
  fila: TransferenciaTela[];
  usuarioId?: string;
  destinoDoPapel?: DestinoHandoff;
  telefonePlantao?: string | null;
}) {
  if (fila.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        titulo="Nenhuma conversa esperando você"
        texto="A Isadora continua a triagem e avisa aqui quando alguém quiser contratar, marcar a conversa ou falar com uma pessoa."
      />
    );
  }

  const agora = new Date();
  return (
    <div className="flex flex-col gap-3">
      {/* h2 fora de tela: liga o h1 da tela ao h3 de cada cartão sem pular
          nível (crítica do CRM, P1 item 19). */}
      <h2 className="sr-only">Fila de transferências</h2>
      {fila.map((transferencia) => (
        <CartaoTransferencia
          key={transferencia.id}
          transferencia={transferencia}
          agora={agora}
          usuarioId={usuarioId}
          destinoDoPapel={destinoDoPapel}
          telefonePlantao={telefonePlantao}
        />
      ))}
    </div>
  );
}
