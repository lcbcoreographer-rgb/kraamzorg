// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirecionar = vi.fn((destino: string) => {
  throw new Error(`NEXT_REDIRECT ${destino}`);
});
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => redirecionar(destino),
}));

import type { SessaoUsuario } from "@/lib/auth/tipos";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { obterLoja, reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import {
  acaoAssumirTransferencia,
  acaoMarcarNaoLead,
  acaoPausarConversa,
  acaoResolverTransferencia,
  acaoRetomarAgenteComercial,
  acaoRetomarPausaManual,
} from "./acoes";

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

function sessaoDe(nome: string): SessaoUsuario {
  const usuario = USUARIOS.find((u) => u.nome === nome);
  if (!usuario) throw new Error(nome);
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
  };
}

async function logarComo(nome: string) {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(sessaoDe(nome));
}

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(async () => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  await logarComo("Perfil Teste Comercial");
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor);
  return f;
}

const idConversaAurora = "00000000-0000-4000-8009-000000000001"; // lead, sem pausa nem handoff
const idConversaHorizonte = "00000000-0000-4000-8009-000000000007"; // humano_comercial (contratar)
const idTransferenciaHorizonte = "00000000-0000-4000-8010-000000000003"; // assumido
const idConversaCedro = "00000000-0000-4000-8009-000000000005"; // pausada, handoff aberto
const idTransferenciaCedro = "00000000-0000-4000-8010-000000000002"; // aberto, condicao_comercial

const idConversaBruma = "00000000-0000-4000-8009-000000000003"; // lead, sem pausa, handoff de perda aberto
const idTransferenciaBruma = "00000000-0000-4000-8010-000000000001"; // aberto, perda

