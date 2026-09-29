// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "127.0.0.1:3000" }),
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado neste teste");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
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
import { familiaPorNome, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { reiniciarLojaVenda } from "@/lib/dados/demonstracao/venda";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  acaoAprovarDesconto,
  acaoGerarLinkFormulario,
  acaoRegistrarEnvioFormulario,
  acaoSalvarProposta,
} from "./acoes";
import { estadoInicialProposta } from "./estado-acoes";

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

async function entrar(nome: string, aal: "aal1" | "aal2" = "aal2") {
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
    aal,
    aalPossivel: "aal2",
  });
}

const gruta = familiaPorNome("Gruta").id;

async function formularioDaProposta(condicaoId = "") {
  const { venda } = await obterRepositorios();
  const oportunidadeId = (await venda.oportunidadeDaFamilia(gruta))!;
  const proposta = await venda.obterProposta(oportunidadeId);
  const formulario = new FormData();
  formulario.set("familiaId", gruta);
  formulario.set("oportunidadeId", oportunidadeId);
  formulario.set(
    "pacoteVersaoId",
    proposta.pacotes.find((p) => p.nome === "Essencial")!.pacoteVersaoId,
  );
  formulario.set("parcelas", "3");
  formulario.set("condicaoId", condicaoId);
  formulario.set("paraQuem", "propria");
  formulario.set("descontoPct", "0");
  return { formulario, oportunidadeId, proposta };
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaVenda();
  await entrar("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("proposta (P30 item 1)", () => {
  it("salva e diz o próximo passo", async () => {
    const { formulario } = await formularioDaProposta();
    const resultado = await acaoSalvarProposta(
      estadoInicialProposta,
      formulario,
    );
    expect(resultado).toEqual({
      sucesso:
        "Proposta salva. O próximo passo é gerar o link do formulário para a família.",
    });
  });

  it("desconto fora da tabela sem motivo volta com a frase do banco", async () => {
    const { formulario } = await formularioDaProposta();
    formulario.set("descontoPct", "10");
    const resultado = await acaoSalvarProposta(
      estadoInicialProposta,
      formulario,
    );
    expect(resultado.erro).toMatch(/precisa de motivo/);
    expect(resultado.erro).not.toMatch(/venda:|[\u2014\u2013]/);
  });

  it("condição com aprovação: o comercial não aprova; a diretoria aprova", async () => {
    const { formulario, oportunidadeId, proposta } =
      await formularioDaProposta();
    formulario.set(
      "condicaoId",
      proposta.condicoes.find((c) => c.requerAprovacao)!.id,
    );
    expect(
      (await acaoSalvarProposta(estadoInicialProposta, formulario)).sucesso,
    ).toMatch(/espera a aprovação da diretoria/);
    const ids = new FormData();
    ids.set("familiaId", gruta);
    ids.set("oportunidadeId", oportunidadeId);
    expect(
      (await acaoAprovarDesconto(estadoInicialProposta, ids)).erro,
    ).toBeTruthy();
    expect((await acaoGerarLinkFormulario(oportunidadeId, gruta)).ok).toBe(
      false,
    );

    await entrar("Perfil Teste Diretoria");
    expect(
      (await acaoAprovarDesconto(estadoInicialProposta, ids)).sucesso,
    ).toMatch(/aprovada/);
  });
});

describe("link do formulário (P30 itens 2 e 3)", () => {
  it("gera o texto aprovado com o link e o wa.me; o Enviei grava a conversa sem o link", async () => {
    const { formulario, oportunidadeId } = await formularioDaProposta();
    await acaoSalvarProposta(estadoInicialProposta, formulario);

    const link = await acaoGerarLinkFormulario(oportunidadeId, gruta);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    const achado =
      /http:\/\/127\.0\.0\.1:3000\/formulario\/([A-Za-z0-9_-]{43})/.exec(
        link.texto,
      );
    expect(achado).not.toBeNull();
    const token = achado![1]!;
    expect(link.texto).toMatch(/^Oi, Juliana, aqui é o Leonardo\./);
    expect(link.whatsapp).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);

    const loja = obterLoja();
    const conversa = loja.conversas.find((c) => c.familiaId === gruta);
    const antes = loja.mensagens.length;
    const registro = await acaoRegistrarEnvioFormulario(link.tarefaId!, gruta);
    expect(registro.sucesso).toMatch(/Envio registrado/);
    expect(JSON.stringify(loja.mensagens)).not.toContain(token);
    expect(JSON.stringify(loja.tarefas)).not.toContain(token);
    if (conversa) {
      expect(loja.mensagens.length).toBe(antes + 1);
      expect(loja.mensagens.at(-1)?.conteudo).toContain(
        "link do formulário seguro (uso único, não guardado)",
      );
    }
    expect(loja.tarefas.find((t) => t.id === link.tarefaId)?.status).toBe(
      "concluida",
    );
  });

  it("em AAL1 o banco recusa e a tela explica o MFA", async () => {
    await entrar("Perfil Teste Comercial", "aal1");
    const resultado = await acaoGerarLinkFormulario(
      "00000000-0000-4000-8000-000000000000",
      gruta,
    );
    expect(resultado).toEqual({
      ok: false,
      erro: expect.stringMatching(/MFA/),
    });
  });
});
