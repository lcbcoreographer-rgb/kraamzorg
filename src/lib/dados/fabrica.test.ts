// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado neste teste");
  },
  headers: async () => new Headers(),
}));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { criarRepositoriosDemonstracao } from "./demonstracao";
import { FAMILIAS, USUARIOS } from "./demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "./demonstracao/loja";
import { ErroRepositorio } from "./erros";
import { criarRepositorios } from "./fabrica";
import { ErroModoDemonstracao, modoDados } from "./modo";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

function ambiente(
  valores: Partial<Record<keyof typeof ORIGINAL, string | undefined>>,
) {
  for (const chave of Object.keys(ORIGINAL) as (keyof typeof ORIGINAL)[]) {
    const valor = chave in valores ? valores[chave] : undefined;
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
}

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

afterEach(() => {
  ambiente(ORIGINAL);
});

describe("modoDados: qual implementação o servidor usa", () => {
  it("usa o Supabase quando KZ_DADOS não pede demonstração", () => {
    ambiente({ NEXT_PUBLIC_APP_ENV: "producao" });
    expect(modoDados()).toBe("supabase");
    ambiente({ NEXT_PUBLIC_APP_ENV: "desenvolvimento" });
    expect(modoDados()).toBe("supabase");
  });

  it("usa a demonstração só com KZ_DADOS=demonstracao em desenvolvimento", () => {
    ambiente({
      KZ_DADOS: "demonstracao",
      NEXT_PUBLIC_APP_ENV: "desenvolvimento",
    });
    expect(modoDados()).toBe("demonstracao");
  });

  it.each([
    ["producao", undefined],
    ["homologacao", undefined],
    [undefined, undefined],
    ["production", undefined],
    ["desenvolvimento", "production"],
  ])(
    "lança erro, e não cai no Supabase em silêncio, com NEXT_PUBLIC_APP_ENV=%s e VERCEL_ENV=%s",
    (appEnv, vercelEnv) => {
      ambiente({
        KZ_DADOS: "demonstracao",
        NEXT_PUBLIC_APP_ENV: appEnv,
        VERCEL_ENV: vercelEnv,
      });
      expect(() => modoDados()).toThrow(ErroModoDemonstracao);
    },
  );
});

describe("implementação de demonstração fora de desenvolvimento", () => {
  it("a fábrica de demonstração lança erro em produção, mesmo chamada direto", () => {
    ambiente({ KZ_DADOS: "demonstracao", NEXT_PUBLIC_APP_ENV: "producao" });
    expect(() =>
      criarRepositoriosDemonstracao({
        usuarioId: null,
        papeis: [],
        aal: "aal1",
      }),
    ).toThrow(ErroModoDemonstracao);
  });

  it("a loja em memória também recusa fora de desenvolvimento", () => {
    ambiente({ KZ_DADOS: "demonstracao", NEXT_PUBLIC_APP_ENV: "homologacao" });
    expect(() => obterLoja()).toThrow(ErroModoDemonstracao);
  });

  it("criarRepositorios('demonstracao') em homologação lança erro", async () => {
    ambiente({ KZ_DADOS: "demonstracao", NEXT_PUBLIC_APP_ENV: "homologacao" });
    await expect(criarRepositorios("demonstracao", null)).rejects.toThrow(
      ErroModoDemonstracao,
    );
  });
});

describe("repositórios de demonstração (as mesmas interfaces, dados do seed)", () => {
  beforeEach(() => {
    ambiente({
      KZ_DADOS: "demonstracao",
      NEXT_PUBLIC_APP_ENV: "desenvolvimento",
    });
    reiniciarLoja();
  });

  it("as fixtures seguem o padrão fictício do seed", () => {
    expect(FAMILIAS).toHaveLength(12);
    for (const familia of FAMILIAS)
      expect(familia.nome).toMatch(/^Família Teste /);
    const loja = obterLoja();
    for (const pessoa of loja.pessoas) {
      expect(pessoa.nome).toMatch(/ Teste /);
      expect(pessoa.telefoneE164).toMatch(/^\+5511900000\d{3}$/);
    }
  });

  it("o comercial vê o pipeline 1 com as famílias do seed", async () => {
    const repos = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const cartoes = await repos.familias.listarPipeline({ pipeline: 1 });
    expect(cartoes.map((c) => c.nomeFamilia)).toContain("Família Teste Aurora");
    expect(cartoes.every((c) => c.pipeline === 1)).toBe(true);
    const contagem = await repos.familias.contarPorEstagio(1);
    expect(contagem.nutricao).toBe(1);
  });

  it("busca por telefone acha a família da pessoa", async () => {
    const repos = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const cartoes = await repos.familias.listarPipeline({
      pipeline: 1,
      busca: "(11) 90000-0303",
    });
    expect(cartoes.map((c) => c.nomeFamilia)).toEqual(["Família Teste Cedro"]);
  });

  it("transição permitida muda o estágio; a proibida é recusada como no banco", async () => {
    const repos = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const [aurora] = await repos.familias.listarPipeline({
      pipeline: 1,
      busca: "Aurora",
    });
    expect(aurora?.estagioP1).toBe("novo");
    await repos.familias.transicionar({
      maquina: "p1",
      entidadeId: aurora!.oportunidadeId,
      para: "em_conversa_ia",
    });
    const [depois] = await repos.familias.listarPipeline({
      pipeline: 1,
      busca: "Aurora",
    });
    expect(depois?.estagioP1).toBe("em_conversa_ia");
    await expect(
      repos.familias.transicionar({
        maquina: "p1",
        entidadeId: aurora!.oportunidadeId,
        para: "sessao_venda_realizada",
      }),
    ).rejects.toMatchObject({ codigo: "recusado" });
  });

  it("papel com MFA em AAL1 não enxerga nada, como a política exige_mfa_do_perfil", async () => {
    const repos = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Diretoria", "aal1"),
    );
    expect(await repos.familias.listarFamilias()).toEqual([]);
    expect(await repos.configuracoes.listarParametros()).toEqual([]);
  });

  it("enfermeira e marketing não leem a tabela de famílias", async () => {
    for (const nome of ["Perfil Teste Enfermeira", "Perfil Teste Marketing"]) {
      const repos = await criarRepositorios("demonstracao", sessaoDe(nome));
      expect(await repos.familias.listarFamilias()).toEqual([]);
    }
  });

  it("evento restrito da linha do tempo só chega para coordenação e diretoria", async () => {
    const bruma = FAMILIAS.find((f) => f.nome.endsWith("Bruma"))!;
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const coordenacao = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Coordenacao"),
    );
    expect(
      (await comercial.ficha.linhaDoTempo(bruma.id)).some((e) => e.restrito),
    ).toBe(false);
    expect(
      (await coordenacao.ficha.linhaDoTempo(bruma.id)).some((e) => e.restrito),
    ).toBe(true);
  });

  it("parâmetros só para a diretoria; o valor vem do seed, não do código", async () => {
    const diretoria = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Diretoria"),
    );
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    expect(
      (await diretoria.configuracoes.lerParametro("freio_desfazer_segundos"))
        ?.valor,
    ).toBe(10);
    expect(
      await comercial.configuracoes.lerParametro("freio_desfazer_segundos"),
    ).toBeNull();
  });

  it("freio: só sobe, cria a tarefa de justificativa e só coordenação ou diretoria revertem", async () => {
    const aurora = FAMILIAS.find((f) => f.nome.endsWith("Aurora"))!;
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    await comercial.ficha.acionarFreio(aurora.id, "bloqueio_total");
    expect(
      (await comercial.ficha.obterFicha(aurora.id))?.familia.estadoSensivel,
    ).toBe("bloqueio_total");
    const tarefas = await comercial.tarefas.listarTarefas({ minhas: true });
    expect(
      tarefas.some(
        (t) =>
          t.titulo.startsWith("Justificar o freio") &&
          t.familiaId === aurora.id,
      ),
    ).toBe(true);
    await expect(
      comercial.ficha.acionarFreio(aurora.id, "atencao"),
    ).rejects.toBeInstanceOf(ErroRepositorio);
    await expect(
      comercial.ficha.reverterFreio(aurora.id, "normal", "engano"),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
    const coordenacao = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Coordenacao"),
    );
    await coordenacao.ficha.reverterFreio(
      aurora.id,
      "normal",
      "Toque acidental confirmado com a família.",
    );
    expect(
      (await coordenacao.ficha.obterFicha(aurora.id))?.familia.estadoSensivel,
    ).toBe("normal");
  });

  it("freio: o acionamento devolve desfazer_ate e a reversão só desce, com AAL2 (como a 0009)", async () => {
    const aurora = FAMILIAS.find((f) => f.nome.endsWith("Aurora"))!;
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const antes = Date.now();
    const { resposta } = await comercial.ficha.acionarFreio(
      aurora.id,
      "atencao",
    );
    const desfazerAte = (resposta as { desfazer_ate?: string }).desfazer_ate;
    expect(typeof desfazerAte).toBe("string");
    expect(Date.parse(desfazerAte!)).toBeGreaterThan(antes);

    const coordenacao = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Coordenacao"),
    );
    await expect(
      coordenacao.ficha.reverterFreio(aurora.id, "bloqueio_total", "subir"),
    ).rejects.toMatchObject({ codigo: "recusado" });
    const coordenacaoAal1 = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Coordenacao", "aal1"),
    );
    await expect(
      coordenacaoAal1.ficha.reverterFreio(aurora.id, "normal", "engano"),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("tarefas trazem o payload; a de régua tem texto do modelo e telefone da família", async () => {
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const tarefas = await comercial.tarefas.listarTarefas();
    const dalia = tarefas.find((t) => t.nomeFamilia?.endsWith("Dália"));
    const payload = dalia?.payload as Record<string, string> | undefined;
    const modelo = obterLoja().mensagensModelo.find(
      (m) => m.chave === payload?.mensagemChave,
    );
    expect(modelo).toBeDefined();
    expect(payload?.textoSugerido).toBe(
      modelo!.texto.replaceAll("{nome}", "Fernanda"),
    );
    expect(payload?.telefoneE164).toMatch(/^\+5511900000\d{3}$/);
  });

  it("famílias: busca por nome ou por telefone em qualquer formato", async () => {
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const porTelefone = await comercial.familias.listarFamilias({
      busca: "(11) 90000-0308",
    });
    expect(porTelefone.map((f) => f.nome)).toEqual(["Família Teste Gruta"]);
    const porNome = await comercial.familias.listarFamilias({ busca: "gruta" });
    expect(porNome.map((f) => f.nome)).toEqual(["Família Teste Gruta"]);
  });

  it("conversas: filtro por família", async () => {
    const comercial = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Comercial", "aal1"),
    );
    const aurora = FAMILIAS.find((f) => f.nome.endsWith("Aurora"))!;
    const conversas = await comercial.agente.listarConversas({
      familiaId: aurora.id,
    });
    expect(conversas.length).toBeGreaterThan(0);
    expect(conversas.every((c) => c.familiaId === aurora.id)).toBe(true);
  });

  it("revogar sessões é da diretoria e fica registrado para derrubar o cookie", async () => {
    const comercial = sessaoDe("Perfil Teste Comercial", "aal1");
    const repos = await criarRepositorios(
      "demonstracao",
      sessaoDe("Perfil Teste Diretoria"),
    );
    await repos.usuarios.revogarSessoes(comercial.usuarioId);
    expect(obterLoja().sessoesRevogadasEm[comercial.usuarioId]).toBeTypeOf(
      "number",
    );
    const reposComercial = await criarRepositorios("demonstracao", comercial);
    await expect(
      reposComercial.usuarios.revogarSessoes(comercial.usuarioId),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});

describe("implementação Supabase: escrita pelo schema api", () => {
  it("transicionar chama api.transicionar por RPC, nunca update de estágio", async () => {
    const chamadas: string[] = [];
    const cliente = {
      schema(nome: string) {
        chamadas.push(`schema:${nome}`);
        return {
          rpc: async (funcao: string, args: Record<string, unknown>) => {
            chamadas.push(`rpc:${funcao}:${JSON.stringify(args)}`);
            return {
              data: { de: "novo", para: "em_conversa_ia" },
              error: null,
            };
          },
        };
      },
      from(tabela: string) {
        chamadas.push(`from:${tabela}`);
        throw new Error("não devia ler tabela para transicionar");
      },
    };
    const { criarRepositoriosSupabase } = await import("./supabase");
    const repos = criarRepositoriosSupabase({
      cliente: cliente as never,
      usuarioId: "00000000-0000-4000-8000-000000000001",
    });
    const resposta = await repos.familias.transicionar({
      maquina: "p1",
      entidadeId: "00000000-0000-4000-8000-000000000002",
      para: "em_conversa_ia",
    });
    expect(resposta).toEqual({ de: "novo", para: "em_conversa_ia" });
    expect(chamadas[0]).toBe("schema:api");
    expect(chamadas[1]).toContain("rpc:transicionar");
    expect(chamadas.some((c) => c.startsWith("from:"))).toBe(false);
  });

  it("erro 42501 do banco vira ErroRepositorio sem_permissao", async () => {
    const cliente = {
      schema: () => ({
        rpc: async () => ({
          data: null,
          error: { code: "42501", message: "acesso negado" },
        }),
      }),
    };
    const { criarRepositoriosSupabase } = await import("./supabase");
    const repos = criarRepositoriosSupabase({
      cliente: cliente as never,
      usuarioId: null,
    });
    await expect(
      repos.ficha.acionarFreio("x", "bloqueio_total"),
    ).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});
