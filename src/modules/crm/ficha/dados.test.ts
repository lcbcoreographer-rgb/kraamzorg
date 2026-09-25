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
import { ErroRepositorio } from "@/lib/dados/erros";
import {
  desmarcarNaoContatar,
  listarFamiliasTela,
  listarLinhaDoTempoTela,
  marcarNaoContatar,
  obterFichaTela,
  obterFreioDesfazerSegundos,
  paraFichaTela,
  prazoDesfazerSegundos,
  registrarDataFato,
  temJustificativaPendente,
} from "./dados";
import { ROTULO_ESTADO_SENSIVEL, tituloEvento } from "./rotulos";

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

async function deslogar() {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(null);
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

describe("obterFichaTela", () => {
  it("devolve a ficha com as quatro datas e as pessoas da família", async () => {
    const id = await idDaFamilia("Dália");
    const ficha = await obterFichaTela(id);
    expect(ficha).not.toBeNull();
    expect(ficha!.nome).toBe("Família Teste Dália");
    expect(ficha!.datas.map((d) => d.rotulo)).toEqual([
      "DPP",
      "Nascimento",
      "Alta",
      "Início",
    ]);
    expect(ficha!.datas[0]!.tipo).toBe("estimativa");
    expect(ficha!.datas[1]!.tipo).toBe("fato");
    expect(ficha!.pessoas.length).toBeGreaterThan(0);
  });

  it("família inexistente devolve null (a tela chama notFound)", async () => {
    const ficha = await obterFichaTela("00000000-0000-4000-8999-000000000000");
    expect(ficha).toBeNull();
  });

  it("estágio vem com rótulo pronto, não o código do banco", async () => {
    const id = await idDaFamilia("Dália");
    const ficha = await obterFichaTela(id);
    expect(ficha!.estagioRotulo).not.toMatch(/_/);
  });
});

describe("listarLinhaDoTempoTela", () => {
  it("comercial não vê o evento restrito da família com freio", async () => {
    const id = await idDaFamilia("Bruma");
    const eventos = await listarLinhaDoTempoTela(id);
    expect(eventos.some((e) => e.restrito)).toBe(false);
  });

  it("coordenação vê o evento restrito", async () => {
    await logarComo("Perfil Teste Coordenacao");
    const id = await idDaFamilia("Bruma");
    const eventos = await listarLinhaDoTempoTela(id);
    expect(eventos.some((e) => e.restrito)).toBe(true);
  });
});

describe("marcarNaoContatar / desmarcarNaoContatar", () => {
  it("marca com motivo e aparece na ficha e na linha do tempo", async () => {
    const id = await idDaFamilia("Aurora");
    await marcarNaoContatar(id, "Pediu para não ser mais contatada.");
    const ficha = await obterFichaTela(id);
    expect(ficha!.naoContatar).toBe(true);
    const eventos = await listarLinhaDoTempoTela(id);
    expect(eventos.some((e) => e.tipo === "nao_contatar")).toBe(true);
  });

  it("sem motivo, recusa e não marca nada", async () => {
    const id = await idDaFamilia("Aurora");
    await expect(marcarNaoContatar(id, "  ")).rejects.toBeInstanceOf(
      ErroRepositorio,
    );
    const ficha = await obterFichaTela(id);
    expect(ficha!.naoContatar).toBe(false);
  });

  it("papel sem acesso (enfermeira) não pode marcar", async () => {
    const id = await idDaFamilia("Aurora");
    await logarComo("Perfil Teste Enfermeira");
    await expect(
      marcarNaoContatar(id, "Motivo qualquer"),
    ).rejects.toBeInstanceOf(ErroRepositorio);
  });

  it("desmarcar volta a permitir contato", async () => {
    const id = await idDaFamilia("Aurora");
    await marcarNaoContatar(id, "Motivo qualquer");
    await desmarcarNaoContatar(id);
    const ficha = await obterFichaTela(id);
    expect(ficha!.naoContatar).toBe(false);
  });
});

describe("registrarDataFato", () => {
  it("registra o nascimento como fato", async () => {
    const id = await idDaFamilia("Aurora");
    await registrarDataFato(id, "data_nascimento", "2026-09-10");
    const ficha = await obterFichaTela(id);
    expect(ficha!.datas[1]!.valor).toBe("2026-09-10");
    expect(ficha!.datas[1]!.tipo).toBe("fato");
  });

  it("data no futuro é recusada: fato só existe quando acontece", async () => {
    const id = await idDaFamilia("Aurora");
    await expect(
      registrarDataFato(id, "data_nascimento", "2999-01-01"),
    ).rejects.toBeInstanceOf(ErroRepositorio);
    const ficha = await obterFichaTela(id);
    expect(ficha!.datas[1]!.valor).toBeNull();
  });

  it("data que não existe no calendário é recusada", async () => {
    const id = await idDaFamilia("Aurora");
    await expect(
      registrarDataFato(id, "data_alta", "2026-02-31"),
    ).rejects.toBeInstanceOf(ErroRepositorio);
  });

  it("data fora do formato é recusada", async () => {
    const id = await idDaFamilia("Aurora");
    await expect(
      registrarDataFato(id, "data_alta", "10/05/2027"),
    ).rejects.toBeInstanceOf(ErroRepositorio);
  });
});

describe("temJustificativaPendente", () => {
  it("quem acionou sem motivo tem a tarefa; outra pessoa não", async () => {
    const id = await idDaFamilia("Aurora");
    expect((await temJustificativaPendente(id)).pendente).toBe(false);
    const { obterRepositorios } = await import("@/lib/dados/fabrica");
    const { ficha } = await obterRepositorios();
    await ficha.acionarFreio(id, "bloqueio_total");
    expect((await temJustificativaPendente(id)).pendente).toBe(true);

    await logarComo("Perfil Teste Coordenacao");
    expect((await temJustificativaPendente(id)).pendente).toBe(false);
  });

  it("some depois da justificativa", async () => {
    const id = await idDaFamilia("Aurora");
    const { obterRepositorios } = await import("@/lib/dados/fabrica");
    const { ficha } = await obterRepositorios();
    await ficha.acionarFreio(id, "bloqueio_total");
    await ficha.justificarFreio(id, "Relato de intercorrência.");
    expect((await temJustificativaPendente(id)).pendente).toBe(false);
  });
});

describe("tituloEvento", () => {
  it("título gravado como código pelo banco vira frase, sem seta nem código", () => {
    expect(
      tituloEvento({
        tipo: "freio",
        titulo: "normal → bloqueio_total",
        dados: { acao: "acionar", de: "normal", para: "bloqueio_total" },
      }),
    ).toBe("Freio acionado: bloqueio total");
    expect(
      tituloEvento({
        tipo: "freio",
        titulo: "bloqueio_total → normal",
        dados: { acao: "reverter", de: "bloqueio_total", para: "normal" },
      }),
    ).toBe("Freio ajustado para normal");
    expect(
      tituloEvento({
        tipo: "freio",
        titulo: "justificativa",
        dados: { acao: "justificar" },
      }),
    ).toBe("Freio justificado");
    expect(
      tituloEvento({
        tipo: "estagio",
        titulo: "qualificado → sessao_venda_agendada",
        dados: {
          maquina: "p1",
          de: "qualificado",
          para: "sessao_venda_agendada",
        },
      }),
    ).not.toMatch(/_|→/);
    expect(
      tituloEvento({
        tipo: "nova_gestacao",
        titulo: "vinculo_nova_gestacao",
        dados: {},
      }),
    ).toBe("Vínculo com a gestação anterior");
  });

  it("título que já é frase aparece como veio; tipo desconhecido não quebra", () => {
    expect(
      tituloEvento({
        tipo: "marco",
        titulo: "Apresentação enviada",
        dados: {},
      }),
    ).toBe("Apresentação enviada");
    expect(tituloEvento({ tipo: "tipo_novo", titulo: "", dados: null })).toBe(
      "Evento",
    );
  });
});

describe("prazoDesfazerSegundos", () => {
  it("usa o desfazer_ate que o banco devolve no acionamento", async () => {
    const agora = Date.parse("2026-09-24T12:00:00Z");
    expect(
      await prazoDesfazerSegundos(
        { ok: true, desfazer_ate: "2026-09-24T12:00:10Z" },
        agora,
      ),
    ).toBe(10);
    expect(
      await prazoDesfazerSegundos(
        { ok: true, desfazer_ate: "2026-09-24T11:59:00Z" },
        agora,
      ),
    ).toBe(0);
  });

  it("sem desfazer_ate na resposta, não há Desfazer (nunca um prazo fixo)", async () => {
    expect(await prazoDesfazerSegundos({ ok: true })).toBe(0);
  });
});

describe("obterFreioDesfazerSegundos", () => {
  it("lê o parâmetro (nunca um número fixo no código)", async () => {
    const segundos = await obterFreioDesfazerSegundos();
    expect(segundos).toBeGreaterThanOrEqual(0);
  });
});

describe("paraFichaTela e rótulos", () => {
  it("todo estado sensível tem rótulo em português", () => {
    for (const rotulo of Object.values(ROTULO_ESTADO_SENSIVEL)) {
      expect(rotulo).not.toMatch(/[-–—]/);
    }
  });

  it("converte a Ficha bruta da fundação para o modelo da tela", async () => {
    const id = await idDaFamilia("Dália");
    const { obterRepositorios } = await import("@/lib/dados/fabrica");
    const { ficha } = await obterRepositorios();
    const bruta = await ficha.obterFicha(id);
    const tela = paraFichaTela(bruta!);
    expect(tela.familiaId).toBe(id);
    expect(tela.datas).toHaveLength(4);
    expect(tela.idadeGestacional).toMatch(/^\d+s\d+d$/);
  });
});

describe("sem sessão", () => {
  it("marcar não contatar sem sessão redireciona (via exigirSessao)", async () => {
    const id = await idDaFamilia("Aurora");
    await deslogar();
    await expect(marcarNaoContatar(id, "Motivo")).rejects.toThrow(/sem sessão/);
  });
});
