// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { criarRepositoriosDemonstracao } from "@/lib/dados/demonstracao";
import { PARAMETROS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { criarConfiguracoesModuloDemonstracao } from "./demonstracao";
import { reiniciarLojaConfiguracoes } from "./loja";

/**
 * Parâmetros do agente ficam fora do app (PRD 6.8, 13 e 22.4 O-16 [v4.5]).
 * O banco esconde a linha pela RLS (`supabase/tests/029_parametros_agente.sql`);
 * aqui a demonstração tem de se comportar igual, e a lista dela tem de ser a
 * mesma da migration 0029.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaConfiguracoes();
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

const diretoria = () =>
  criarRepositoriosDemonstracao({
    usuarioId: "diretoria-teste",
    papeis: ["diretoria"],
    aal: "aal2",
  });

const modulo = () =>
  criarConfiguracoesModuloDemonstracao({
    usuarioId: "diretoria-teste",
    papeis: ["diretoria"],
  });

/** A regra de `privado.chave_parametro_restrita`, lida da própria migration. */
function regraDaMigration(): { prefixos: string[]; chaves: string[] } {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/0029_parametros_agente.sql"),
    "utf8",
  );
  const funcao = sql.slice(
    sql.indexOf("create function privado.chave_parametro_restrita"),
    sql.indexOf("create function privado.marcar_parametro_restrito"),
  );
  const prefixos = [...funcao.matchAll(/like '([a-z]+)\\_%'/g)].map(
    (m) => `${m[1]}_`,
  );
  const lista = funcao.slice(
    funcao.indexOf("array["),
    funcao.indexOf("]::text[]"),
  );
  const chaves = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  return { prefixos, chaves };
}

describe("parâmetros do agente na demonstração", () => {
  it("o seed da demonstração marca como restritas exatamente as chaves da migration 0029", () => {
    const { prefixos, chaves } = regraDaMigration();
    expect(prefixos).toEqual(["agente_", "agenda_"]);
    expect(chaves.length).toBeGreaterThanOrEqual(15);
    const pelaRegra = (chave: string) =>
      prefixos.some((p) => chave.startsWith(p)) || chaves.includes(chave);
    for (const p of PARAMETROS) {
      expect(
        Boolean(p.restrito),
        `${p.chave}: restrito deve seguir a regra da migration`,
      ).toBe(pelaRegra(p.chave));
    }
    expect(PARAMETROS.some((p) => p.restrito)).toBe(true);
  });

  it("a diretoria não lista nem lê parâmetro do agente", async () => {
    const { configuracoes } = diretoria();
    const lista = await configuracoes.listarParametros();
    const chaves = lista.map((p) => p.chave);
    expect(chaves.length).toBeGreaterThan(0);
    expect(chaves.some((c) => c.startsWith("agente_"))).toBe(false);
    expect(chaves.some((c) => c.startsWith("agenda_"))).toBe(false);
    for (const restrita of [
      "agente_modo",
      "agente_whitelist",
      "validador_listas",
      "plantao_telefones",
      "pdf_apresentacao",
    ]) {
      expect(chaves).not.toContain(restrita);
      expect(await configuracoes.lerParametro(restrita)).toBeNull();
    }
    // o que o app também usa continua na lista
    expect(chaves).toContain("freio_desfazer_segundos");
  });

  it("a loja guarda o parâmetro do agente: o agente simulado ainda o lê", () => {
    const modo = obterLoja().parametros.find((p) => p.chave === "agente_modo");
    expect(modo?.restrito).toBe(true);
    expect(typeof modo?.valor).toBe("string");
  });

  it("a diretoria não altera parâmetro do agente: para o app ele não existe", async () => {
    const antes = obterLoja().parametros.find(
      (p) => p.chave === "agente_modo",
    )!.valor;
    await expect(
      modulo().atualizarParametro("agente_modo", "producao"),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
    expect(
      obterLoja().parametros.find((p) => p.chave === "agente_modo")!.valor,
    ).toBe(antes);
  });

  it("a diretoria não cria chave com prefixo do agente, mas cria chave comum", async () => {
    await expect(
      modulo().criarParametro("agente_novo", true, "teste"),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await expect(
      modulo().criarParametro("agenda_novo", true, "teste"),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
    await modulo().criarParametro("chave_comum_teste", 1, "teste");
    expect(
      (await diretoria().configuracoes.lerParametro("chave_comum_teste"))
        ?.valor,
    ).toBe(1);
  });

  it("o histórico de parâmetro do agente não sai", async () => {
    expect(await modulo().historicoParametro("agente_followup_horas")).toEqual(
      [],
    );
  });
});
