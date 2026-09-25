// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado no modo demonstração");
  },
  headers: async () => new Headers(),
}));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { codigoSensivel, criarVerificadorFreio } from "./verificador-freio";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
    exigirSessao: async () => {
      if (!sessaoAtual) throw new Error("sem sessão no teste");
      return sessaoAtual;
    },
    __definirSessao: (s: SessaoUsuario | null) => {
      sessaoAtual = s;
    },
  };
});

function sessaoDe(nome: string): SessaoUsuario {
  const usuario = USUARIOS.find((u) => u.nome === nome);
  if (!usuario) throw new Error(nome);
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
  };
}

async function logarComo(nome: string) {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe(nome));
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  await logarComo("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

async function idFamilia(nome: string): Promise<string> {
  const { familiaPorNome } = await import("@/lib/dados/demonstracao/fixtures");
  return familiaPorNome(nome).id;
}

describe("criarVerificadorFreio (aproximação de demonstração, PRD 8.2)", () => {
  it("categoria interna nunca fala com a família (igual a 0009: categoria_interna)", async () => {
    const verificar = criarVerificadorFreio();
    const familiaId = await idFamilia("Cedro");
    const resultado = await verificar({ familiaId, categoria: "interna" });
    expect(resultado.pode).toBe(false);
    expect(resultado.codigo).toBe("categoria_interna");
  });

  it("sem familiaId (fora de 'interna'), recusa", async () => {
    const verificar = criarVerificadorFreio();
    const resultado = await verificar({ categoria: "conteudo" });
    expect(resultado.pode).toBe(false);
  });

  it("família em bloqueio_total (Bruma) recusa conteúdo, mesmo o operacional", async () => {
    const verificar = criarVerificadorFreio();
    const familiaId = await idFamilia("Bruma");
    expect((await verificar({ familiaId, categoria: "conteudo" })).pode).toBe(
      false,
    );
    expect(
      (await verificar({ familiaId, categoria: "operacional" })).pode,
    ).toBe(false);
  });

  it("bloqueio_total devolve frase de gente e código de freio (tom ameixa), nunca o código na frase", async () => {
    const verificar = criarVerificadorFreio();
    const familiaId = await idFamilia("Bruma");
    const resultado = await verificar({ familiaId, categoria: "conteudo" });
    expect(resultado.codigo).toBe("freio_bloqueio_total");
    expect(codigoSensivel(resultado.codigo)).toBe(true);
    expect(resultado.motivo).not.toMatch(/_/);
  });

  it("família normal (Cedro) deixa passar conteúdo", async () => {
    const verificar = criarVerificadorFreio();
    const familiaId = await idFamilia("Cedro");
    const resultado = await verificar({ familiaId, categoria: "conteudo" });
    expect(resultado.pode).toBe(true);
  });

  it("família inexistente recusa com motivo claro", async () => {
    const verificar = criarVerificadorFreio();
    const resultado = await verificar({
      familiaId: "00000000-0000-0000-0000-000000000000",
      categoria: "conteudo",
    });
    expect(resultado.pode).toBe(false);
    expect(resultado.motivo).toMatch(/não encontrei/i);
  });
});
