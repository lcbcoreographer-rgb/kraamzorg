import {
  ESTADOS_PENDENTES,
  enfileirarRegistroAssistencial,
  salvarCampo,
} from "@/lib/sync/motor";
import { salvarRegrasAlerta } from "@/lib/sync/cache";
import type { BancoOffline } from "@/lib/sync/db";
import type { EstadoItemFila, ItemFila } from "@/lib/sync/tipos";
import type {
  PedidoNovoAlerta,
  RegistroParaEnvio,
} from "@/lib/dados/tipos-assistencial";
import type { LinhaRegraAlerta } from "@/lib/regras-alerta";

/**
 * Ponte entre o checklist e a fila do motor offline (P12, invariante 4):
 * o registro assinado sobe inteiro e na ordem de criação, com o id gerado
 * no aparelho; o alerta avaliado no campo sobe assim que existe, sem
 * esperar a assinatura (a coordenação precisa saber na hora); o adendo
 * pedido de propósito sobe depois do registro.
 */

export async function enfileirarRegistroAssinado(
  db: BancoOffline,
  usuarioId: string,
  registro: RegistroParaEnvio,
): Promise<ItemFila> {
  return enfileirarRegistroAssistencial(db, {
    usuarioId,
    visitaId: registro.visitaId,
    registro,
  });
}

/** Adendo com motivo (P39 item 3): a correção que o registro assinado aceita. */
export async function enfileirarAdendo(
  db: BancoOffline,
  usuarioId: string,
  visitaId: string,
  motivo: string,
  conteudo: string,
): Promise<ItemFila> {
  return enfileirarRegistroAssistencial(db, {
    usuarioId,
    visitaId,
    registro: { adendo: { motivo: motivo.trim(), conteudo: conteudo.trim() } },
  });
}

/**
 * Alerta clínico avaliado no aparelho (PRD 9.3): entra na fila na hora,
 * como criação de `alerta_clinico`. O servidor reavalia o registro inteiro
 * quando ele chega e não duplica (uma linha por regra, visita e bebê).
 */
export async function enfileirarNovoAlerta(
  db: BancoOffline,
  usuarioId: string,
  pedido: PedidoNovoAlerta,
): Promise<ItemFila> {
  return salvarCampo(db, {
    usuarioId,
    entidade: "alerta_clinico",
    entidadeId: null,
    campo: `novo:${pedido.regraId}:${pedido.bebeId ?? "-"}`,
    valor: pedido,
  });
}

/** Guarda as regras de alerta no aparelho: o motor avalia sem sinal (PRD 15). */
export async function guardarRegrasNoAparelho(
  db: BancoOffline,
  regras: LinhaRegraAlerta[],
): Promise<void> {
  await salvarRegrasAlerta(
    db,
    regras.map((r) => ({
      ...r,
      instrumentoVersao: r.instrumento_versao,
    })),
  );
}

/** Estado, no aparelho, do último item de fila do registro desta visita. */
export async function estadoDoRegistroNaFila(
  db: BancoOffline,
  visitaId: string,
): Promise<EstadoItemFila | null> {
  const itens = await db.fila
    .where("[entidade+entidadeId]")
    .equals(["registro_atendimento", visitaId])
    .toArray();
  const registros = itens
    .filter((i) => !("adendo" in ((i.payload as object | null) ?? {})))
    .sort((a, b) => a.criadoNoClienteEm.localeCompare(b.criadoNoClienteEm));
  return registros.at(-1)?.estado ?? null;
}

/** Quantos itens desta visita ainda não subiram (registro, alertas e adendos). */
export async function pendentesDaVisita(
  db: BancoOffline,
  visitaId: string,
): Promise<number> {
  const pendentes = await db.fila
    .where("estado")
    .anyOf(ESTADOS_PENDENTES)
    .toArray();
  return pendentes.filter((i) => {
    if (i.entidadeId === visitaId) return true;
    const p = i.payload as { visitaId?: string } | null;
    return p?.visitaId === visitaId;
  }).length;
}
