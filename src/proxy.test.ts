// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  codificarCookieDemonstracao,
  COOKIE_DEMONSTRACAO,
} from "@/lib/auth/demonstracao-cookie";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { config, proxy } from "./proxy";

/**
 * O proxy de ponta a ponta, no modo demonstração (sem Supabase nesta
 * máquina): lê o cookie, aplica decidirAcesso e redireciona.
 */
const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  APP: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeAll(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
});

afterAll(() => {
  if (ORIGINAL.KZ_DADOS === undefined) delete process.env.KZ_DADOS;
  else process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  if (ORIGINAL.APP === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
  else process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.APP;
});

beforeEach(() => {
  reiniciarLoja();
});

function requisicao(
  caminho: string,
  usuario?: string,
  aal: "aal1" | "aal2" = "aal1",
  em = Date.now(),
) {
  const pedido = new NextRequest(new URL(caminho, "http://127.0.0.1:3000"));
  if (usuario) {
    const id = USUARIOS.find((u) => u.nome === usuario)!.id;
    pedido.cookies.set(
      COOKIE_DEMONSTRACAO,
      codificarCookieDemonstracao({ u: id, aal, em }),
    );
  }
  return pedido;
}

function destino(resposta: Response): string | null {
  const local = resposta.headers.get("location");
  return local ? new URL(local).pathname + new URL(local).search : null;
}

describe("proxy (src/proxy.ts)", () => {
  it("sem sessão, manda para /entrar com o caminho pedido", async () => {
    const resposta = await proxy(requisicao("/pipeline"));
    expect(resposta.status).toBe(307);
    expect(destino(resposta)).toBe("/entrar?proximo=%2Fpipeline");
  });

  it("deixa abrir /entrar sem sessão", async () => {
    const resposta = await proxy(requisicao("/entrar"));
    expect(destino(resposta)).toBeNull();
  });

  it("comercial em AAL1 entra no pipeline", async () => {
    const resposta = await proxy(
      requisicao("/pipeline", "Perfil Teste Comercial"),
    );
    expect(destino(resposta)).toBeNull();
  });

  it("diretoria em AAL1 vai para o desafio do MFA", async () => {
    const resposta = await proxy(
      requisicao("/sessoes", "Perfil Teste Diretoria"),
    );
    expect(destino(resposta)).toBe("/mfa/desafio?proximo=%2Fsessoes");
  });

  it("diretoria em AAL2 abre a tela de sessões", async () => {
    const resposta = await proxy(
      requisicao("/sessoes", "Perfil Teste Diretoria", "aal2"),
    );
    expect(destino(resposta)).toBeNull();
  });

  it("enfermeira em AAL2 que abre o pipeline volta para Hoje", async () => {
    const resposta = await proxy(
      requisicao("/pipeline", "Perfil Teste Enfermeira", "aal2"),
    );
    expect(destino(resposta)).toBe("/hoje");
  });

  it("sessão revogada pela diretoria deixa de valer", async () => {
    const antes = Date.now() - 1000;
    const comercial = USUARIOS.find(
      (u) => u.nome === "Perfil Teste Comercial",
    )!;
    obterLoja().sessoesRevogadasEm[comercial.id] = Date.now();
    const resposta = await proxy(
      requisicao("/inicio", "Perfil Teste Comercial", "aal1", antes),
    );
    expect(destino(resposta)).toBe("/entrar?proximo=%2Finicio");
  });

  it("o matcher deixa de fora estáticos, marca e rotas de API", () => {
    const [padrao] = config.matcher;
    const regex = new RegExp(`^${padrao}$`);
    expect(regex.test("/pipeline")).toBe(true);
    expect(regex.test("/_next/static/chunk.js")).toBe(false);
    expect(regex.test("/brand/logo-provisorio.png")).toBe(false);
    expect(regex.test("/api/webhook")).toBe(false);
    expect(regex.test("/favicon.ico")).toBe(false);
    // Extensão no fim não tira a rota do proxy (rota dinâmica /familias/[id]).
    expect(regex.test("/familias/x.png")).toBe(true);
    expect(regex.test("/financeiro.svg")).toBe(true);
    expect(regex.test("/favicon.ico/x")).toBe(true);
  });

  it("rota dinâmica com extensão no fim também passa pela regra", async () => {
    const resposta = await proxy(
      requisicao("/familias/x.png", "Perfil Teste Enfermeira", "aal2"),
    );
    expect(destino(resposta)).toBe("/hoje");
  });
});
