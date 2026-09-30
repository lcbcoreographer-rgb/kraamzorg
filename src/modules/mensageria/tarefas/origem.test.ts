import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/db/types";
import type { TipoTarefa } from "@/lib/dados/tipos";
import { explicarTarefa } from "./origem";

const TIPOS = Constants.public.Enums.tipo_tarefa as readonly TipoTarefa[];

describe("explicarTarefa", () => {
  it("todo tipo de tarefa do banco diz de onde veio e o que fazer", () => {
    for (const tipo of TIPOS) {
      const { origem, oQueFazer } = explicarTarefa({ tipo, payload: {} });
      expect(origem.length, tipo).toBeGreaterThan(10);
      expect(oQueFazer.length, tipo).toBeGreaterThan(10);
    }
  });

  it("a ação gravada pela automação tem precedência sobre o tipo", () => {
    expect(
      explicarTarefa({
        tipo: "outro",
        payload: { acao: "justificar_freio" },
      }).origem,
    ).toMatch(/freio foi acionado/);
    expect(
      explicarTarefa({ tipo: "outro", payload: { acao: "depoimento" } }).origem,
    ).toMatch(/nota alta/);
    expect(
      explicarTarefa({ tipo: "outro", payload: { acao: "desconhecida" } })
        .origem,
    ).toBe("Aberta por alguém da equipe.");
  });

  it("sem travessão, sem meia-risca e sem número de prazo no texto", () => {
    const textos = [
      ...TIPOS.map((tipo) => explicarTarefa({ tipo, payload: {} })),
      ...[
        "justificar_freio",
        "formulario_contrato",
        "prenatal_urgente",
        "pagamento_confirmado",
        "link_pagamento",
        "relacionamento_medico",
        "depoimento",
        "indicacao",
        "escuta",
        "pesquisa",
        "evolucao_familia",
        "emitir_evolucao",
        "portal_familia",
      ].map((acao) => explicarTarefa({ tipo: "outro", payload: { acao } })),
    ].flatMap((e) => [e.origem, e.oQueFazer]);
    for (const texto of textos) {
      expect(texto).not.toMatch(/[–—]/);
      expect(texto).not.toMatch(/\d/);
    }
  });
});
