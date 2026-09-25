// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error(
      "cookies() não deveria ser chamado neste teste (modo demonstração)",
    );
  },
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { listarPipelineTela } from "./dados";
import { acaoCriarLead, acaoMarcarPerdido, acaoTransicionar } from "./acoes";
import { estadoInicialPipeline } from "./estado-acoes";

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

function sessaoDe(nome: string, aal: "aal1" | "aal2" = "aal2"): SessaoUsuario {
  const usuario = USUARIOS.find((u) => u.nome === nome);
  if (!usuario) throw new Error(nome);
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal,
    aalPossivel: "aal2",
  };
}

async function logarComo(nome: string, aal: "aal1" | "aal2" = "aal2") {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe(nome, aal));
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  await logarComo("Perfil Teste Comercial", "aal1");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("acaoTransicionar", () => {
  it("move a oportunidade e revalida a tela", async () => {
    const [aurora] = await listarPipelineTela({ pipeline: 1, busca: "Aurora" });
    const formulario = new FormData();
    formulario.set("oportunidadeId", aurora!.oportunidadeId);
    formulario.set("pipeline", "1");
    formulario.set("para", "em_conversa_ia");

    const resultado = await acaoTransicionar(estadoInicialPipeline, formulario);
    expect(resultado.erro).toBeUndefined();
    expect(resultado.sucesso).toBeTruthy();

    const [depois] = await listarPipelineTela({ pipeline: 1, busca: "Aurora" });
    expect(depois?.estagioP1).toBe("em_conversa_ia");
  });

  it("campo faltando devolve erro em português, sem mexer em nada", async () => {
    const formulario = new FormData();
    formulario.set("pipeline", "1");
    const resultado = await acaoTransicionar(estadoInicialPipeline, formulario);
    expect(resultado.erro).toBeTruthy();
    expect(resultado.erro).not.toMatch(/[-–—]/); // sem travessão nem meia-risca
  });
});

describe("acaoMarcarPerdido", () => {
  it("sem motivo, pede para escolher um (o motivo alimenta o relatório de perdas)", async () => {
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    const formulario = new FormData();
    formulario.set("oportunidadeId", cedro!.oportunidadeId);
    formulario.set("pipeline", "1");
    const resultado = await acaoMarcarPerdido(
      estadoInicialPipeline,
      formulario,
    );
    expect(resultado.erro).toBe(
      "Escolha um motivo. Ele alimenta o relatório de perdas.",
    );
  });

  it("com motivo, marca como perdida", async () => {
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    const formulario = new FormData();
    formulario.set("oportunidadeId", cedro!.oportunidadeId);
    formulario.set("pipeline", "1");
    formulario.set("motivo", "preco");
    formulario.set("detalhe", "Achou caro.");
    const resultado = await acaoMarcarPerdido(
      estadoInicialPipeline,
      formulario,
    );
    expect(resultado.sucesso).toBeTruthy();

    const [depois] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    expect(depois?.estagioP1).toBe("perdido");
    expect(depois?.motivoPerda).toBe("preco");
  });
});

describe("acaoCriarLead", () => {
  function formularioValido() {
    const formulario = new FormData();
    formulario.set("nomeFamilia", "Família Teste Ação de Cadastro");
    formulario.set("nomeContato", "Juliana");
    formulario.set("papelContato", "mae");
    formulario.set("telefoneE164", "11955554444");
    formulario.set("origem", "site");
    return formulario;
  }

  it("cadastra e a família aparece no pipeline", async () => {
    const resultado = await acaoCriarLead(
      estadoInicialPipeline,
      formularioValido(),
    );
    expect(resultado.sucesso).toBeTruthy();
    const cartoes = await listarPipelineTela({
      pipeline: 1,
      busca: "Ação de Cadastro",
    });
    expect(cartoes).toHaveLength(1);
  });

  it("nome muito curto devolve erro sem cadastrar nada", async () => {
    const formulario = formularioValido();
    formulario.set("nomeFamilia", "A");
    const resultado = await acaoCriarLead(estadoInicialPipeline, formulario);
    expect(resultado.erro).toBeTruthy();
    const cartoes = await listarPipelineTela({ pipeline: 1 });
    expect(cartoes.some((c) => c.nomeFamilia === "A")).toBe(false);
  });

  it("papel diferente de comercial ou diretoria não cadastra", async () => {
    await logarComo("Perfil Teste Coordenacao");
    const resultado = await acaoCriarLead(
      estadoInicialPipeline,
      formularioValido(),
    );
    expect(resultado.erro).toBeTruthy();
  });
});
