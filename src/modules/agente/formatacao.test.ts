import { describe, expect, it } from "vitest";
import {
  pausaVenceuComTransferenciaAberta,
  primeiroNome,
  quandoRecebida,
  quemConduzAConversa,
  rotuloDaSituacao,
  situacaoDaConversa,
  textoVoltaDaPausa,
} from "./formatacao";

const AGORA = new Date("2026-09-24T15:25:00-03:00");

describe("situacaoDaConversa (P27 item 1, PRD 7.1 e 11.7)", () => {
  it("classificação fora de lead/cliente/nao_classificado é 'nao_lead', mesmo com pausa ou encerramento", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "fornecedor",
          agenteEncerradoEm: null,
          agentePausadoAte: null,
        },
        AGORA,
      ),
    ).toBe("nao_lead");
  });

  it("lead com agenteEncerradoEm preenchido é 'equipe' (humano_comercial, D-17)", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "lead",
          agenteEncerradoEm: "2026-09-24T14:02:00-03:00",
          agentePausadoAte: null,
        },
        AGORA,
      ),
    ).toBe("equipe");
  });

  it("equipe tem precedência sobre pausa (mesmo com agentePausadoAte no futuro)", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "lead",
          agenteEncerradoEm: "2026-09-24T14:02:00-03:00",
          agentePausadoAte: "2026-09-25T00:00:00-03:00",
        },
        AGORA,
      ),
    ).toBe("equipe");
  });

  it("lead com agentePausadoAte no futuro é 'pausada'", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "lead",
          agenteEncerradoEm: null,
          agentePausadoAte: "2026-09-24T18:00:00-03:00",
        },
        AGORA,
      ),
    ).toBe("pausada");
  });

  it("agentePausadoAte no passado não conta como pausada: volta a 'isadora'", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "cliente",
          agenteEncerradoEm: null,
          agentePausadoAte: "2026-09-24T10:00:00-03:00",
        },
        AGORA,
      ),
    ).toBe("isadora");
  });

  it("lead sem pausa nem encerramento é 'isadora'", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "nao_classificado",
          agenteEncerradoEm: null,
          agentePausadoAte: null,
        },
        AGORA,
      ),
    ).toBe("isadora");
  });
});

describe("situacaoDaConversa com o freio (DESIGN.md 11.8, PRD 8.3)", () => {
  it("bloqueio total vence pausa, encerramento e classificação: 'freio'", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "fornecedor",
          agenteEncerradoEm: "2026-09-24T14:02:00-03:00",
          agentePausadoAte: "2026-09-24T18:00:00-03:00",
        },
        AGORA,
        "bloqueio_total",
      ),
    ).toBe("freio");
  });

  it("encerrado sensível também desliga a Isadora", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "lead",
          agenteEncerradoEm: null,
          agentePausadoAte: null,
        },
        AGORA,
        "encerrado_sensivel",
      ),
    ).toBe("freio");
  });

  it("freio em atenção não desliga a Isadora", () => {
    expect(
      situacaoDaConversa(
        {
          classificacao: "lead",
          agenteEncerradoEm: null,
          agentePausadoAte: null,
        },
        AGORA,
        "atencao",
      ),
    ).toBe("isadora");
  });
});

describe("primeiroNome", () => {
  it("devolve o primeiro nome de um nome composto", () => {
    expect(primeiroNome("Bianca Teste Dália")).toBe("Bianca");
  });

  it("sem nome, devolve o texto padrão", () => {
    expect(primeiroNome(null)).toBe("a família");
  });
});

describe("pausaVenceuComTransferenciaAberta (PRD 11.7, faixa vermelha)", () => {
  const agora = new Date("2026-09-24T15:00:00.000Z");

  it("pausa vencida com transferência aberta: vermelho", () => {
    expect(
      pausaVenceuComTransferenciaAberta(
        {
          agentePausadoAte: "2026-09-24T14:00:00.000Z",
          agenteEncerradoEm: null,
        },
        true,
        agora,
      ),
    ).toBe(true);
  });

  it("pausa ainda valendo, sem transferência ou em humano_comercial: nada", () => {
    expect(
      pausaVenceuComTransferenciaAberta(
        {
          agentePausadoAte: "2026-09-24T16:00:00.000Z",
          agenteEncerradoEm: null,
        },
        true,
        agora,
      ),
    ).toBe(false);
    expect(
      pausaVenceuComTransferenciaAberta(
        {
          agentePausadoAte: "2026-09-24T14:00:00.000Z",
          agenteEncerradoEm: null,
        },
        false,
        agora,
      ),
    ).toBe(false);
    expect(
      pausaVenceuComTransferenciaAberta(
        {
          agentePausadoAte: "2026-09-24T14:00:00.000Z",
          agenteEncerradoEm: "2026-09-24T13:00:00.000Z",
        },
        true,
        agora,
      ),
    ).toBe(false);
  });
});

