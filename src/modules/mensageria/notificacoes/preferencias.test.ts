// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  obterPreferenciasRepositorio,
  reiniciarPreferenciasDemoParaTestes,
} from "./preferencias";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

afterEach(() => {
  Object.assign(process.env, ORIGINAL);
});

describe("preferências de notificação, demonstração", () => {
  beforeEach(() => {
    process.env.KZ_DADOS = "demonstracao";
    process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
    reiniciarPreferenciasDemoParaTestes();
  });

  it("sem preferência gravada, devolve o padrão com tudo ligado", async () => {
    const repo = obterPreferenciasRepositorio();
    expect(await repo.obter("usuario-1")).toEqual({
      usuarioId: "usuario-1",
      push: true,
      whatsappInterno: true,
      email: true,
    });
  });

  it("grava e lê de volta o que foi salvo", async () => {
    const repo = obterPreferenciasRepositorio();
    await repo.salvar({
      usuarioId: "usuario-1",
      push: false,
      whatsappInterno: true,
      email: false,
    });
    expect(await repo.obter("usuario-1")).toEqual({
      usuarioId: "usuario-1",
      push: false,
      whatsappInterno: true,
      email: false,
    });
  });
});

describe("preferências de notificação, Supabase (sem tabela ainda)", () => {
  beforeEach(() => {
    process.env.KZ_DADOS = "";
    process.env.NEXT_PUBLIC_APP_ENV = "producao";
  });

  it("obter sempre devolve o padrão", async () => {
    const repo = obterPreferenciasRepositorio();
    expect(await repo.obter("usuario-1")).toEqual({
      usuarioId: "usuario-1",
      push: true,
      whatsappInterno: true,
      email: true,
    });
  });

  it("salvar recusa com funcao_pendente", async () => {
    const repo = obterPreferenciasRepositorio();
    await expect(
      repo.salvar({ usuarioId: "usuario-1", push: false, whatsappInterno: false, email: false }),
    ).rejects.toMatchObject({ codigo: "funcao_pendente" });
  });
});
