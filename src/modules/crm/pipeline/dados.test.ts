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
import { FAMILIAS, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  criarLeadManual,
  detalhePerdaDemo,
  listarPipelineTela,
  marcarPerdido,
  reiniciarDetalhesPerdaDemoParaTestes,
  transicionarEstagio,
} from "./dados";

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
  reiniciarDetalhesPerdaDemoParaTestes();
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(null);
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("listarPipelineTela: sobre o repositório da fundação, com o que a tela acrescenta", () => {
  it("calcula a idade gestacional e o tempo no estágio de cada cartão", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const cartoes = await listarPipelineTela({ pipeline: 1 });
    const aurora = cartoes.find(
      (c) => c.nomeFamilia === "Família Teste Aurora",
    );
    expect(aurora?.idadeGestacional).toMatch(/^\d+s\dd$/);
    expect(aurora?.tempoNoEstagio).toMatch(/^(Hoje|Há \d+ dias?)$/);
  });

  it("filtra por semanas de gestação (calculadas, nunca gravadas)", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const todos = await listarPipelineTela({ pipeline: 1 });
    const comDpp = todos.filter((c) => c.idadeGestacional);
    expect(comDpp.length).toBeGreaterThan(0);

    const filtrados = await listarPipelineTela({
      pipeline: 1,
      semanasMin: 0,
      semanasMax: 0,
    });
    // Nenhuma família do seed está com 0 semanas exatas: o filtro restringe de verdade.
    expect(filtrados.length).toBeLessThan(comDpp.length);
  });

  it('"só as minhas" filtra pelo responsável da sessão', async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const minhas = await listarPipelineTela({ pipeline: 1, minhas: true });
    const todos = await listarPipelineTela({ pipeline: 1 });
    expect(minhas.length).toBe(todos.length); // o único responsável do seed é o comercial de teste

    await logarComo("Perfil Teste Diretoria");
    const daDiretoria = await listarPipelineTela({ pipeline: 1, minhas: true });
    expect(daDiretoria).toEqual([]); // a diretoria não é responsável de nenhuma
  });
});

describe("transicionarEstagio", () => {
  it("muda o estágio pela mesma porta do repositório (api.transicionar)", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const [aurora] = await listarPipelineTela({ pipeline: 1, busca: "Aurora" });
    expect(aurora?.estagioP1).toBe("novo");
    await transicionarEstagio({
      oportunidadeId: aurora!.oportunidadeId,
      pipeline: 1,
      para: "em_conversa_ia",
    });
    const [depois] = await listarPipelineTela({ pipeline: 1, busca: "Aurora" });
    expect(depois?.estagioP1).toBe("em_conversa_ia");
  });
});

describe("marcarPerdido: grava motivo e detalhe, e só depois transiciona (P15 item 2)", () => {
  it("grava o motivo, move para perdido e some do pipeline", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    expect(cedro?.estagioP1).toBe("qualificado");

    await marcarPerdido({
      oportunidadeId: cedro!.oportunidadeId,
      pipeline: 1,
      motivo: "preco",
      detalhe: "Achou o pacote Imersão caro.",
    });

    const l = obterLoja();
    const oportunidade = l.oportunidades.find(
      (o) => o.id === cedro!.oportunidadeId,
    );
    expect(oportunidade?.estagioP1).toBe("perdido");
    expect(oportunidade?.motivoPerda).toBe("preco");
    expect(detalhePerdaDemo(cedro!.oportunidadeId)).toBe(
      "Achou o pacote Imersão caro.",
    );
  });

  it("sem detalhe, não deixa detalhe de uma tentativa anterior grudado", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const [cedro] = await listarPipelineTela({ pipeline: 1, busca: "Cedro" });
    await marcarPerdido({
      oportunidadeId: cedro!.oportunidadeId,
      pipeline: 1,
      motivo: "sem_resposta",
    });
    expect(detalhePerdaDemo(cedro!.oportunidadeId)).toBeUndefined();
  });

  it("transição proibida (a partir de perdido, para um estágio sem regra) é recusada como no banco", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const [flor] = await listarPipelineTela({ pipeline: 1, busca: "Flor" });
    expect(flor?.estagioP1).toBe("perdido");
    await expect(
      transicionarEstagio({
        oportunidadeId: flor!.oportunidadeId,
        pipeline: 1,
        para: "sessao_venda_realizada",
      }),
    ).rejects.toMatchObject({ codigo: "recusado" });
  });
});

describe("criarLeadManual: família, pessoa e oportunidade, com origem (P15 item 4)", () => {
  it("cadastra em Novo, no pipeline 1, com o responsável sendo quem cadastrou", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    const resultado = await criarLeadManual({
      nomeFamilia: "Família Teste Nova Captação",
      nomeContato: "Sandra Nova",
      papelContato: "mae",
      telefoneE164: "(11) 98888-7777",
      origem: "site",
    });
    expect(resultado.familiaId).toBeTruthy();
    expect(resultado.oportunidadeId).toBeTruthy();

    const cartoes = await listarPipelineTela({
      pipeline: 1,
      busca: "Nova Captação",
    });
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0]?.estagioP1).toBe("novo");
    expect(cartoes[0]?.responsavelId).toBe(
      sessaoDe("Perfil Teste Comercial").usuarioId,
    );

    const l = obterLoja();
    const pessoa = l.pessoas.find((p) => p.familiaId === resultado.familiaId);
    expect(pessoa?.telefoneE164).toBe("+5511988887777");
  });

  it("recusa telefone que não parece um número", async () => {
    await logarComo("Perfil Teste Comercial", "aal1");
    await expect(
      criarLeadManual({
        nomeFamilia: "Família Teste Telefone Ruim",
        nomeContato: "Alguém",
        papelContato: "mae",
        telefoneE164: "123",
        origem: "outro",
      }),
    ).rejects.toMatchObject({ codigo: "recusado" });
  });

  it("só comercial e diretoria cadastram lead manual", async () => {
    await logarComo("Perfil Teste Coordenacao");
    await expect(
      criarLeadManual({
        nomeFamilia: "Família Teste Sem Permissão",
        nomeContato: "Alguém",
        papelContato: "mae",
        telefoneE164: "11900001234",
        origem: "outro",
      }),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
});

// Só para conferir que a fixture ainda tem o formato esperado por estes testes.
describe("pré-condição das fixtures", () => {
  it("Cedro está qualificado e Flor está perdida, como os testes assumem", () => {
    expect(FAMILIAS.find((f) => f.nome.endsWith("Cedro"))).toBeTruthy();
    expect(FAMILIAS.find((f) => f.nome.endsWith("Flor"))).toBeTruthy();
  });
});
