import { Inbox, UserCheck } from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { SinoCalmo } from "@/components/ilustracoes";
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
  agrupar = false,
}: {
  fila: TransferenciaTela[];
  usuarioId?: string;
  destinoDoPapel?: DestinoHandoff;
  telefonePlantao?: string | null;
  /**
   * Tela própria da fila (`/transferencias`): divide em "Esperando alguém"
   * e "Com a equipe", cada uma no seu bloco com título (direção "Colo",
   * DESIGN.md 6.1). No Início, a fila vem inteira dentro da seção de lá.
   */
  agrupar?: boolean;
}) {
  if (fila.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        ilustracao={<SinoCalmo tamanho={104} />}
        titulo="Nenhuma conversa esperando você"
        texto="A Isadora continua a triagem e avisa aqui quando alguém quiser contratar, marcar a conversa ou falar com uma pessoa."
      />
    );
  }

  const agora = new Date();
  if (agrupar) {
    const esperando = fila.filter((t) => t.status !== "assumido");
    const comEquipe = fila.filter((t) => t.status === "assumido");
    const cartoes = (lista: TransferenciaTela[]) =>
      lista.map((transferencia) => (
        <CartaoTransferencia
          key={transferencia.id}
          transferencia={transferencia}
          agora={agora}
          usuarioId={usuarioId}
          destinoDoPapel={destinoDoPapel}
          telefonePlantao={telefonePlantao}
        />
      ));
    return (
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[62fr_38fr]">
        <SecaoBloco
          idTitulo="t-esperando"
          titulo="Esperando alguém"
          icone={<Inbox />}
          tom="argila"
          contagem={esperando.length}
          apoio="Prioridade máxima primeiro, depois o prazo que vence antes."
        >
          {esperando.length === 0 ? (
            <EstadoVazio
              nivelTitulo="h3"
              ilustracao={<SinoCalmo tamanho={96} />}
              titulo="Ninguém esperando agora"
              texto="Quando a Isadora passar uma conversa para a equipe, ela aparece aqui com o prazo."
            />
          ) : (
            <div className="flex flex-col gap-3">{cartoes(esperando)}</div>
          )}
        </SecaoBloco>
        {comEquipe.length > 0 ? (
          <SecaoBloco
            idTitulo="t-com-equipe"
            titulo="Com a equipe"
            icone={<UserCheck />}
            tom="salvia"
            contagem={comEquipe.length}
            apoio="Já assumidas por alguém da equipe."
          >
            <div className="flex flex-col gap-3">{cartoes(comEquipe)}</div>
          </SecaoBloco>
        ) : null}
      </div>
    );
  }
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
