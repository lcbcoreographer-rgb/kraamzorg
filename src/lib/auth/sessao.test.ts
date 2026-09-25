// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * exigirSessao é a segunda barreira, depois do proxy: vale para Server
 * Components e para Server Actions, que chegam por POST sem passar pela
 * tela. Roda no modo demonstração, com o cookie fictício.
 */
let cookieAtual: string | undefined;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "kz_demo_sessao" && cookieAtual
        ? { name: nome, value: cookieAtual }
        : undefined,
    set: () => undefined,
    getAll: () => [],
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { codificarCookieDemonstracao } from "./demonstracao-cookie";
import { exigirSessao } from "./sessao";

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
  cookieAtual = undefined;
});

function entrarComo(nome: string, aal: "aal1" | "aal2") {
  const id = USUARIOS.find((u) => u.nome === nome)!.id;
  cookieAtual = codificarCookieDemonstracao({ u: id, aal, em: Date.now() });
}

describe("exigirSessao", () => {
  it("sem sessão, manda para /entrar", async () => {
    await expect(exigirSessao()).rejects.toThrow(
      "REDIRECT:/entrar?aviso=sessao-encerrada",
    );
  });

  it("papel com MFA em AAL1 não passa, mesmo sem saber a rota (layout)", async () => {
    entrarComo("Perfil Teste Diretoria", "aal1");
    await expect(exigirSessao()).rejects.toThrow("REDIRECT:/mfa/");
  });

  it("comercial em AAL1 passa no layout", async () => {
    entrarComo("Perfil Teste Comercial", "aal1");
    await expect(exigirSessao()).resolves.toMatchObject({ aal: "aal1" });
  });

  it("com a rota, aplica o papel: só a diretoria abre sessões e convite", async () => {
    entrarComo("Perfil Teste Coordenacao", "aal2");
    await expect(exigirSessao("/sessoes")).rejects.toThrow("REDIRECT:/inicio");
    await expect(exigirSessao("/convidar")).rejects.toThrow("REDIRECT:/inicio");

    entrarComo("Perfil Teste Diretoria", "aal2");
    await expect(exigirSessao("/sessoes")).resolves.toMatchObject({
      aal: "aal2",
    });
  });

  it("diretoria em AAL1 não chega à ação de convite nem à de sessões", async () => {
    entrarComo("Perfil Teste Diretoria", "aal1");
    await expect(exigirSessao("/convidar")).rejects.toThrow("REDIRECT:/mfa/");
    await expect(exigirSessao("/sessoes")).rejects.toThrow("REDIRECT:/mfa/");
  });
});