describe("textoVoltaDaPausa (telas.md C5, 'volta às 18:00')", () => {
  const agora = new Date("2026-09-24T15:00:00.000Z"); // 12:00 em Brasília

  it("mesmo dia: só a hora, no fuso de Brasília", () => {
    expect(textoVoltaDaPausa("2026-09-24T21:00:00.000Z", agora)).toBe(
      "volta às 18:00",
    );
  });

  it("outro dia: dia e hora", () => {
    expect(textoVoltaDaPausa("2026-09-26T12:00:00.000Z", agora)).toBe(
      "volta em 26/09 às 09:00",
    );
  });

  it("sem pausa: null", () => {
    expect(textoVoltaDaPausa(null, agora)).toBeNull();
  });
});

describe("primeiroNome com nome de família ou telefone", () => {
  it("'Família Teste Aurora' e telefone viram 'a família'", () => {
    expect(primeiroNome("Família Teste Aurora")).toBe("a família");
    expect(primeiroNome("+55 11 90000-0029")).toBe("a família");
  });
});

describe("quem conduz a conversa (v4.3, D-20)", () => {
  const base = {
    classificacao: "lead" as const,
    agenteEncerradoEm: null,
    agentePausadoAte: null,
  };

  it("a lista chama de Leonardo conduzindo a conversa que a reunião realizada encerrou para a Isadora", () => {
    expect(rotuloDaSituacao("equipe", "reuniao_realizada")).toBe(
      "Leonardo conduzindo",
    );
    expect(rotuloDaSituacao("equipe", null)).toBe("Com a equipe");
    expect(rotuloDaSituacao("isadora", null)).toBe("Isadora conduzindo");
  });

  it("Isadora, Leonardo (humano_comercial), equipe (pausada) e ninguém (fora de lead e cliente)", () => {
    expect(quemConduzAConversa(base, AGORA)).toBe("isadora");
    expect(
      quemConduzAConversa(
        { ...base, agenteEncerradoEm: "2026-09-24T14:02:00-03:00" },
        AGORA,
      ),
    ).toBe("leonardo");
    expect(
      quemConduzAConversa(
        { ...base, agentePausadoAte: "2026-09-25T15:25:00-03:00" },
        AGORA,
      ),
    ).toBe("equipe");
    expect(
      quemConduzAConversa({ ...base, classificacao: "fornecedor" }, AGORA),
    ).toBeNull();
  });
});

describe("quandoRecebida (hora do relato com o dia quando não é hoje)", () => {
  const agora = new Date("2026-09-30T15:25:00-03:00");

  it("no mesmo dia, só a hora", () => {
    expect(quandoRecebida("2026-09-30T11:48:00-03:00", agora)).toBe("às 11:48");
  });

  it("no dia anterior, diz ontem", () => {
    expect(quandoRecebida("2026-09-29T23:10:00-03:00", agora)).toBe(
      "ontem às 23:10",
    );
  });

  it("antes disso, leva a data curta", () => {
    expect(quandoRecebida("2026-09-28T14:48:00-03:00", agora)).toBe(
      "em 28/09 às 14:48",
    );
  });

  it("usa o dia de Brasília, não o do UTC", () => {
    // 01:30 UTC de 30/09 ainda é 22:30 de 29/09 em Brasília.
    expect(quandoRecebida("2026-09-30T01:30:00.000Z", agora)).toBe(
      "ontem às 22:30",
    );
  });

  it("vazio para data ausente ou inválida", () => {
    expect(quandoRecebida(null, agora)).toBe("");
    expect(quandoRecebida("não é data", agora)).toBe("");
  });
});
