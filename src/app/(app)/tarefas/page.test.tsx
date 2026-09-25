// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado no modo demonstração");
  },
  headers: async () => new Headers(),
}));

import { render, screen } from "@testing-library/react";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
    exigirSessao: async (_caminho?: string) => {
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

describe("PaginaTarefas", () => {
  it("lista as tarefas do comercial logado, agrupadas por vencimento", async () => {
    const { default: PaginaTarefas } = await import("./page");
    render(await PaginaTarefas());

    expect(
      screen.getByRole("heading", { name: "Tarefas" }),
    ).toBeInTheDocument();
    // Tarefas do seed atribuídas ao papel comercial ou à pessoa comercial.
    expect(
      screen.getByText("Retomar a conversa com a Família Teste Cedro"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Conferir o formulário do contrato da Família Teste Horizonte",
      ),
    ).toBeInTheDocument();
    // Tarefa da coordenação não aparece para o comercial.
    expect(
      screen.queryByText("Agendar a consulta pré-natal da Família Teste Íris"),
    ).not.toBeInTheDocument();
  });

  it("sem sessão, exigirSessao interrompe a renderização", async () => {
    const modulo = (await import("@/lib/auth/sessao")) as unknown as {
      __definirSessao: (s: SessaoUsuario | null) => void;
    };
    modulo.__definirSessao(null);
    const { default: PaginaTarefas } = await import("./page");
    await expect(PaginaTarefas()).rejects.toThrow();
  });
});
