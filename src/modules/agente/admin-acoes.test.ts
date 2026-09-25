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
  acaoSalvarModoAgente,
  acaoSalvarRegraRetomada,
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

describe("acaoSalvarModoAgente (P27 item 3, PRD 11.3, 11.7)", () => {
  it("diretoria salva o modo e a lista de números de teste", async () => {
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({
        modo: "producao",
        numerosTeste: "+5511900000001\n+5511900000002",
      }),
    );
    expect(resultado.sucesso).toBeTruthy();
    const l = obterLojaExtra();
    expect(l.modo).toBe("producao");
    expect(l.numerosTeste).toEqual(["+5511900000001", "+5511900000002"]);
  });

  it("comercial não altera o modo (só a diretoria, RLS de parametro)", async () => {
    await logarComo("Perfil Teste Comercial");
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({ modo: "desligado", numerosTeste: "" }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(obterLojaExtra().modo).not.toBe("desligado");
  });

  it("modo inválido é recusado pela validação", async () => {
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({ modo: "qualquer-coisa", numerosTeste: "" }),
    );
    expect(resultado.erro).toBeTruthy();
  });
  it("número fora do E.164 é recusado, citando qual, sem gravar nada", async () => {
    const antes = [...obterLojaExtra().numerosTeste];
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({
        modo: "teste",
        numerosTeste: "+5511900000001\n11 9000-0002",
      }),
    );
    expect(resultado.erro).toContain("1190000002");
    expect(obterLojaExtra().numerosTeste).toEqual(antes);
  });

  it("aceita número com espaço ou traço e grava normalizado, sem repetir", async () => {
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({
        modo: "teste",
        numerosTeste: "+55 11 90000-0001\n+5511900000001",
      }),
    );
    expect(resultado.sucesso).toBeTruthy();
    expect(obterLojaExtra().numerosTeste).toEqual(["+5511900000001"]);
  });

  it("modo teste com a lista vazia é recusado (a Isadora não responderia a ninguém)", async () => {
    const resultado = await acaoSalvarModoAgente(
      {},
      formulario({ modo: "teste", numerosTeste: "" }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});

describe("acaoSalvarRegraRetomada (telas.md C6)", () => {
  it("diretoria salva a janela de retomada", async () => {
    const resultado = await acaoSalvarRegraRetomada(
      {},
      formulario({ horas: "72" }),
    );
    expect(resultado.sucesso).toBeTruthy();
    expect(obterLojaExtra().followupHoras).toBe(72);
  });

  it("horas abaixo do mínimo (24) é recusado", async () => {
    const resultado = await acaoSalvarRegraRetomada(
      {},
      formulario({ horas: "12" }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(obterLojaExtra().followupHoras).not.toBe(12);
  });

  it("coordenação não altera (só diretoria)", async () => {
    await logarComo("Perfil Teste Coordenacao");
    const resultado = await acaoSalvarRegraRetomada(
      {},
      formulario({ horas: "36" }),
    );
    expect(resultado.erro).toBeTruthy();
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
