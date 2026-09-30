// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => {
    throw new Error("cookies() não deveria ser chamado neste teste");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirecionar = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    redirecionar(destino);
    throw new Error(`NEXT_REDIRECT ${destino}`);
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
import { FEITO_SESSAO } from "./mensagens";
import { familiaPorNome, USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import { reiniciarLojaVenda } from "@/lib/dados/demonstracao/venda";
import {
  GRAVACAO_GRUTA,
  ID_COORDENACAO,
  ID_TRANSFERENCIA_REUNIAO,
} from "@/lib/dados/demonstracao/venda-fixtures";
import {
  acaoAgendarSessao,
  acaoGerarResumo,
  acaoRegistrarDesfecho,
  acaoRegistrarGravacao,
  acaoSalvarResumo,
} from "./acoes";
import { lerGravacaoTela, obterSessaoTela } from "./dados";
import { estadoInicialSessao } from "./estado-acoes";

const ORIGINAL = { ...process.env };

async function entrar(nome: string, aal: "aal1" | "aal2" = "aal2") {
  const usuario = USUARIOS.find((u) => u.nome === nome)!;
  const sessao: SessaoUsuario = {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal,
    aalPossivel: "aal2",
  };
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definir: (s: SessaoUsuario | null) => void;
  };
  modulo.__definir(sessao);
  return sessao;
}

function daquiDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODELO_RESUMO;
  reiniciarLoja();
  reiniciarLojaVenda();
  redirecionar.mockReset();
  await entrar("Perfil Teste Comercial", "aal1");
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("acaoAgendarSessao (P29 item 1)", () => {
  it("marca a partir da transferência, move o P1 e abre a conversa marcada", async () => {
    const cedro = familiaPorNome("Cedro").id;
    const formulario = new FormData();
    formulario.set("familiaId", cedro);
    formulario.set("transferenciaId", ID_TRANSFERENCIA_REUNIAO);
    formulario.set("data", daquiDias(4));
    formulario.set("hora", "19:00");
    formulario.set("conduzidaPor", ID_COORDENACAO);
    formulario.set("linkReuniao", "https://meet.exemplo.invalid/cedro");
    formulario.set("opcoes", "quinta à noite ou sábado de manhã");

    await expect(
      acaoAgendarSessao(estadoInicialSessao, formulario),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    const destino = String(redirecionar.mock.calls[0]?.[0]);
    expect(destino).toMatch(/^\/sessoes-venda\/[0-9a-f-]{36}\?feito=marcada$/);
    expect(
      obterLoja().oportunidades.find((o) => o.familiaId === cedro)?.estagioP1,
    ).toBe("sessao_venda_agendada");
    const id = destino.split("/")[2]!.split("?")[0]!;
    const sessao = await obterSessaoTela(id);
    expect(sessao?.agendadaPara).toBe(
      new Date(`${daquiDias(4)}T19:00:00-03:00`).toISOString(),
    );
  });

  it("sem link, diz o campo que falta", async () => {
    const formulario = new FormData();
    formulario.set("familiaId", familiaPorNome("Cedro").id);
    formulario.set("data", daquiDias(4));
    formulario.set("hora", "19:00");
    formulario.set("conduzidaPor", ID_COORDENACAO);
    const resultado = await acaoAgendarSessao(estadoInicialSessao, formulario);
    expect(resultado.campos?.linkReuniao).toBe("Cole o link da reunião.");
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it("recusa do banco vira frase, sem código técnico", async () => {
    const formulario = new FormData();
    formulario.set("familiaId", familiaPorNome("Cedro").id);
    formulario.set("data", daquiDias(-2));
    formulario.set("hora", "10:00");
    formulario.set("conduzidaPor", ID_COORDENACAO);
    formulario.set("linkReuniao", "https://meet.exemplo.invalid/x");
    const resultado = await acaoAgendarSessao(estadoInicialSessao, formulario);
    expect(resultado.erro).toBe(
      "Esse horário já passou. Escolha uma data a partir de agora.",
    );
  });
});

describe("gravação e resumo (P29 itens 3 e 4)", () => {
  it("comercial que não conduziu: a tela nem lê a gravação", async () => {
    const usuario = await entrar("Perfil Teste Comercial", "aal2");
    const sessao = (await obterSessaoTela(GRAVACAO_GRUTA.sessaoId))!;
    expect(await lerGravacaoTela(sessao, usuario)).toEqual({
      situacao: "fechada",
    });
  });

  it("quem conduziu, em AAL1, é levado ao MFA; em AAL2, lê", async () => {
    // A coordenação trabalha sempre em AAL2 (o proxy leva ao desafio); a
    // regra da tela vale mesmo assim, para quem chegar em AAL1.
    const usuario = await entrar("Perfil Teste Coordenacao", "aal2");
    const sessao = (await obterSessaoTela(GRAVACAO_GRUTA.sessaoId))!;
    expect(sessao.podeVerGravacao).toBe(true);
    expect(await lerGravacaoTela(sessao, { ...usuario, aal: "aal1" })).toEqual({
      situacao: "mfa",
    });
    const leitura = await lerGravacaoTela(sessao, usuario);
    expect(leitura.situacao).toBe("ok");
  });

  it("resumo automático desligado sem chave; resumo à mão é salvo", async () => {
    await entrar("Perfil Teste Coordenacao", "aal2");
    const gerado = await acaoGerarResumo(GRAVACAO_GRUTA.sessaoId);
    expect(gerado).toEqual({
      ok: false,
      erro: expect.stringMatching(/desligado neste ambiente/),
    });

    const formulario = new FormData();
    formulario.set("sessaoId", GRAVACAO_GRUTA.sessaoId);
    formulario.set("duvidas", "Se a enfermeira dorme em casa\n");
    formulario.set("objecoes", "");
    formulario.set("planoInteresse", "Essencial");
    formulario.set("proximosPassos", "Mandar a proposta");
    formulario.set("origem", "pessoa");
    const resultado = await acaoSalvarResumo(estadoInicialSessao, formulario);
    expect(resultado.sucesso).toBeTruthy();
  });

  it("não autorizar apaga a transcrição", async () => {
    await entrar("Perfil Teste Coordenacao", "aal2");
    const formulario = new FormData();
    formulario.set("sessaoId", GRAVACAO_GRUTA.sessaoId);
    formulario.set("consentimento", "nao");
    formulario.set("transcricao", "qualquer coisa");
    const resultado = await acaoRegistrarGravacao(
      estadoInicialSessao,
      formulario,
    );
    expect(resultado.sucesso).toMatch(/Nada da conversa fica guardado/);
  });
});

describe("acaoRegistrarDesfecho (P25b, D-20)", () => {
  function formularioDesfecho(sessaoId: string, extra: Record<string, string>) {
    const formulario = new FormData();
    formulario.set("sessaoId", sessaoId);
    formulario.set("parceiroPresente", "");
    formulario.set("resultado", "");
    for (const [chave, valor] of Object.entries(extra)) {
      formulario.set(chave, valor);
    }
    return formulario;
  }

  async function sessaoDaIsadora() {
    const sessao = await obterSessaoTela(
      "00000000-0000-4000-8013-000000000003",
    );
    expect(sessao?.agendadaPor).toBe("isadora");
    return sessao!;
  }

  it("o comercial não registra que a reunião da Isadora aconteceu: a frase diz quem registra", async () => {
    const sessao = await sessaoDaIsadora();
    const estado = await acaoRegistrarDesfecho(
      estadoInicialSessao,
      formularioDesfecho(sessao.id, { desfecho: "realizada" }),
    );
    expect(estado.sucesso).toBeUndefined();
    expect(estado.erro).toMatch(/Só a Edilaine, a coordenação e a diretoria/);
  });

  it("a Edilaine registra realizada com o resultado: a conversa passa ao Leonardo e a frase diz isso", async () => {
    await entrar("Perfil Teste Coordenacao", "aal2");
    const sessao = await sessaoDaIsadora();
    await expect(
      acaoRegistrarDesfecho(
        estadoInicialSessao,
        formularioDesfecho(sessao.id, {
          desfecho: "realizada",
          parceiroPresente: "sim",
          resultado: "Interesse no Essencial.",
        }),
      ),
    ).rejects.toThrow(
      `NEXT_REDIRECT /sessoes-venda/${sessao.id}?feito=desfecho_leonardo`,
    );
    expect(FEITO_SESSAO["desfecho_leonardo"]).toMatch(
      /A conversa agora é do Leonardo/,
    );
    const conversa = obterLoja().conversas.find(
      (c) => c.familiaId === sessao.familiaId,
    );
    expect(conversa?.agenteEncerradoMotivo).toBe("reuniao_realizada");
    const depois = await obterSessaoTela(sessao.id);
    expect(depois).toMatchObject({
      status: "realizada",
      resultado: "Interesse no Essencial.",
      parceiroPresente: true,
      conversaCom: "leonardo",
    });
  });

  it("a falta a uma reunião da Isadora devolve a remarcação a ela, sem tarefa humana", async () => {
    await entrar("Perfil Teste Coordenacao", "aal2");
    const sessao = await sessaoDaIsadora();
    const tarefas = obterLoja().tarefas.length;
    await expect(
      acaoRegistrarDesfecho(
        estadoInicialSessao,
        formularioDesfecho(sessao.id, { desfecho: "nao_compareceu" }),
      ),
    ).rejects.toThrow(
      `NEXT_REDIRECT /sessoes-venda/${sessao.id}?feito=desfecho_isadora_remarca`,
    );
    expect(FEITO_SESSAO["desfecho_isadora_remarca"]).toMatch(
      /A Isadora vai oferecer outro horário/,
    );
    expect(obterLoja().tarefas.length).toBe(tarefas);
  });

  it("cancelar a reunião da Isadora pelo CRM é recusado, com a razão em palavras", async () => {
    const sessao = await sessaoDaIsadora();
    const estado = await acaoRegistrarDesfecho(
      estadoInicialSessao,
      formularioDesfecho(sessao.id, { desfecho: "cancelada" }),
    );
    expect(estado.erro).toMatch(/vive no Google Calendar/);
  });

  it("resultado com mais de 300 caracteres volta como erro de tela", async () => {
    await entrar("Perfil Teste Coordenacao", "aal2");
    const sessao = await sessaoDaIsadora();
    const estado = await acaoRegistrarDesfecho(
      estadoInicialSessao,
      formularioDesfecho(sessao.id, {
        desfecho: "realizada",
        resultado: "x".repeat(301),
      }),
    );
    expect(estado.erro).toMatch(/300 caracteres/);
  });
});
