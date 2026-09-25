import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { estadoPrazo, pausaVenceuComTransferenciaAberta } from "../formatacao";
import {
  estadoAgentePorConversa,
  notificacaoOkDemonstracao,
} from "../repositorio";
import { ROTULO_MOTIVO_HANDOFF } from "../tipos";
import type { TransferenciaTela } from "../tipos";

/**
 * Telefone do plantão (`parametro.plantao_telefones`, PRD 6.8), para
 * "Ligar para a coordenação" quando a transferência não é do papel de
 * quem vê (crítica do CRM, P0 item 4). A RLS de `parametro` só deixa a
 * diretoria ler fora da demonstração (ADR 0002); para os demais papéis
 * a função devolve null e o cartão não mostra o link `tel:`.
 */
export async function obterTelefonePlantao(): Promise<string | null> {
  try {
    const { configuracoes } = await obterRepositorios();
    const parametro = await configuracoes.lerParametro("plantao_telefones");
    const valor = parametro?.valor;
    if (Array.isArray(valor) && typeof valor[0] === "string") {
      return valor[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fila de transferências por prioridade e prazo (P27 item 2, PRD 11.4;
 * protótipo `comercial-inicio.html`, seção "Transferências da Isadora"). A
 * ordenação já vem de `AgenteRepositorio.listarTransferencias` (prioridade,
 * depois prazo); esta função só junta o rótulo do motivo e, na
 * demonstração, o estado do aviso ao grupo que a base não guarda por
 * transferência (loja-extra.ts).
 */
export async function listarFilaTela(
  agora: Date = new Date(),
): Promise<TransferenciaTela[]> {
  const { agente } = await obterRepositorios();
  const transferencias = await agente.listarTransferencias({
    status: ["aberto", "assumido"],
  });

  const idsConversa = [
    ...new Set(
      transferencias
        .map((t) => t.conversaId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const estados = await estadoAgentePorConversa(idsConversa);

  return transferencias.map((t) => {
    const estado = t.conversaId ? estados[t.conversaId] : undefined;
    return {
      ...t,
      motivoRotulo: ROTULO_MOTIVO_HANDOFF[t.motivo],
      notificacaoOk:
        modoDados() === "demonstracao"
          ? (notificacaoOkDemonstracao(t.id) ?? t.notificacaoOk)
          : t.notificacaoOk,
      pausaVenceu: estado
        ? pausaVenceuComTransferenciaAberta(estado, true, agora)
        : false,
    };
  });
}

/**
 * Quantas transferências pedem atenção agora: prazo vencido ou prioridade
 * máxima (crítica do CRM, P0 item 1). Vira o contador em alerta da aba
 * Início do comercial (`abas-inferiores.tsx`, `barra-lateral.tsx`); um
 * número maior não é mais chamativo por si, então a casca só precisa
 * saber se há alguma.
 */
export async function contarTransferenciasCriticas(
  agora: Date = new Date(),
): Promise<number> {
  const fila = await listarFilaTela(agora);
  return fila.filter(
    (t) =>
      t.status !== "assumido" &&
      (t.prioridade === "maxima" ||
        estadoPrazo(t.criadoEm, t.slaVenceEm, agora) === "vencido"),
  ).length;
}
