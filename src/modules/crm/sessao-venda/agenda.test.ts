import { describe, expect, it } from "vitest";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";
import {
  fraseAgenda,
  horaBrasilia,
  quandoEmFrase,
  quandoSessao,
  rotuloDia,
  separarAgenda,
} from "./agenda";

// Terça, 29/09/2026, 12:00 em Brasília.
const AGORA = new Date("2026-09-29T15:00:00Z");

function sessao(parcial: Partial<SessaoVenda>): SessaoVenda {
  return {
    id: crypto.randomUUID(),
    familiaId: "f",
    nomeFamilia: "Família Teste Dália",
    estadoSensivel: "normal",
    dpp: null,
    dataNascimento: null,
    agendadaPara: null,
    status: "agendada",
    realizadaEm: null,
    linkReuniao: null,
    opcoesInformadas: null,
    parceiroPresente: null,
    conduzidaPor: null,
    conduzidaPorNome: null,
    criadoEm: "2026-09-20T12:00:00Z",
    podeVerGravacao: false,
    gravacaoRegistrada: null,
    ...parcial,
  };
}

describe("dia e hora no fuso de Brasília", () => {
  it("hora em 24 h", () => {
    expect(horaBrasilia("2026-09-29T22:00:00Z")).toBe("19:00");
  });

  it("hoje, amanhã, ontem e o dia da semana com a data", () => {
    expect(rotuloDia("2026-09-29T22:00:00Z", AGORA)).toBe("Hoje");
    expect(rotuloDia("2026-09-30T13:00:00Z", AGORA)).toBe("Amanhã");
    expect(rotuloDia("2026-09-28T13:00:00Z", AGORA)).toBe("Ontem");
    expect(rotuloDia("2026-10-01T22:00:00Z", AGORA)).toBe("Quinta, 01/10");
    // 01:30 UTC do dia 30 ainda é dia 29 em Brasília.
    expect(rotuloDia("2026-09-30T01:30:00Z", AGORA)).toBe("Hoje");
  });

  it("quando, no meio da frase, com o artigo certo", () => {
    expect(quandoEmFrase("2026-10-01T22:00:00Z", AGORA)).toBe(
      "na quinta, 01/10, às 19:00",
    );
    expect(quandoEmFrase("2026-10-03T13:00:00Z", AGORA)).toBe(
      "no sábado, 03/10, às 10:00",
    );
    expect(quandoEmFrase("2026-09-29T22:00:00Z", AGORA)).toBe("hoje, às 19:00");
  });

  it("quando, em frase", () => {
    expect(quandoSessao("2026-10-01T22:00:00Z", AGORA)).toBe(
      "Quinta, 01/10, às 19:00",
    );
  });
});

describe("separarAgenda e fraseAgenda", () => {
  it("separa o que espera registro, as próximas por dia e as anteriores", () => {
    const passou = sessao({ agendadaPara: "2026-09-29T13:00:00Z" });
    const hoje = sessao({ agendadaPara: "2026-09-29T22:00:00Z" });
    const quinta = sessao({ agendadaPara: "2026-10-01T22:00:00Z" });
    const realizada = sessao({
      status: "realizada",
      agendadaPara: "2026-09-24T13:00:00Z",
    });
    const agenda = separarAgenda([quinta, realizada, hoje, passou], AGORA);

    expect(agenda.pedemRegistro.map((s) => s.id)).toEqual([passou.id]);
    expect(agenda.proximas.map((g) => g.titulo)).toEqual([
      "Hoje",
      "Quinta, 01/10",
    ]);
    expect(agenda.anteriores.map((s) => s.id)).toEqual([realizada.id]);
    expect(fraseAgenda(agenda, AGORA)).toBe(
      "Uma conversa marcada para hoje. Uma conversa já passou do horário e espera o registro de como foi.",
    );
  });

  it("sem conversa hoje, diz qual é a próxima e com qual família", () => {
    const agenda = separarAgenda(
      [sessao({ agendadaPara: "2026-10-01T22:00:00Z" })],
      AGORA,
    );
    expect(fraseAgenda(agenda, AGORA)).toBe(
      "Nenhuma conversa hoje. A próxima é na quinta, 01/10, às 19:00, com a Família Teste Dália.",
    );
  });

  it("agenda vazia", () => {
    expect(fraseAgenda(separarAgenda([], AGORA), AGORA)).toBe(
      "Nenhuma conversa marcada pela frente.",
    );
  });
});
