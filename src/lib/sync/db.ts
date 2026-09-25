import Dexie, { type Table } from "dexie";
import type {
  FamiliaDoDia,
  ItemFila,
  RascunhoCampo,
  RegraAlertaCacheada,
} from "./tipos";

/** Uma linha de `familiasDoDia` precisa de chave primária própria no Dexie. */
type LinhaFamiliaDoDia = FamiliaDoDia & { chave: string };

interface LinhaCacheMeta {
  /** "familiasDoDia" | "regrasAlerta" */
  chave: string;
  buscadoEm: number;
}

/**
 * Banco local do motor offline (P12, invariante 4; D-03; PRD 15). Cinco
 * tabelas:
 * - `rascunhos`: valor mais recente digitado por campo, o que a tela lê.
 * - `fila`: fila de sincronização (espelha `fila_sincronizacao`, PRD 6.7).
 * - `familiasDoDia` e `regrasAlerta`: cache do dia (`api.familias_do_dia`
 *   e `regra_alerta`), válido por 24 horas (cache.ts controla a validade).
 * - `cacheMeta`: quando cada cache acima foi buscado, para a validade de
 *   24 horas e para apagar no logout (cache.ts).
 *
 * Um nome de banco por instância (`nome`) deixa os testes isolados uns dos
 * outros sob fake-indexeddb; o app real sempre usa o nome padrão.
 */
export class BancoOffline extends Dexie {
  rascunhos!: Table<RascunhoCampo, string>;
  fila!: Table<ItemFila, string>;
  familiasDoDia!: Table<LinhaFamiliaDoDia, string>;
  regrasAlerta!: Table<RegraAlertaCacheada, string>;
  cacheMeta!: Table<LinhaCacheMeta, string>;

  constructor(nome = "kraamzorg-offline") {
    super(nome);
    this.version(1).stores({
      rascunhos: "chave, entidade, entidadeId, itemFilaId",
      fila: "id, estado, proximoEnvioEm, criadoNoClienteEm, [entidade+entidadeId]",
      familiasDoDia: "chave, familiaId, visitaId",
      regrasAlerta: "id, instrumentoVersao",
      cacheMeta: "chave",
    });
  }
}

/**
 * Cria (ou reabre) o banco local. Só roda no navegador: Dexie precisa de
 * `indexedDB`, que não existe no servidor (Next renderiza esta árvore só em
 * componentes de cliente) e é suprido por `fake-indexeddb/auto` nos testes.
 */
export function criarBancoOffline(nome?: string): BancoOffline {
  return new BancoOffline(nome);
}

let instanciaPadrao: BancoOffline | null = null;

/** Instância única do banco padrão, para o app real (não para testes). */
export function bancoOffline(): BancoOffline {
  if (!instanciaPadrao) {
    instanciaPadrao = criarBancoOffline();
  }
  return instanciaPadrao;
}
