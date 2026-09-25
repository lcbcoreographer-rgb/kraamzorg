import { describe, expect, it } from "vitest";
import {
  pausaVenceuComTransferenciaAberta,
  primeiroNome,
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
