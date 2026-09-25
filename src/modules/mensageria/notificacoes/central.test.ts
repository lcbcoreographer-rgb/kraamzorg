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
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  registrarNotificacaoDemo,
  reiniciarNotificacoesDemoParaTestes,
} from "./central";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
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

async function logarComo(nome: string | null) {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(nome ? sessaoDe(nome) : null);
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarNotificacoesDemoParaTestes();
  await logarComo("Perfil Teste Comercial");
});

afterEach(() => {
  Object.assign(process.env, ORIGINAL);
});

describe("central de notificação (demonstração)", () => {
  it("sem sessão, devolve lista vazia", async () => {
    await logarComo(null);
    expect(await listarNotificacoes()).toEqual([]);
  });

  it("mostra a notificação da própria pessoa e a do papel, não a de outro papel", async () => {
    const minha = registrarNotificacaoDemo({
      usuarioId: sessaoDe("Perfil Teste Comercial").usuarioId,
      papel: null,
      prioridade: "normal",
      titulo: "Para mim",
      corpo: null,
      link: null,
      canais: ["app"],
    });
    registrarNotificacaoDemo({
      usuarioId: null,
      papel: "comercial",
      prioridade: "normal",
      titulo: "Para o papel comercial",
      corpo: null,
      link: null,
      canais: ["app"],
    });
    registrarNotificacaoDemo({
      usuarioId: null,
      papel: "coordenacao",
      prioridade: "normal",
      titulo: "Para a coordenação",
      corpo: null,
      link: null,
      canais: ["app"],
    });

    const lista = await listarNotificacoes();
    expect(lista.map((n) => n.titulo).sort()).toEqual(["Para mim", "Para o papel comercial"]);
    expect(lista.find((n) => n.id === minha.id)?.lidaEm).toBeNull();
  });

  it("marcarNotificacaoLida grava lidaEm", async () => {
    const notificacao = registrarNotificacaoDemo({
      usuarioId: sessaoDe("Perfil Teste Comercial").usuarioId,
      papel: null,
      prioridade: "normal",
      titulo: "Aviso",
      corpo: null,
      link: null,
      canais: ["app"],
    });
    await marcarNotificacaoLida(notificacao.id);
    const lista = await listarNotificacoes();
    expect(lista.find((n) => n.id === notificacao.id)?.lidaEm).not.toBeNull();
  });
});