describe("acaoAssumirTransferencia: assumir pausa a Isadora (aceite do P27)", () => {
  it("assumir a transferência grava a pausa da Isadora na conversa, pelo prazo do parâmetro", async () => {
    const antes = obterLoja().conversas.find((c) => c.id === idConversaBruma);
    expect(antes?.agentePausadoAte).toBeNull();

    const resultado = await acaoAssumirTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaBruma,
        conversaId: idConversaBruma,
      }),
    );

    expect(resultado.erro).toBeUndefined();
    const depois = obterLoja().conversas.find((c) => c.id === idConversaBruma);
    expect(depois?.agentePausadoAte).toBeTruthy();
    const horas = obterLoja().parametros.find(
      (p) => p.chave === "agente_pausa_humano_horas",
    )?.valor as number;
    const restanteH =
      (new Date(depois!.agentePausadoAte!).getTime() - Date.now()) / 3_600_000;
    expect(restanteH).toBeGreaterThan(horas - 0.1);
    expect(restanteH).toBeLessThanOrEqual(horas);
  });

  it("a duração da pausa segue o parâmetro, nunca um número fixo no código", async () => {
    const parametro = obterLoja().parametros.find(
      (p) => p.chave === "agente_pausa_humano_horas",
    );
    parametro!.valor = 6;
    await acaoPausarConversa(
      {},
      formulario({ conversaId: idConversaAurora, origem: "assumir" }),
    );
    const ate = obterLoja().conversas.find(
      (c) => c.id === idConversaAurora,
    )?.agentePausadoAte;
    const restanteH = (new Date(ate!).getTime() - Date.now()) / 3_600_000;
    expect(restanteH).toBeGreaterThan(5.9);
    expect(restanteH).toBeLessThanOrEqual(6);
  });

  it("vindo da fila (abrirConversa=1), leva direto para a conversa", async () => {
    await expect(
      acaoAssumirTransferencia(
        {},
        formulario({
          transferenciaId: idTransferenciaBruma,
          conversaId: idConversaBruma,
          abrirConversa: "1",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT /conversas/${idConversaBruma}`);
  });

  it("em humano_comercial não grava pausa: a Isadora já não responde ali", async () => {
    const l = obterLoja();
    const t = l.transferencias.find((x) => x.id === idTransferenciaHorizonte)!;
    t.status = "aberto";
    const resultado = await acaoAssumirTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaHorizonte,
        conversaId: idConversaHorizonte,
      }),
    );
    expect(resultado.sucesso).toContain("não volta a responder");
    const conversa = l.conversas.find((c) => c.id === idConversaHorizonte);
    expect(conversa?.agentePausadoAte).toBeNull();
    expect(conversa?.agenteEncerradoEm).toBeTruthy();
  });
});

describe("acaoAssumirTransferencia (fila, P22)", () => {
  it("assume uma transferência aberta", async () => {
    const resultado = await acaoAssumirTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaCedro,
        conversaId: idConversaCedro,
      }),
    );
    expect(resultado.sucesso).toBeTruthy();
    const t = obterLoja().transferencias.find(
      (x) => x.id === idTransferenciaCedro,
    );
    expect(t?.status).toBe("assumido");
  });

  it("uma transferência já resolvida ou inexistente é recusada", async () => {
    const resultado = await acaoAssumirTransferencia(
      {},
      formulario({ transferenciaId: "não-existe" }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});

describe("acaoPausarConversa (assumir/pausar sem handoff, C5)", () => {
  it("'assumir' pausa a conversa e grava o motivo com o nome de quem pediu", async () => {
    const resultado = await acaoPausarConversa(
      {},
      formulario({ conversaId: idConversaAurora, origem: "assumir" }),
    );
    expect(resultado.sucesso).toBeTruthy();
    const conversa = obterLoja().conversas.find(
      (c) => c.id === idConversaAurora,
    );
    expect(conversa?.agentePausadoAte).toBeTruthy();
    const { pausaMotivoDemonstracao } = await import("./repositorio");
    expect(pausaMotivoDemonstracao(idConversaAurora)).toContain(
      "Perfil Teste Comercial",
    );
  });

  it("'pausar' também pausa, com texto diferente de 'assumir'", async () => {
    await acaoPausarConversa(
      {},
      formulario({ conversaId: idConversaAurora, origem: "pausar" }),
    );
    const { pausaMotivoDemonstracao } = await import("./repositorio");
    expect(pausaMotivoDemonstracao(idConversaAurora)).toContain("Pausada por");
  });

  it("origem inválida é recusada pela validação, sem gravar nada", async () => {
    const resultado = await acaoPausarConversa(
      {},
      formulario({ conversaId: idConversaAurora, origem: "outra-coisa" }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(
      obterLoja().conversas.find((c) => c.id === idConversaAurora)
        ?.agentePausadoAte,
    ).toBeNull();
  });
});

describe("acaoRetomarPausaManual (Devolver agora)", () => {
  it("limpa a pausa manual de uma conversa", async () => {
    await acaoPausarConversa(
      {},
      formulario({ conversaId: idConversaAurora, origem: "assumir" }),
    );
    const resultado = await acaoRetomarPausaManual(
      {},
      formulario({ conversaId: idConversaAurora }),
    );
    expect(resultado.sucesso).toBeTruthy();
    expect(
      obterLoja().conversas.find((c) => c.id === idConversaAurora)
        ?.agentePausadoAte,
    ).toBeNull();
  });
});

describe("acaoRetomarAgenteComercial (Devolver à Isadora, PRD 11.7 D-17)", () => {
  it("limpa agenteEncerradoEm e agenteEncerradoMotivo de uma conversa humano_comercial", async () => {
    const antes = obterLoja().conversas.find(
      (c) => c.id === idConversaHorizonte,
    );
    expect(antes?.agenteEncerradoEm).toBeTruthy();

    const resultado = await acaoRetomarAgenteComercial(
      {},
      formulario({ conversaId: idConversaHorizonte }),
    );

    expect(resultado.sucesso).toBeTruthy();
    const depois = obterLoja().conversas.find(
      (c) => c.id === idConversaHorizonte,
    );
    expect(depois?.agenteEncerradoEm).toBeNull();
    expect(depois?.agenteEncerradoMotivo).toBeNull();
  });

  it("grava no log: evento na linha do tempo da família e aviso do sistema na conversa", async () => {
    const l = obterLoja();
    const familiaId = l.conversas.find(
      (c) => c.id === idConversaHorizonte,
    )!.familiaId!;
    const eventosAntes = l.eventos.filter(
      (e) => e.familiaId === familiaId,
    ).length;

    await acaoRetomarAgenteComercial(
      {},
      formulario({ conversaId: idConversaHorizonte }),
    );

    const eventos = l.eventos.filter((e) => e.familiaId === familiaId);
    expect(eventos).toHaveLength(eventosAntes + 1);
    expect(eventos.at(-1)?.tipo).toBe("agente_retomado");
    const aviso = l.mensagens
      .filter((m) => m.conversaId === idConversaHorizonte)
      .at(-1);
    expect(aviso?.enviadoPor).toBe("sistema");
    expect(aviso?.tipo).toBe("sistema");
    expect(aviso?.conteudo).toContain(
      "Perfil Teste Comercial devolveu a conversa à Isadora",
    );
  });

  it("conversa que não está em humano_comercial é recusada, sem gravar nada", async () => {
    const eventosAntes = obterLoja().eventos.length;
    const resultado = await acaoRetomarAgenteComercial(
      {},
      formulario({ conversaId: idConversaAurora }),
    );
    expect(resultado.erro).toBeTruthy();
    expect(obterLoja().eventos).toHaveLength(eventosAntes);
  });
});

describe("acaoResolverTransferencia (Marcar como resolvida, fluxos.md)", () => {
  it("marca resolvida com o desfecho, mas nunca reabre a conversa para a Isadora", async () => {
    const resultado = await acaoResolverTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaHorizonte,
        desfecho: "condicao_negociada",
        conversaId: idConversaHorizonte,
      }),
    );
    expect(resultado.sucesso).toBeTruthy();
    const t = obterLoja().transferencias.find(
      (x) => x.id === idTransferenciaHorizonte,
    );
    expect(t?.status).toBe("resolvido");
    // Resolver não chama retomar_agente: a conversa continua humano_comercial.
    const conversa = obterLoja().conversas.find(
      (c) => c.id === idConversaHorizonte,
    );
    expect(conversa?.agenteEncerradoEm).toBeTruthy();
  });

  it("desfecho inválido é recusado", async () => {
    const resultado = await acaoResolverTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaCedro,
        desfecho: "qualquer-coisa",
      }),
    );
    expect(resultado.erro).toBeTruthy();
  });

  it("resolver duas vezes a mesma transferência recusa a segunda", async () => {
    await acaoResolverTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaCedro,
        desfecho: "sem_retorno",
      }),
    );
    const resultado = await acaoResolverTransferencia(
      {},
      formulario({
        transferenciaId: idTransferenciaCedro,
        desfecho: "sem_retorno",
      }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});

describe("acaoMarcarNaoLead", () => {
  it("muda a classificação da conversa", async () => {
    const resultado = await acaoMarcarNaoLead(
      {},
      formulario({ conversaId: idConversaAurora, classificacao: "fornecedor" }),
    );
    expect(resultado.sucesso).toBeTruthy();
    expect(
      obterLoja().conversas.find((c) => c.id === idConversaAurora)
        ?.classificacao,
    ).toBe("fornecedor");
  });

  it("classificação fora da lista (ex: 'lead') é recusada pela validação", async () => {
    const resultado = await acaoMarcarNaoLead(
      {},
      formulario({ conversaId: idConversaAurora, classificacao: "lead" }),
    );
    expect(resultado.erro).toBeTruthy();
  });
});
