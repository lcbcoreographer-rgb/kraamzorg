import { describe, expect, it } from "vitest";
import { grupoDaOcorrencia, prazoDaOcorrencia } from "./prazo";

const AGORA = new Date("2026-09-30T15:00:00Z");

const base = {
  status: "aberta" as const,
  vencida: false,
  slaVenceEm: null as string | null,
  tipo: "reclamacao" as const,
  criadoEm: "2026-09-29T12:00:00Z",
};

describe("grupoDaOcorrencia", () => {
  it("separa vencidas, dentro do prazo e fechadas", () => {
    expect(grupoDaOcorrencia({ status: "aberta", vencida: true })).toBe(
      "vencidas",
    );
    expect(
      grupoDaOcorrencia({ status: "em_acompanhamento", vencida: false }),
    ).toBe("no_prazo");
    expect(grupoDaOcorrencia({ status: "resolvida", vencida: true })).toBe(
      "fechadas",
    );
    expect(grupoDaOcorrencia({ status: "encerrada", vencida: false })).toBe(
      "fechadas",
    );
  });
});

describe("prazoDaOcorrencia", () => {
  it("vencida: a distância em frase e a data exata embaixo", () => {
    const prazo = prazoDaOcorrencia(
      { ...base, vencida: true, slaVenceEm: "2026-09-30T09:00:00Z" },
      AGORA,
    );
    expect(prazo).toEqual({
      tom: "alerta",
      frase: "Venceu há 6 h",
      data: "30/09/2026, 06:00",
      rotuloData: "Prazo era",
    });
  });

  it("dentro do prazo: aviso só quando falta menos de um dia", () => {
    expect(
      prazoDaOcorrencia({ ...base, slaVenceEm: "2026-09-30T20:00:00Z" }, AGORA),
    ).toMatchObject({ tom: "aviso", frase: "Responder em 5 h" });
    expect(
      prazoDaOcorrencia({ ...base, slaVenceEm: "2026-10-02T15:00:00Z" }, AGORA),
    ).toMatchObject({ tom: "neutro", frase: "Responder em 2 dias" });
  });

  it("sem prazo e fechada ficam neutras", () => {
    expect(prazoDaOcorrencia(base, AGORA)).toMatchObject({
      tom: "neutro",
      frase: "Sem prazo de resposta",
      data: null,
    });
    expect(
      prazoDaOcorrencia(
        {
          ...base,
          status: "resolvida",
          vencida: true,
          slaVenceEm: "2026-09-28T15:00:00Z",
        },
        AGORA,
      ),
    ).toMatchObject({ tom: "neutro", frase: "Fechada" });
  });

  it("intercorrência: sem relógio e sem vermelho, com a hora em que foi aberta", () => {
    const prazo = prazoDaOcorrencia(
      {
        ...base,
        tipo: "intercorrencia",
        vencida: true,
        slaVenceEm: "2026-09-30T09:00:00Z",
      },
      AGORA,
    );
    expect(prazo.tom).toBe("sensivel");
    expect(prazo.frase).toBe("Ainda sem resposta da equipe");
    expect(prazo.frase).not.toMatch(/venceu|vence/i);
    expect(prazo.rotuloData).toBe("Aberta em");
  });
});
