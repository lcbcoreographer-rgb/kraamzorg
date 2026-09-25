import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { TransferenciaTela } from "../../tipos";
import { CartaoTransferencia } from "./cartao-transferencia";

/**
 * Fila de transferências, já ordenada por prioridade e prazo pelo
 * repositório (P27 item 2, PRD 11.4). Server Component: quem interage
 * (assumir, reenviar aviso) é `CartaoTransferencia`.
 */
export function FilaTransferencias({ fila }: { fila: TransferenciaTela[] }) {
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
    <div className="flex flex-col gap-3" aria-live="polite">
      {fila.map((transferencia) => (
        <CartaoTransferencia key={transferencia.id} transferencia={transferencia} agora={agora} />
      ))}
    </div>
  );
}
