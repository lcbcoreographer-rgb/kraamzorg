// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ host: "127.0.0.1:3000", "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado neste teste");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@/lib/auth/sessao", () => {
  let atual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => atual,
    exigirSessao: async () => {
      if (!atual) throw new Error("sem sessão no teste");
      return atual;
    },
    __definir: (s: SessaoUsuario | null) => {
      atual = s;
    },
  };
});

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  acoesDoPosVenda,
  reiniciarLojaOcorrencias,
} from "@/lib/dados/demonstracao/ocorrencia";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { obterRepositorioPesquisa } from "@/lib/dados/pesquisa";
import {
  acaoAtualizarOcorrencia,
  acaoAvancarPosVenda,
  acaoGerarLinkPesquisa,
  acaoMarcarPesquisaEnviada,
  acaoRegistrarOcorrencia,
} from "./acoes";
import { estadoInicialOcorrencia } from "./estado-acoes";
import { enviarPesquisaFamilia } from "../pesquisa/acoes";

/**
 * P42, aceite: família em `encerrado_sensivel` não recebe pesquisa; nota baixa
 * (detrator) gera ocorrência privada e nenhuma mensagem automática. Sobre o
 * repositório de demonstração, que repete as regras de
 * 0024_evolucao_ocorrencia_nf.sql (a prova do banco é o supabase/tests/024).
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

async function entrar(nome: string) {
  const usuario = USUARIOS.find((u) => u.nome === nome)!;
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definir: (s: SessaoUsuario | null) => void;
  };
  modulo.__definir({
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
  });
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor);
  return f;
}

async function familiaId(nome: string): Promise<string> {
  return obterLoja().familias.find((f) => f.nome === nome)!.id;
}

async function itemDe(nomeFamilia: string) {
  const { posVenda } = await obterRepositorios();
  const lista = await posVenda.listar("todos");
  return lista.itens.find((i) => i.familiaNome === nomeFamilia)!;
}

const RESPOSTAS_BASE = {
  depoimento_autorizado: true,
  autorizacao_imagem: false,
};

/** Gera o link de uma família do pós-venda, marca como enviada e devolve o token da URL. */
async function linkEnviado(nome: string): Promise<string> {
  const item = await itemDe(nome);
  const r = await acaoGerarLinkPesquisa(item.id);
  expect(r.erro).toBeUndefined();
  expect((await acaoMarcarPesquisaEnviada(item.id)).erro).toBeUndefined();
  const token = /pesquisa\/([A-Za-z0-9_-]+)/.exec(r.texto ?? "")?.[1];
  expect(token).toBeTruthy();
  return token!;
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaOcorrencias();
  await entrar("Perfil Teste Coordenacao");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("ocorrências", () => {
  it("abre com SLA pela prioridade e histórico; nota baixa é sempre privada", async () => {
    const aurora = await familiaId("Família Teste Aurora");
    await expect(
      acaoRegistrarOcorrencia(
        estadoInicialOcorrencia,
        formulario({
          tipo: "detrator",
          prioridade: "maxima",
          titulo: "Retorno de nota baixa",
          descricao:
            "A família contou por telefone que esperava outro horário.",
          familiaId: aurora,
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/ocorrencias\/[0-9a-f-]{36}$/);

    const { ocorrencias } = await obterRepositorios();
    const lista = await ocorrencias.listar("abertas");
    const nova = lista.ocorrencias.find(
      (o) => o.titulo === "Retorno de nota baixa",
    )!;
    expect(nova.privada).toBe(true);
    expect(nova.tipo).toBe("detrator");
    const horas =
      (Date.parse(nova.slaVenceEm!) - Date.parse(nova.criadoEm)) / 3_600_000;
    expect(Math.round(horas)).toBe(4);
    const detalhe = await ocorrencias.obter(nova.id);
    expect(detalhe.historico[0]?.acao).toBe("aberta");

    // não vira pública nem por atualização
    const r = await acaoAtualizarOcorrencia({
      ocorrenciaId: nova.id,
      privada: false,
      versao: detalhe.versao,
    });
    expect(r.erro).toMatch(/fica privada para sempre/);
  });

  it("título e tipo faltando voltam como campos marcados", async () => {
    const r = await acaoRegistrarOcorrencia(
      estadoInicialOcorrencia,
      formulario({ tipo: "", titulo: "a", descricao: "" }),
    );
    expect(r.erro).toMatch(/Falta alguma coisa/);
    expect(Object.keys(r.campos ?? {}).sort()).toEqual([
      "descricao",
      "tipo",
      "titulo",
    ]);
  });

  it("só anda para a frente e resolver pede nota e responsável", async () => {
    const { ocorrencias } = await obterRepositorios();
    const lista = await ocorrencias.listar("abertas");
    const aurora = lista.ocorrencias.find((o) => o.tipo === "reclamacao")!;
    expect(aurora.status).toBe("responsavel_definido");

    const atras = await acaoAtualizarOcorrencia({
      ocorrenciaId: aurora.id,
      status: "aberta",
      versao: aurora.versao,
    });
    expect(atras.erro).toMatch(/só anda para a frente/);

    const semNota = await acaoAtualizarOcorrencia({
      ocorrenciaId: aurora.id,
      status: "resolvida",
      versao: aurora.versao,
    });
    expect(semNota.erro).toMatch(/nota de pelo menos 10 letras/);

    const resolvida = await acaoAtualizarOcorrencia({
      ocorrenciaId: aurora.id,
      status: "resolvida",
      nota: "Combinamos com a família um horário fixo até o fim.",
      versao: aurora.versao,
    });
    expect(resolvida.erro).toBeUndefined();
    const depois = await ocorrencias.obter(aurora.id);
    expect(depois.status).toBe("resolvida");
    expect(depois.resolvidaEm).not.toBeNull();
    expect(depois.historico.at(-1)?.nota).toMatch(/horário fixo/);

    // com a versão velha, avisa
    const velha = await acaoAtualizarOcorrencia({
      ocorrenciaId: aurora.id,
      status: "encerrada",
      nota: "Encerrada depois da confirmação da família.",
      versao: aurora.versao,
    });
    expect(velha.erro).toMatch(/Outra pessoa alterou esta ocorrência/);
  });

  it("a enfermeira não abre ocorrência nem vê as privadas", async () => {
    await entrar("Perfil Teste Enfermeira");
    const r = await acaoRegistrarOcorrencia(
      estadoInicialOcorrencia,
      formulario({
        tipo: "outro",
        prioridade: "normal",
        titulo: "Assunto qualquer",
        descricao: "Descrição qualquer da ocorrência.",
      }),
    );
    expect(r.erro).toMatch(/não permite esta etapa/);
    const { ocorrencias } = await obterRepositorios();
    const lista = await ocorrencias.listar("todas");
    expect(lista.ocorrencias.every((o) => !o.privada)).toBe(true);
  });
});

describe("pesquisa e pós-venda", () => {
  it("família em estado sensível não recebe a pesquisa: o botão some, o link não sai e o link antigo deixa de abrir", async () => {
    const aurora = await familiaId("Família Teste Aurora");
    const dalia = await familiaId("Família Teste Dália");
    const loja = obterLoja();
    loja.familias.find((f) => f.id === aurora)!.estadoSensivel =
      "encerrado_sensivel";
    loja.familias.find((f) => f.id === dalia)!.estadoSensivel =
      "encerrado_sensivel";

    const semLink = await itemDe("Família Teste Aurora");
    expect(semLink.bloqueio).toBe("freio");
    expect(semLink.podeGerarLink).toBe(false);
    const r = await acaoGerarLinkPesquisa(semLink.id);
    expect(r.erro).toMatch(/estado sensível/);
    expect(r.texto).toBeUndefined();
    expect((await itemDe("Família Teste Aurora")).linkAtivo).toBe(false);
    expect((await acaoMarcarPesquisaEnviada(semLink.id)).erro).toMatch(
      /ainda não tem link/,
    );

    // a Dália já tinha o link em circulação: com o freio, ele para de abrir e de aceitar resposta
    const { TOKEN_DEMO_PESQUISA } =
      await import("@/lib/dados/demonstracao/ocorrencia");
    const publica = await obterRepositorioPesquisa();
    const aberta = await publica.abrir(TOKEN_DEMO_PESQUISA, "203.0.113.20");
    expect(aberta.situacao).toBe("invalido");
    const envio = await publica.enviar(
      TOKEN_DEMO_PESQUISA,
      { nps: 3, ...RESPOSTAS_BASE },
      "203.0.113.20",
    );
    expect(envio.situacao).toBe("invalido");
    // nenhuma ocorrência e nenhuma tarefa nasceu dessa tentativa
    const { ocorrencias } = await obterRepositorios();
    expect(
      (await ocorrencias.listar("todas")).ocorrencias.filter(
        (o) =>
          o.tipo === "detrator" &&
          o.familiaId === dalia &&
          o.status !== "aberta",
      ),
    ).toHaveLength(0);
    expect(acoesDoPosVenda()).toHaveLength(0);
  });

  it("família que pediu para não ser contatada também não recebe", async () => {
    const aurora = await familiaId("Família Teste Aurora");
    obterLoja().familias.find((f) => f.id === aurora)!.naoContatar = true;
    const item = await itemDe("Família Teste Aurora");
    expect(item.bloqueio).toBe("nao_contatar");
    const r = await acaoGerarLinkPesquisa(item.id);
    expect(r.erro).toMatch(/pediu para não ser contatada/);
  });

  it("nota baixa gera ocorrência privada da coordenação e nenhuma tarefa de depoimento ou indicação", async () => {
    const token = await linkEnviado("Família Teste Aurora");
    const publica = await obterRepositorioPesquisa();
    const aberta = await publica.abrir(token, "203.0.113.30");
    expect(aberta.situacao).toBe("valido");
    if (aberta.situacao === "valido") {
      // só o primeiro nome vai à família; nenhum dado além disso
      expect(aberta.nome).toBe("Marina");
      expect(JSON.stringify(aberta)).not.toMatch(/Aurora|@|\+55/);
    }

    const r = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 4, recomendaria: "talvez", ...RESPOSTAS_BASE },
      verificacao: "token-do-widget",
    });
    expect(r.situacao).toBe("recebido");

    const item = await itemDe("Família Teste Aurora");
    expect(item.nps).toBe(4);
    expect(item.classificacao).toBe("detrator");
    expect(item.estagio).toBe("classificado");

    const { ocorrencias } = await obterRepositorios();
    const lista = await ocorrencias.listar("abertas");
    const nova = lista.ocorrencias.find(
      (o) => o.tipo === "detrator" && o.familiaNome === "Família Teste Aurora",
    )!;
    expect(nova.privada).toBe(true);
    expect(nova.status).toBe("aberta");
    expect(nova.slaVenceEm).not.toBeNull();
    // nenhuma ação de depoimento, indicação ou escuta para quem deu nota baixa
    expect(acoesDoPosVenda()).toHaveLength(0);

    // a enfermeira não vê a ocorrência privada
    await entrar("Perfil Teste Enfermeira");
    const { ocorrencias: dela } = await obterRepositorios();
    expect(
      (await dela.listar("todas")).ocorrencias.some((o) => o.id === nova.id),
    ).toBe(false);
  });

  it("o link vale uma resposta só", async () => {
    const token = await linkEnviado("Família Teste Aurora");
    const primeira = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 10, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(primeira.situacao).toBe("recebido");
    const segunda = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 1, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(segunda.situacao).toBe("invalido");
    const publica = await obterRepositorioPesquisa();
    expect((await publica.abrir(token, "203.0.113.31")).situacao).toBe(
      "invalido",
    );
  });

  it("promotor abre as tarefas de depoimento e indicação; neutro abre a de escuta; nenhum abre ocorrência", async () => {
    const tokenPromotor = await linkEnviado("Família Teste Aurora");
    await enviarPesquisaFamilia({
      token: tokenPromotor,
      respostas: { nps: 9, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(
      acoesDoPosVenda()
        .map((a) => a.acao)
        .sort(),
    ).toEqual(["depoimento", "indicacao"]);
    // neutro: a Dália já tem o link enviado
    const { TOKEN_DEMO_PESQUISA } =
      await import("@/lib/dados/demonstracao/ocorrencia");
    const neutro = await enviarPesquisaFamilia({
      token: TOKEN_DEMO_PESQUISA,
      respostas: { nps: 7, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(neutro.situacao).toBe("recebido");
    expect(acoesDoPosVenda().map((a) => a.acao)).toContain("escuta");
    const { ocorrencias } = await obterRepositorios();
    expect(
      (await ocorrencias.listar("todas")).ocorrencias.filter(
        (o) =>
          o.titulo === "Pesquisa de satisfação com nota baixa" &&
          o.criadoEm > new Date(Date.now() - 60_000).toISOString(),
      ),
    ).toHaveLength(0);
  });

  it("resposta incompleta volta com as perguntas marcadas e não gasta o link", async () => {
    const token = await linkEnviado("Família Teste Aurora");
    const r = await enviarPesquisaFamilia({
      token,
      respostas: { recomendaria: "nao_existe" },
      verificacao: "x",
    });
    expect(r).toEqual({
      situacao: "corrigir",
      erros: {
        nps: "obrigatorio",
        recomendaria: "invalido",
        depoimento_autorizado: "obrigatorio",
        autorizacao_imagem: "obrigatorio",
      },
    });
    const ok = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 8, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(ok.situacao).toBe("recebido");
  });

  it("sem a verificação do Turnstile nada é gravado; muitas tentativas de link errado travam a origem", async () => {
    const token = await linkEnviado("Família Teste Aurora");
    const semVerificacao = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 10, ...RESPOSTAS_BASE },
      verificacao: null,
    });
    expect(semVerificacao).toEqual({
      situacao: "verificacao",
      motivo: "sem_token",
    });
    expect((await itemDe("Família Teste Aurora")).nps).toBeNull();

    for (let i = 0; i < 5; i += 1) {
      const errado = await enviarPesquisaFamilia({
        token: `token-que-nao-existe-${i}`,
        respostas: { nps: 10, ...RESPOSTAS_BASE },
        verificacao: "x",
      });
      expect(errado.situacao).toBe("invalido");
    }
    const travado = await enviarPesquisaFamilia({
      token,
      respostas: { nps: 10, ...RESPOSTAS_BASE },
      verificacao: "x",
    });
    expect(travado.situacao).toBe("limite");
  });

  it("depois de classificado, a coordenação marca a ação e arquiva", async () => {
    const cedro = await itemDe("Família Teste Cedro");
    expect(cedro.estagio).toBe("classificado");
    expect((await acaoAvancarPosVenda(cedro.id)).sucesso).toMatch(/avançou/);
    expect((await itemDe("Família Teste Cedro")).estagio).toBe(
      "acao_executada",
    );
    expect((await acaoAvancarPosVenda(cedro.id)).erro).toBeUndefined();
    expect((await itemDe("Família Teste Cedro")).estagio).toBe("arquivado");
    expect((await acaoAvancarPosVenda(cedro.id)).erro).toMatch(
      /Não há próximo passo/,
    );
  });

  it("o comercial não vê o pós-venda", async () => {
    await entrar("Perfil Teste Comercial");
    const { posVenda } = await obterRepositorios();
    await expect(posVenda.listar("abertos")).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});
