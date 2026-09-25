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

class RedirecionouParaTeste extends Error {
  constructor(public para: string) {
    super(`redirect:${para}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (para: string) => {
    throw new RedirecionouParaTeste(para);
  },
}));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { FAMILIAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { criarLeadManual } from "../pipeline/dados";
import { reiniciarMesclagemDemoParaTestes } from "./mesclagem";
import { acaoMesclar, acaoVincularNovaGestacao } from "./acoes";
import { estadoInicialMesclagem } from "./estado-acoes";

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

const auroraId = () => FAMILIAS.find((f) => f.nome.endsWith("Aurora"))!.id;

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

describe("acaoMesclar", () => {
  it("mescla e redireciona para a lista de duplicatas com o aviso de sucesso", async () => {
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Duplicada",
      nomeContato: "Marina Duplicada",
      papelContato: "mae",
      telefoneE164: "11900000301",
      origem: "outro",
    });

    const formulario = new FormData();
    formulario.set("familiaFicaId", auroraId());
    formulario.set("familiaPerdeId", nova.familiaId);

    await expect(
      acaoMesclar(estadoInicialMesclagem, formulario),
    ).rejects.toMatchObject({
      para: "/pipeline/duplicatas?mesclada=1",
    });
  });

  it("par inválido (não é uuid) devolve erro sem redirecionar", async () => {
    const formulario = new FormData();
    formulario.set("familiaFicaId", "não é um id");
    formulario.set("familiaPerdeId", auroraId());
    const resultado = await acaoMesclar(estadoInicialMesclagem, formulario);
    expect(resultado.erro).toBeTruthy();
  });
});

describe("acaoVincularNovaGestacao", () => {
  it("vincula e redireciona com o aviso de sucesso", async () => {
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Gestação Nova",
      nomeContato: "Marina",
      papelContato: "mae",
      telefoneE164: "11900000301",
      dpp: "2028-06-01",
      origem: "outro",
    });

    const formulario = new FormData();
    formulario.set("familiaRecenteId", nova.familiaId);
    formulario.set("familiaAnteriorId", auroraId());

    await expect(
      acaoVincularNovaGestacao(estadoInicialMesclagem, formulario),
    ).rejects.toMatchObject({ para: "/pipeline/duplicatas?vinculada=1" });
  });

  it("recusa vincular uma família com ela mesma, sem chamar o repositório", async () => {
    const formulario = new FormData();
    formulario.set("familiaRecenteId", auroraId());
    formulario.set("familiaAnteriorId", auroraId());

    const resultado = await acaoVincularNovaGestacao(
      estadoInicialMesclagem,
      formulario,
    );
    expect(resultado.erro).toMatch(/mesma/);
  });

  it("exige comercial ou diretoria, como privado.vincular_nova_gestacao (PRD 13)", async () => {
    const nova = await criarLeadManual({
      nomeFamilia: "Família Teste Aurora Gestação Nova",
      nomeContato: "Marina",
      papelContato: "mae",
      telefoneE164: "11900000301",
      dpp: "2028-06-01",
      origem: "outro",
    });
    await logarComo("Perfil Teste Coordenacao", "aal2");

    const formulario = new FormData();
    formulario.set("familiaRecenteId", nova.familiaId);
    formulario.set("familiaAnteriorId", auroraId());

    const resultado = await acaoVincularNovaGestacao(
      estadoInicialMesclagem,
      formulario,
    );
    expect(resultado.erro).toBeTruthy();
  });
});
