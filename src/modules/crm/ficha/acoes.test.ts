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
import {
  acaoAcionarFreio,
  acaoDesfazerFreio,
  acaoJustificarFreio,
  acaoMarcarNaoContatar,
  acaoRegistrarDataFato,
  acaoReverterFreio,
  acaoVerDadosContratoCompletos,
  estadoInicialDadosContrato,
  estadoInicialFicha,
} from "./acoes";
import {
  listarFamiliasTela,
  obterFichaTela,
  listarLinhaDoTempoTela,
} from "./dados";

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

async function idDaFamilia(nome: string): Promise<string> {
  const [familia] = await listarFamiliasTela({ busca: nome });
  if (!familia) throw new Error(`família de teste não encontrada: ${nome}`);
  return familia.id;
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

describe("acaoAcionarFreio", () => {
  it("aciona bloqueio_total em um toque, sem motivo, e cria evento restrito", async () => {
    const id = await idDaFamilia("Aurora");
    const formulario = new FormData();
    formulario.set("familiaId", id);

    const resultado = await acaoAcionarFreio(estadoInicialFicha, formulario);
    expect(resultado.erro).toBeUndefined();
    expect(resultado.sucesso).toBeTruthy();

    const ficha = await obterFichaTela(id);
    expect(ficha!.estadoSensivel).toBe("bloqueio_total");
  });

  it("família inexistente devolve erro em português, sem travessão", async () => {
    const formulario = new FormData();
    formulario.set("familiaId", "00000000-0000-4000-8999-000000000000");
    const resultado = await acaoAcionarFreio(estadoInicialFicha, formulario);
    expect(resultado.erro).toBeTruthy();
    expect(resultado.erro).not.toMatch(/[-–—]/);
  });
});

describe("acaoDesfazerFreio", () => {
  it("quem acionou desfaz dentro do prazo e volta ao estado anterior", async () => {
    const id = await idDaFamilia("Aurora");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    await acaoAcionarFreio(estadoInicialFicha, formulario);

    const resultado = await acaoDesfazerFreio(estadoInicialFicha, formulario);
    expect(resultado.sucesso).toBeTruthy();

    const ficha = await obterFichaTela(id);
    expect(ficha!.estadoSensivel).toBe("normal");
  });
});

describe("acaoJustificarFreio", () => {
  it("motivo vazio pede para escrever", async () => {
    const id = await idDaFamilia("Bruma");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("motivo", "  ");
    const resultado = await acaoJustificarFreio(estadoInicialFicha, formulario);
    expect(resultado.erro).toBeTruthy();
  });

  it("com motivo, registra a justificativa", async () => {
    const id = await idDaFamilia("Bruma");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("motivo", "Intercorrência relatada pela família.");
    const resultado = await acaoJustificarFreio(estadoInicialFicha, formulario);
    expect(resultado.sucesso).toBeTruthy();
  });
});

describe("acaoReverterFreio", () => {
  it("comercial sem coordenação ou diretoria não reverte", async () => {
    const id = await idDaFamilia("Bruma");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("estado", "normal");
    formulario.set("justificativa", "Confirmado com a família.");
    const resultado = await acaoReverterFreio(estadoInicialFicha, formulario);
    expect(resultado.erro).toBeTruthy();

    const ficha = await obterFichaTela(id);
    expect(ficha!.estadoSensivel).toBe("bloqueio_total");
  });

  it("coordenação com justificativa reverte para normal", async () => {
    await logarComo("Perfil Teste Coordenacao");
    const id = await idDaFamilia("Bruma");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("estado", "normal");
    formulario.set("justificativa", "Confirmado com a família.");
    const resultado = await acaoReverterFreio(estadoInicialFicha, formulario);
    expect(resultado.sucesso).toBeTruthy();

    const ficha = await obterFichaTela(id);
    expect(ficha!.estadoSensivel).toBe("normal");
  });

  it("sem justificativa, recusa mesmo com o papel certo", async () => {
    await logarComo("Perfil Teste Diretoria");
    const id = await idDaFamilia("Bruma");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("estado", "normal");
    formulario.set("justificativa", "");
    const resultado = await acaoReverterFreio(estadoInicialFicha, formulario);
    expect(resultado.erro).toBeTruthy();
  });
});

describe("acaoMarcarNaoContatar", () => {
  it("marca e a linha do tempo mostra o evento, não restrito", async () => {
    const id = await idDaFamilia("Cedro");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("motivo", "Pediu para não ser mais contatada.");
    const resultado = await acaoMarcarNaoContatar(
      estadoInicialFicha,
      formulario,
    );
    expect(resultado.sucesso).toBeTruthy();

    const eventos = await listarLinhaDoTempoTela(id);
    const evento = eventos.find((e) => e.tipo === "nao_contatar");
    expect(evento).toBeDefined();
    expect(evento!.restrito).toBe(false);
  });
});

describe("acaoRegistrarDataFato", () => {
  it("registra a data de alta", async () => {
    const id = await idDaFamilia("Aurora");
    const formulario = new FormData();
    formulario.set("familiaId", id);
    formulario.set("campo", "data_alta");
    formulario.set("valor", "2027-05-20");
    const resultado = await acaoRegistrarDataFato(
      estadoInicialFicha,
      formulario,
    );
    expect(resultado.sucesso).toBeTruthy();

    const ficha = await obterFichaTela(id);
    expect(ficha!.datas[2]!.valor).toBe("2027-05-20");
  });
});

describe("acaoVerDadosContratoCompletos", () => {
  it("em AAL1, o banco recusa e a tela pede para confirmar o MFA", async () => {
    const id = await idDaFamilia("Dália");
    const ficha = await obterFichaTela(id);
    const contato = ficha!.pessoas[0]!;
    const formulario = new FormData();
    formulario.set("pessoaId", contato.id);
    const resultado = await acaoVerDadosContratoCompletos(
      estadoInicialDadosContrato,
      formulario,
    );
    expect(resultado.erro).toBeTruthy();
    expect(resultado.dados).toBeUndefined();
  });

  it("em AAL2, devolve os dados completos", async () => {
    await logarComo("Perfil Teste Comercial", "aal2");
    const id = await idDaFamilia("Dália");
    const ficha = await obterFichaTela(id);
    const contato = ficha!.pessoas[0]!;
    const formulario = new FormData();
    formulario.set("pessoaId", contato.id);
    const resultado = await acaoVerDadosContratoCompletos(
      estadoInicialDadosContrato,
      formulario,
    );
    expect(resultado.erro).toBeUndefined();
    expect(resultado.dados?.completo).toBe(true);
  });
});
