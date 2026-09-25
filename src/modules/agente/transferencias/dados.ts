import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { notificacaoOkDemonstracao } from "../repositorio";
import { ROTULO_MOTIVO_HANDOFF } from "../tipos";
import type { TransferenciaTela } from "../tipos";

/**
 * Fila de transferências por prioridade e prazo (P27 item 2, PRD 11.4;
 * protótipo `comercial-inicio.html`, seção "Transferências da Isadora"). A
 * ordenação já vem de `AgenteRepositorio.listarTransferencias` (prioridade,
 * depois prazo); esta função só junta o rótulo do motivo e, na
 * demonstração, o estado do aviso ao grupo que a base não guarda por
 * transferência (loja-extra.ts).
 */
export async function listarFilaTela(): Promise<TransferenciaTela[]> {
  const { agente } = await obterRepositorios();
  const transferencias = await agente.listarTransferencias({
    status: ["aberto", "assumido"],
  });

  return transferencias.map((t) => ({
    ...t,
    motivoRotulo: ROTULO_MOTIVO_HANDOFF[t.motivo],
    notificacaoOk:
      modoDados() === "demonstracao"
        ? (notificacaoOkDemonstracao(t.id) ?? t.notificacaoOk)
        : t.notificacaoOk,
  }));
}
