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

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { criarLeadManual } from "../pipeline/dados";
import { reiniciarMesclagemDemoParaTestes } from "./mesclagem";
import { listarDuplicatas } from "./deteccao";

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
  reiniciarMesclagemDemoParaTestes();
  await logarComo("Perfil Teste Comercial", "aal1");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("listarDuplicatas (modo demonstração, P17 item 1)", () => {
  it("sem duplicata nenhuma, o seed fictício não tem telefone repetido", async () => {
    const resultado = await listarDuplicatas();
    expect(resultado.indisponivelNoBanco).toBe(false);
    expect(resultado.certas).toEqual([]);
  });

  it("mesmo telefone e DPP próxima vira duplicata certa", async () => {
    // Telefone da Família Teste Aurora (+5511900000301), DPP a poucos dias
    // da DPP dela (2027-05-03): duplicata certa, não vínculo de nova gestação.
    await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Duplicada",
      nomeContato: "Marina",
      papelContato: "mae",
      telefoneE164: "11900000301",
      dpp: "2027-05-05",
      origem: "outro",
    });

    const resultado = await listarDuplicatas();
    expect(resultado.certas).toHaveLength(1);
    const nomes = [resultado.certas[0]!.a.nome, resultado.certas[0]!.b.nome];
    expect(nomes).toContain("Família Teste Aurora");
    expect(nomes).toContain("Família Teste Aurora Duplicada");
    expect(resultado.certas[0]!.telefone).toContain("900000301");
  });

  it("mesmo telefone com DPP muito distante sugere vínculo de nova gestação, não mesclagem (PRD 6.10 regra 12)", async () => {
    await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Gestação Nova",
      nomeContato: "Marina",
      papelContato: "mae",
      telefoneE164: "11900000301",
      dpp: "2028-06-01", // bem mais de 180 dias depois da DPP da Aurora original
      origem: "outro",
    });

    const resultado = await listarDuplicatas();
    expect(resultado.certas).toEqual([]);
    expect(resultado.novasGestacoes).toHaveLength(1);
  });

  it("nome parecido com DPP a até 14 dias vira duplicata provável", async () => {
    // Telefone diferente do da Dália de propósito, só o nome e a DPP batem.
    await criarLeadManual({
      nomeFamilia: "Familia Teste Dalia",
      nomeContato: "Fernanda",
      papelContato: "mae",
      telefoneE164: "11977776666",
      dpp: "2027-01-20", // Dália original: 2027-01-23, 3 dias de diferença
      origem: "outro",
    });

    const resultado = await listarDuplicatas();
    expect(resultado.certas).toEqual([]);
    expect(resultado.provaveis.length).toBeGreaterThanOrEqual(1);
    const par = resultado.provaveis.find(
      (p) => p.a.nome.includes("Dália") || p.b.nome.includes("Dália"),
    );
    expect(par).toBeTruthy();
    expect(par!.diasEntreDpp).toBe(3);
  });
});
