// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLojaExtra, obterLojaExtra } from "./loja-extra";
import {
  acaoAprovarItemBaseConhecimento,
  acaoSalvarItemBaseConhecimento,
} from "./admin-acoes";

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
  reiniciarLojaExtra();
  await logarComo("Perfil Teste Diretoria");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor);
  return f;
}

describe("parâmetros do agente fora do app (PRD 6.8 e 13 [v4.5])", () => {
  it("o app não tem mais ação para salvar modo, lista de teste nem janela de retomada", async () => {
    const acoes = await import("./admin-acoes");
    expect(Object.keys(acoes).sort()).toEqual([
      "acaoAprovarItemBaseConhecimento",
      "acaoSalvarItemBaseConhecimento",
    ]);
  });

  it("a demonstração não guarda modo nem lista de teste do agente no módulo", () => {
    const l = obterLojaExtra() as unknown as Record<string, unknown>;
    expect(l).not.toHaveProperty("modo");
    expect(l).not.toHaveProperty("numerosTeste");
    expect(l).not.toHaveProperty("followupHoras");
  });
});

describe("base de conhecimento (P27 item 4, PRD 6.8, 13)", () => {
  it("comercial cadastra um item, que nasce em rascunho", async () => {
    await logarComo("Perfil Teste Comercial");
    const antes = obterLojaExtra().baseConhecimento.length;
    const resultado = await acaoSalvarItemBaseConhecimento(
      {},
      formulario({
        tipo: "faq",
        titulo: "Atende fora de SP?",
        texto: "Hoje só São Paulo e Londrina.",
      }),
    );
    expect(resultado.sucesso).toBeTruthy();
    const l = obterLojaExtra();
    expect(l.baseConhecimento.length).toBe(antes + 1);
    expect(l.baseConhecimento[0]?.status).toBe("rascunho");
  });

  it("só a diretoria aprova", async () => {
    const item = obterLojaExtra().baseConhecimento.find(
      (i) => i.status === "rascunho",
    )!;
    await logarComo("Perfil Teste Comercial");
    const recusado = await acaoAprovarItemBaseConhecimento(
      {},
      formulario({ id: item.id }),
    );
    expect(recusado.erro).toBeTruthy();
    expect(
      obterLojaExtra().baseConhecimento.find((i) => i.id === item.id)?.status,
    ).not.toBe("aprovado");

    await logarComo("Perfil Teste Diretoria");
    const aprovado = await acaoAprovarItemBaseConhecimento(
      {},
      formulario({ id: item.id }),
    );
    expect(aprovado.sucesso).toBeTruthy();
    const aprovadoItem = obterLojaExtra().baseConhecimento.find(
      (i) => i.id === item.id,
    );
    expect(aprovadoItem?.status).toBe("aprovado");
    expect(aprovadoItem?.aprovadoPor).toBe("Perfil Teste Diretoria");
  });

  it("texto acima de 1500 caracteres é recusado", async () => {
    const resultado = await acaoSalvarItemBaseConhecimento(
      {},
      formulario({ tipo: "faq", titulo: "x", texto: "a".repeat(1501) }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});
