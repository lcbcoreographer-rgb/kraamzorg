import { describe, expect, it } from "vitest";
import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";
import {
  agruparConsultas,
  frasePorOndeParou,
  quemChegouAoAlerta,
} from "./agrupar";

function consulta(
  nome: string,
  extra: Partial<ConsultaPrenatalResumo> = {},
): ConsultaPrenatalResumo {
  return {
    consultaId: `c-${nome}`,
    familiaId: `f-${nome}`,
    nome,
    status: "pendente",
    urgente: false,
    agendadaPara: null,
    realizadaEm: null,
    iniciadaEm: null,
    etapa: null,
    parouEm: null,
    respondidos: 0,
    dpp: null,
    ig: null,
    igSemanas: null,
    chegouAlerta: false,
    cidade: null,
    uf: null,
    estagioP2: null,
    ...extra,
  };
}

describe("agruparConsultas", () => {
  it("urgentes primeiro, mesmo já agendadas; concluídas por último", () => {
    const g = agruparConsultas([
      consulta("A", {
        status: "agendada",
        urgente: true,
        agendadaPara: "2026-10-01T13:00:00Z",
      }),
      consulta("B"),
      consulta("C", {
        status: "agendada",
        agendadaPara: "2026-10-03T13:00:00Z",
      }),
      consulta("D", {
        status: "agendada",
        agendadaPara: "2026-10-02T13:00:00Z",
      }),
      consulta("E", {
        status: "realizada",
        realizadaEm: "2026-09-20T13:00:00Z",
      }),
      consulta("F", {
        status: "realizada",
        realizadaEm: "2026-09-25T13:00:00Z",
      }),
      consulta("G", {
        status: "realizada",
        urgente: true,
        realizadaEm: "2026-09-10T13:00:00Z",
      }),
    ]);
    expect(g.urgentes.map((c) => c.nome)).toEqual(["A"]);
    expect(g.paraAgendar.map((c) => c.nome)).toEqual(["B"]);
    expect(g.agendadas.map((c) => c.nome)).toEqual(["D", "C"]); // pela data da consulta
    expect(g.concluidas.map((c) => c.nome)).toEqual(["F", "E", "G"]); // a mais recente primeiro
  });

  it("consulta cancelada ou não realizada não aparece na lista", () => {
    const g = agruparConsultas([
      consulta("X", { status: "cancelada" }),
      consulta("Y", { status: "nao_realizada" }),
    ]);
    expect(Object.values(g).flat()).toHaveLength(0);
  });
});

describe("quemChegouAoAlerta", () => {
  it("só quem chegou às semanas do parâmetro e ainda não concluiu a entrevista", () => {
    const lista = quemChegouAoAlerta([
      consulta("A", { chegouAlerta: true }),
      consulta("B", { chegouAlerta: true, status: "agendada" }),
      consulta("C", { chegouAlerta: true, status: "realizada" }),
      consulta("D"),
    ]);
    expect(lista.map((c) => c.nome)).toEqual(["A", "B"]);
  });
});

describe("frasePorOndeParou", () => {
  const formatar = (v: string) => `formatado(${v})`;
  it("entrevista não iniciada, em andamento e concluída", () => {
    expect(frasePorOndeParou(consulta("A"), 8, formatar)).toBe(
      "Entrevista não iniciada",
    );
    expect(
      frasePorOndeParou(
        consulta("A", { iniciadaEm: "2026-09-29T10:00:00Z" }),
        8,
        formatar,
      ),
    ).toBe("Entrevista em andamento");
    expect(
      frasePorOndeParou(consulta("A", { status: "realizada" }), 8, formatar),
    ).toBe("Entrevista concluída");
  });
  it("diz a etapa e quando parou", () => {
    expect(
      frasePorOndeParou(
        consulta("A", {
          etapa: 4,
          parouEm: "2026-09-29T20:10:00Z",
          iniciadaEm: "2026-09-29T20:00:00Z",
        }),
        8,
        formatar,
      ),
    ).toBe("Etapa 4 de 8, parou em formatado(2026-09-29T20:10:00Z)");
    expect(frasePorOndeParou(consulta("A", { etapa: 2 }), 8, formatar)).toBe(
      "Etapa 2 de 8",
    );
  });
});
