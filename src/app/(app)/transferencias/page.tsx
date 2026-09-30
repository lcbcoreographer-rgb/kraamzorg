import { redirect } from "next/navigation";

/**
 * A fila de transferências mora dentro das conversas desde 30/09 (pedido
 * do dono: "as transferências têm que funcionar em conjunto com as
 * conversas"): é o filtro "Esperando alguém" da lista, e a transferência
 * aberta aparece no topo da conversa. Esta rota continua existindo para
 * links antigos, avisos e favoritos, e leva direto para lá. Dono: P27.
 */
export default function PaginaTransferencias(): never {
  redirect("/conversas?filtro=esperando");
}
