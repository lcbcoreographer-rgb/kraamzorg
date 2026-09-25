import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encerrarSessaoOffline,
  limparCacheDoDia,
  obterFamiliasDoDia,
  obterRegrasAlerta,
  salvarFamiliasDoDia,
  salvarRegrasAlerta,
  VALIDADE_CACHE_MS,
} from "./cache";
import { criarBancoOffline, type BancoOffline } from "./db";
import { salvarCampo } from "./motor";
import type { FamiliaDoDia, RegraAlertaCacheada } from "./tipos";

let contador = 0;
function novoBanco(): BancoOffline {
  contador += 1;
  return criarBancoOffline(`teste-cache-${contador}-${Date.now()}`);
}

const FAMILIA: FamiliaDoDia = {
  familiaId: "familia-1",
  visitaId: "visita-1",
  nomeExibicao: "Família Teste Aurora",
};

const REGRA: RegraAlertaCacheada = {
  id: "regra-1",
  instrumentoVersao: "doc3-v1",
  codigo: "PU-01",
};

describe("cache do dia (PRD 15: válido por 24 horas)", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("devolve null sem nada em cache", async () => {
    expect(await obterFamiliasDoDia(db)).toBeNull();
    expect(await obterRegrasAlerta(db)).toBeNull();
  });

  it("devolve o que foi salvo, dentro da validade", async () => {
    const agora = Date.now();
    await salvarFamiliasDoDia(db, [FAMILIA], agora);
    await salvarRegrasAlerta(db, [REGRA], agora);

    expect(await obterFamiliasDoDia(db, agora + 1_000)).toEqual([FAMILIA]);
    expect(await obterRegrasAlerta(db, agora + 1_000)).toEqual([REGRA]);
  });

  it("expira depois de 24 horas", async () => {
    const agora = Date.now();
    await salvarFamiliasDoDia(db, [FAMILIA], agora);

    expect(await obterFamiliasDoDia(db, agora + VALIDADE_CACHE_MS - 1)).toEqual(
      [FAMILIA],
    );
    expect(await obterFamiliasDoDia(db, agora + VALIDADE_CACHE_MS)).toBeNull();
  });

  it("limparCacheDoDia apaga famílias, regras e a marca de tempo, mas nunca a fila", async () => {
    await salvarFamiliasDoDia(db, [FAMILIA]);
    await salvarRegrasAlerta(db, [REGRA]);
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });

    await limparCacheDoDia(db);

    expect(await obterFamiliasDoDia(db)).toBeNull();
    expect(await obterRegrasAlerta(db)).toBeNull();
    expect(await db.fila.count()).toBe(1);
    expect(await db.rascunhos.count()).toBe(1);
  });
});

describe("encerrarSessaoOffline (logout e sessão revogada)", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("sobe o que estiver na fila antes de apagar o cache", async () => {
    await salvarFamiliasDoDia(db, [FAMILIA]);
    const ordem: string[] = [];
    const esvaziarFila = vi.fn(async () => {
      ordem.push("subiu-fila");
    });

    await encerrarSessaoOffline(db, esvaziarFila);

    expect(esvaziarFila).toHaveBeenCalledTimes(1);
    expect(ordem).toEqual(["subiu-fila"]);
    expect(await obterFamiliasDoDia(db)).toBeNull();
  });

  it("apaga o cache mesmo quando não há sinal para subir a fila (sessão revogada)", async () => {
    await salvarFamiliasDoDia(db, [FAMILIA]);
    const esvaziarFila = vi.fn(async () => {
      throw new Error("sem sinal");
    });

    await expect(
      encerrarSessaoOffline(db, esvaziarFila),
    ).resolves.toBeUndefined();
    expect(await obterFamiliasDoDia(db)).toBeNull();
  });

  it("nunca apaga itens da fila que ainda não sincronizaram", async () => {
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });

    await encerrarSessaoOffline(db, async () => {
      // Simula: sem sinal, o item continua "rascunho_local" na fila.
    });

    expect(await db.fila.count()).toBe(1);
  });

  it("apaga do aparelho o que já subiu e os rascunhos dele, mas mantém o pendente", async () => {
    const sincronizado = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "a",
      valor: "já subiu",
    });
    const emConflito = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v2",
      campo: "b",
      valor: "conflito guardado no servidor",
    });
    const pendente = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v3",
      campo: "c",
      valor: "ainda não subiu",
    });
    await db.fila.update(sincronizado.id, { estado: "sincronizado" });
    await db.fila.update(emConflito.id, { estado: "conflito" });

    await encerrarSessaoOffline(db, async () => {
      // Sem sinal: nada sobe nesta passada.
    });

    expect((await db.fila.toArray()).map((i) => i.id)).toEqual([pendente.id]);
    expect((await db.rascunhos.toArray()).map((r) => r.itemFilaId)).toEqual([
      pendente.id,
    ]);
  });
});
