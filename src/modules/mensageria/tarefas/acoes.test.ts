// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado no modo demonstração");
  },
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { TAREFAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { concluirTarefaSemMensagem, enviarTarefa, estadoInicialTarefa } from "./acoes";

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

function formularioEnvio(campos: Record<string, string>) {
  const formulario = new FormData();
  for (const [chave, valor] of Object.entries(campos)) formulario.set(chave, valor);
  return formulario;
}

describe("enviarTarefa (Enviei, PRD 23.2)", () => {
  it("com o freio liberado, grava a mensagem, conclui a tarefa e some da lista", async () => {
    const { familiaPorNome } = await import("@/lib/dados/demonstracao/fixtures");
    const cedro = familiaPorNome("Cedro"); // normal, tem conversa no seed
    const loja = obterLoja();
    const antes = loja.mensagens.length;

    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({
        tarefaId: TAREFAS[1]!.id, // responsável: papel comercial
        familiaId: cedro.id,
        telefoneE164: "+5511999998888",
        texto: "Oi, Beatriz! Como você está?",
      }),
    );

    expect(resultado.erro).toBeUndefined();
    expect(resultado.sucesso).toBeTruthy();
    expect(loja.mensagens.length).toBe(antes + 1);
    expect(loja.tarefas.find((t) => t.id === TAREFAS[1]!.id)?.status).toBe("concluida");
  });

  it("família em bloqueio_total: recusa, não grava mensagem nem conclui a tarefa", async () => {
    const { familiaPorNome } = await import("@/lib/dados/demonstracao/fixtures");
    const bruma = familiaPorNome("Bruma"); // bloqueio_total
    const loja = obterLoja();
    const antes = loja.mensagens.length;

    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({
        tarefaId: TAREFAS[1]!.id,
        familiaId: bruma.id,
        telefoneE164: "+5511999998888",
        texto: "Oi!",
      }),
    );

    expect(resultado.sucesso).toBeUndefined();
    expect(resultado.erro).toBeTruthy();
    expect(loja.mensagens.length).toBe(antes);
    expect(loja.tarefas.find((t) => t.id === TAREFAS[1]!.id)?.status).toBe("aberta");
  });

  it("texto vazio é recusado sem chamar o mensageiro", async () => {
    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({
        tarefaId: TAREFAS[1]!.id,
        familiaId: "qualquer",
        telefoneE164: "+5511999998888",
        texto: "   ",
      }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});

describe("concluirTarefaSemMensagem", () => {
  it("conclui uma tarefa interna (sem WhatsApp), como a de justificar o freio", async () => {
    const loja = obterLoja();
    const resultado = await concluirTarefaSemMensagem(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: TAREFAS[0]!.id }),
    );
    expect(resultado.sucesso).toBeTruthy();
    expect(loja.tarefas.find((t) => t.id === TAREFAS[0]!.id)?.status).toBe("concluida");
  });

  it("tarefa de outra pessoa é recusada", async () => {
    await logarComo("Perfil Teste Coordenacao");
    const resultado = await concluirTarefaSemMensagem(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: TAREFAS[0]!.id }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});
