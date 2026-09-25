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

/**
 * O repositório de demonstração da fundação ainda devolve `payload: {}`
 * (pendência registrada). Este dublê embrulha o repositório de verdade e só
 * acrescenta o payload das tarefas que o teste semear, como o P20 gravaria.
 */
const payloads = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("@/lib/dados/fabrica", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dados/fabrica")>();
  return {
    ...real,
    obterRepositorios: async () => {
      const repositorios = await real.obterRepositorios();
      return {
        ...repositorios,
        tarefas: {
          ...repositorios.tarefas,
          listarTarefas: async (
            filtro?: Parameters<typeof repositorios.tarefas.listarTarefas>[0],
          ) =>
            (await repositorios.tarefas.listarTarefas(filtro)).map((t) => ({
              ...t,
              payload: (payloads.get(t.id) ?? t.payload) as typeof t.payload,
            })),
        },
      };
    },
  };
});

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { TAREFAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { familiaPorNome } from "@/lib/dados/demonstracao/fixtures";
import { concluirTarefaSemMensagem, enviarTarefa } from "./acoes";
import { estadoInicialTarefa } from "./estado-acoes";

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
  payloads.clear();
  await logarComo("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function formularioEnvio(campos: Record<string, string>) {
  const formulario = new FormData();
  for (const [chave, valor] of Object.entries(campos))
    formulario.set(chave, valor);
  return formulario;
}

describe("enviarTarefa (Enviei, PRD 23.2)", () => {
  /** Tarefa de régua aberta para o papel comercial, com o payload que o P20 grava. */
  function semearTarefaRegua(
    id: string,
    nomeFamilia: string,
    payload: Record<string, unknown> = {},
  ) {
    obterLoja().tarefas.push({
      id,
      tipo: "nutricao_contato",
      titulo: `Régua da Família Teste ${nomeFamilia}`,
      prioridade: "normal",
      status: "aberta",
      venceEm: null,
      familiaId: familiaPorNome(nomeFamilia).id,
      responsavelId: null,
      papelResponsavel: "comercial",
      payload: {},
      criadoEm: new Date().toISOString(),
    });
    payloads.set(id, {
      textoSugerido: "Oi! Como está a gestação?",
      telefoneE164: "+5511900000001",
      mensagemChave: "regua_ate_20",
      ...payload,
    });
  }

  it("com o freio liberado, grava a mensagem como humano, conclui a tarefa e confirma", async () => {
    semearTarefaRegua("regua-cedro", "Cedro"); // normal, tem conversa no seed
    const loja = obterLoja();
    const antes = loja.mensagens.length;

    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({
        tarefaId: "regua-cedro",
        texto: "Oi, Beatriz! Como você está?",
      }),
    );

    expect(resultado.erro).toBeUndefined();
    expect(resultado.sucesso).toBeTruthy();
    expect(loja.mensagens.length).toBe(antes + 1);
    const nova = loja.mensagens.at(-1)!;
    expect(nova.enviadoPor).toBe("humano");
    expect(nova.direcao).toBe("saida");
    expect(nova.conteudo).toBe("Oi, Beatriz! Como você está?");
    expect(loja.tarefas.find((t) => t.id === "regua-cedro")?.status).toBe(
      "concluida",
    );
  });

  it("família em bloqueio_total: recusa, não grava mensagem nem conclui a tarefa", async () => {
    semearTarefaRegua("regua-bruma", "Bruma"); // bloqueio_total
    const loja = obterLoja();
    const antes = loja.mensagens.length;

    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: "regua-bruma", texto: "Oi!" }),
    );

    expect(resultado.sucesso).toBeUndefined();
    expect(resultado.erro).toMatch(/bloqueio total/);
    expect(loja.mensagens.length).toBe(antes);
    expect(loja.tarefas.find((t) => t.id === "regua-bruma")?.status).toBe(
      "aberta",
    );
  });

  it("família e telefone do formulário são ignorados: vale o que está na tarefa", async () => {
    semearTarefaRegua("regua-bruma", "Bruma");
    const cedro = familiaPorNome("Cedro");

    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({
        tarefaId: "regua-bruma",
        familiaId: cedro.id, // tentativa de trocar a família para escapar do freio
        telefoneE164: "+5511999998888",
        texto: "Oi!",
      }),
    );

    expect(resultado.sucesso).toBeUndefined();
    expect(
      obterLoja().tarefas.find((t) => t.id === "regua-bruma")?.status,
    ).toBe("aberta");
  });

  it("categoria operacional passa em atenção; conteúdo não (PRD 8.2)", async () => {
    semearTarefaRegua("conteudo-estrela", "Estrela"); // atencao, sem categoria: conteudo
    semearTarefaRegua("operacional-estrela", "Estrela", {
      categoria: "operacional",
    });

    const conteudo = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: "conteudo-estrela", texto: "Oi!" }),
    );
    expect(conteudo.erro).toMatch(/atenção/);

    const operacional = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: "operacional-estrela", texto: "Oi!" }),
    );
    expect(operacional.erro).toBeUndefined();
  });

  it("tarefa sem mensagem (interna) não passa pelo Enviei", async () => {
    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: TAREFAS[1]!.id, texto: "Oi!" }),
    );
    expect(resultado.erro).toMatch(/Concluir/);
    expect(
      obterLoja().tarefas.find((t) => t.id === TAREFAS[1]!.id)?.status,
    ).toBe("aberta");
  });

  it("tarefa de outra pessoa ou de outro papel não é encontrada", async () => {
    semearTarefaRegua("regua-cedro", "Cedro");
    await logarComo("Perfil Teste Coordenacao");
    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: "regua-cedro", texto: "Oi!" }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(
      obterLoja().tarefas.find((t) => t.id === "regua-cedro")?.status,
    ).toBe("aberta");
  });

  it("texto vazio é recusado sem chamar o mensageiro", async () => {
    semearTarefaRegua("regua-cedro", "Cedro");
    const resultado = await enviarTarefa(
      estadoInicialTarefa,
      formularioEnvio({ tarefaId: "regua-cedro", texto: "   " }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(
      obterLoja().tarefas.find((t) => t.id === "regua-cedro")?.status,
    ).toBe("aberta");
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
    expect(loja.tarefas.find((t) => t.id === TAREFAS[0]!.id)?.status).toBe(
      "concluida",
    );
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
