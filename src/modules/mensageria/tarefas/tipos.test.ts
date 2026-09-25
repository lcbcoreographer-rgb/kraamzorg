import { describe, expect, it } from "vitest";
import type { Tarefa } from "@/lib/dados/tipos";
import { apenasAbertas, lerPayloadTarefa, paraTarefaTela } from "./tipos";

describe("lerPayloadTarefa", () => {
  it("lê camelCase e snake_case, ignorando campo vazio", () => {
    expect(
      lerPayloadTarefa({ textoSugerido: "Oi", telefoneE164: "+5511999998888" }),
    ).toEqual({
      textoSugerido: "Oi",
      telefoneE164: "+5511999998888",
      mensagemChave: undefined,
      contexto: undefined,
    });
    expect(
      lerPayloadTarefa({
        texto_sugerido: "Oi",
        telefone_e164: "+5511999998888",
      }),
    ).toEqual({
      textoSugerido: "Oi",
      telefoneE164: "+5511999998888",
      mensagemChave: undefined,
      contexto: undefined,
    });
  });

  it("payload vazio, nulo ou de outro formato vira objeto vazio", () => {
    expect(lerPayloadTarefa({})).toEqual({});
    expect(lerPayloadTarefa(null)).toEqual({});
    expect(lerPayloadTarefa([1, 2])).toEqual({});
    expect(lerPayloadTarefa({ textoSugerido: "   " })).toEqual({});
  });
});

describe("paraTarefaTela", () => {
  const base: Tarefa = {
    id: "t1",
    tipo: "nutricao_contato",
    titulo: "Retomar contato",
    prioridade: "alta",
    status: "aberta",
    venceEm: null,
    familiaId: "fam-1",
    nomeFamilia: "Família Teste Estrela",
    responsavelId: null,
    papelResponsavel: "comercial",
    payload: {},
    criadoEm: "2026-09-24T10:00:00-03:00",
  };

  it("temAcaoWhatsApp só quando tem texto e telefone", () => {
    expect(paraTarefaTela(base).temAcaoWhatsApp).toBe(false);
    expect(
      paraTarefaTela({
        ...base,
        payload: { textoSugerido: "Oi", telefoneE164: "+5511999998888" },
      }).temAcaoWhatsApp,
    ).toBe(true);
    expect(
      paraTarefaTela({ ...base, payload: { textoSugerido: "Oi" } })
        .temAcaoWhatsApp,
    ).toBe(false);
  });
});

describe("apenasAbertas", () => {
  it("mantém só aberta e em_andamento", () => {
    const tarefas: Tarefa[] = (
      ["aberta", "em_andamento", "concluida", "cancelada"] as const
    ).map((status, i) => ({
      id: `t${i}`,
      tipo: "outro",
      titulo: "t",
      prioridade: "normal",
      status,
      venceEm: null,
      familiaId: null,
      nomeFamilia: null,
      responsavelId: null,
      papelResponsavel: null,
      payload: {},
      criadoEm: "2026-09-24T10:00:00-03:00",
    }));
    expect(apenasAbertas(tarefas).map((t) => t.status)).toEqual([
      "aberta",
      "em_andamento",
    ]);
  });
});
