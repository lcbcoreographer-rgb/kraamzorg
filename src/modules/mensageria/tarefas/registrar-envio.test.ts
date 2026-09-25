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
import { TAREFAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { ErroRepositorio } from "@/lib/dados/erros";
import { registrarEnvioTarefa } from "./registrar-envio";

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

describe("registrarEnvioTarefa (demonstração)", () => {
  it("com conversa existente para a família, grava a mensagem como enviado_por humano", async () => {
    const { familiaPorNome } =
      await import("@/lib/dados/demonstracao/fixtures");
    const aurora = familiaPorNome("Aurora"); // tem conversa em CONVERSAS (id 9,1)
    const loja = obterLoja();
    const antes = loja.mensagens.length;

    await registrarEnvioTarefa({
      tarefaId: TAREFAS[1]!.id,
      familiaId: aurora.id,
      textoEnviado: "Oi, tudo bem?",
    });

    expect(loja.mensagens.length).toBe(antes + 1);
    const nova = loja.mensagens.at(-1)!;
    expect(nova.enviadoPor).toBe("humano");
    expect(nova.direcao).toBe("saida");
    expect(nova.conteudo).toBe("Oi, tudo bem?");

    const tarefa = loja.tarefas.find((t) => t.id === TAREFAS[1]!.id);
    expect(tarefa?.status).toBe("concluida");
  });

  it("sem conversa para a família, não grava mensagem mas ainda conclui a tarefa", async () => {
    const loja = obterLoja();
    const antes = loja.mensagens.length;
    // Família sem entrada em CONVERSAS.
    const familiaSemConversa = loja.familias.find(
      (f) => !loja.conversas.some((c) => c.familiaId === f.id),
    );
    if (!familiaSemConversa)
      throw new Error("fixture precisa de uma família sem conversa");

    await registrarEnvioTarefa({
      tarefaId: TAREFAS[1]!.id,
      familiaId: familiaSemConversa.id,
      textoEnviado: "Oi!",
    });

    expect(loja.mensagens.length).toBe(antes);
    const tarefa = loja.tarefas.find((t) => t.id === TAREFAS[1]!.id);
    expect(tarefa?.status).toBe("concluida");
  });

  it("tarefa de outra pessoa: concluirTarefa recusa (ErroRepositorio sem_permissao)", async () => {
    await logarComo("Perfil Teste Coordenacao");
    await expect(
      registrarEnvioTarefa({
        tarefaId: TAREFAS[0]!.id, // responsável é o comercial
        familiaId: null,
        textoEnviado: "Oi!",
      }),
    ).rejects.toBeInstanceOf(ErroRepositorio);
  });
});
