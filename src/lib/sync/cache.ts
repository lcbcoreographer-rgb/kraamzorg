import type { BancoOffline } from "./db";
import type { FamiliaDoDia, RegraAlertaCacheada } from "./tipos";

/** Validade do cache do dia (PRD 15): "Esse cache expira em 24 horas". */
export const VALIDADE_CACHE_MS = 24 * 60 * 60 * 1000;

type ChaveCache = "familiasDoDia" | "regrasAlerta";

async function cacheValido(
  db: BancoOffline,
  chave: ChaveCache,
  agora: number,
): Promise<boolean> {
  const meta = await db.cacheMeta.get(chave);
  if (!meta) return false;
  return agora - meta.buscadoEm < VALIDADE_CACHE_MS;
}

/** Grava as famílias do dia (linhas de `api.familias_do_dia`) e marca a hora da busca. */
export async function salvarFamiliasDoDia(
  db: BancoOffline,
  familias: readonly FamiliaDoDia[],
  agora: number = Date.now(),
): Promise<void> {
  await db.transaction("rw", db.familiasDoDia, db.cacheMeta, async () => {
    await db.familiasDoDia.clear();
    await db.familiasDoDia.bulkPut(
      familias.map((f) => ({ ...f, chave: f.visitaId })),
    );
    await db.cacheMeta.put({ chave: "familiasDoDia", buscadoEm: agora });
  });
}

/** Famílias do dia em cache, ou `null` se não há cache ou se passou de 24 horas. */
export async function obterFamiliasDoDia(
  db: BancoOffline,
  agora: number = Date.now(),
): Promise<FamiliaDoDia[] | null> {
  if (!(await cacheValido(db, "familiasDoDia", agora))) return null;
  const linhas = await db.familiasDoDia.toArray();
  return linhas.map((linha) => {
    const familia: Record<string, unknown> = { ...linha };
    delete familia.chave;
    return familia as unknown as FamiliaDoDia;
  });
}

/** Grava as regras de alerta (`regra_alerta`) e marca a hora da busca. */
export async function salvarRegrasAlerta(
  db: BancoOffline,
  regras: readonly RegraAlertaCacheada[],
  agora: number = Date.now(),
): Promise<void> {
  await db.transaction("rw", db.regrasAlerta, db.cacheMeta, async () => {
    await db.regrasAlerta.clear();
    await db.regrasAlerta.bulkPut([...regras]);
    await db.cacheMeta.put({ chave: "regrasAlerta", buscadoEm: agora });
  });
}

/** Regras de alerta em cache, ou `null` se não há cache ou se passou de 24 horas. */
export async function obterRegrasAlerta(
  db: BancoOffline,
  agora: number = Date.now(),
): Promise<RegraAlertaCacheada[] | null> {
  if (!(await cacheValido(db, "regrasAlerta", agora))) return null;
  return db.regrasAlerta.toArray();
}

/**
 * Apaga o cache do dia (famílias e regras de alerta), nunca a fila nem os
 * rascunhos: dado ainda não sincronizado não se perde por causa de logout
 * (PRD 15: "apagado no logout e quando a sessão foi revogada").
 */
export async function limparCacheDoDia(db: BancoOffline): Promise<void> {
  await db.transaction(
    "rw",
    db.familiasDoDia,
    db.regrasAlerta,
    db.cacheMeta,
    async () => {
      await db.familiasDoDia.clear();
      await db.regrasAlerta.clear();
      await db.cacheMeta.clear();
    },
  );
}

/**
 * Apaga do aparelho o que já subiu: itens de fila sincronizados ou em
 * conflito (o servidor guarda o conflito com os dois lados) e os rascunhos
 * que não apontam mais para um item pendente. Fica só a fila que ainda não
 * subiu e os rascunhos dela (PRD 15: "limpa o IndexedDB, menos a fila que
 * ainda não subiu"). Sem isto, o valor clínico digitado continuaria no
 * aparelho depois do logout.
 */
export async function limparDadosJaEnviados(db: BancoOffline): Promise<void> {
  await db.transaction("rw", db.fila, db.rascunhos, async () => {
    await db.fila.where("estado").anyOf(["sincronizado", "conflito"]).delete();
    const idsPendentes = new Set(
      (await db.fila.toCollection().primaryKeys()).map(String),
    );
    await db.rascunhos
      .filter((rascunho) => !idsPendentes.has(rascunho.itemFilaId))
      .delete();
  });
}

/**
 * Fim de sessão (logout ou sessão revogada, PRD 15): tenta subir o que
 * estiver na fila (melhor esforço, sem bloquear o logout se não houver
 * sinal) e só então apaga o cache do dia e o que já subiu. `esvaziarFila`
 * normalmente é `motor.processarFila`; fica injetado aqui para não criar um
 * ciclo entre os dois módulos.
 */
export async function encerrarSessaoOffline(
  db: BancoOffline,
  esvaziarFila: () => Promise<unknown>,
): Promise<void> {
  try {
    await esvaziarFila();
  } catch {
    // Sem sinal ou sessão já revogada no servidor: segue e limpa mesmo
    // assim. O que não subiu continua na fila (não é apagado aqui) e sobe
    // na próxima sessão com sinal.
  }
  await limparDadosJaEnviados(db);
  await limparCacheDoDia(db);
}
