import { describe, expect, it } from "vitest";
import type { Tarefa } from "@/lib/dados/tipos";
import { agruparTarefas, textoPrazo } from "./agrupar";

const AGORA = new Date("2026-09-24T15:00:00-03:00");

function tarefa(parcial: Partial<Tarefa> & Pick<Tarefa, "id">): Tarefa {
  return {
    tipo: "followup_comercial",
    titulo: "Tarefa de teste",
    prioridade: "normal",
    status: "aberta",
    venceEm: null,
    familiaId: null,
    nomeFamilia: null,
    responsavelId: null,
    papelResponsavel: null,
    payload: {},
    criadoEm: AGORA.toISOString(),
    ...parcial,
  };
}

describe("agruparTarefas", () => {
  it("agrupa em vencida, vence_hoje, a_vencer e sem_prazo, só com os baldes usados", () => {
    const grupos = agruparTarefas(
      [
        tarefa({ id: "vencida", venceEm: "2026-09-24T10:00:00-03:00" }),
        tarefa({ id: "hoje", venceEm: "2026-09-24T20:00:00-03:00" }),
        tarefa({ id: "amanha", venceEm: "2026-09-25T10:00:00-03:00" }),
        tarefa({ id: "sem-prazo", venceEm: null }),
      ],
      AGORA,
    );

    expect(grupos.map((g) => g.balde)).toEqual([
      "vencida",
      "vence_hoje",
      "a_vencer",
      "sem_prazo",
    ]);
    expect(grupos.find((g) => g.balde === "vencida")?.tarefas.map((t) => t.id)).toEqual([
      "vencida",
    ]);
  });

  it("dentro do balde, ordena por prioridade e depois por vencimento mais cedo", () => {
    const grupos = agruparTarefas(
      [
        tarefa({ id: "normal-cedo", prioridade: "normal", venceEm: "2026-09-25T09:00:00-03:00" }),
        tarefa({ id: "maxima", prioridade: "maxima", venceEm: "2026-09-25T18:00:00-03:00" }),
        tarefa({ id: "alta", prioridade: "alta", venceEm: "2026-09-25T10:00:00-03:00" }),
      ],
      AGORA,
    );
    const aVencer = grupos.find((g) => g.balde === "a_vencer");
    expect(aVencer?.tarefas.map((t) => t.id)).toEqual(["maxima", "alta", "normal-cedo"]);
  });

  it("sem tarefas, devolve lista vazia (a tela mostra o estado vazio)", () => {
    expect(agruparTarefas([], AGORA)).toEqual([]);
  });
});

describe("textoPrazo", () => {
  it("null sem vencimento", () => {
    expect(textoPrazo(null, AGORA)).toBeNull();
  });

  it("minutos, para dentro de uma hora", () => {
    expect(textoPrazo("2026-09-24T15:22:00-03:00", AGORA)).toBe("vence em 22 min");
    expect(textoPrazo("2026-09-24T14:52:00-03:00", AGORA)).toBe("venceu há 8 min");
  });

  it("horas, para dentro do mesmo dia", () => {
    expect(textoPrazo("2026-09-24T20:00:00-03:00", AGORA)).toBe("vence em 5 h");
  });

  it("data e hora completas, para mais de um dia de distância", () => {
    expect(textoPrazo("2026-09-30T10:00:00-03:00", AGORA)).toMatch(/^até 30\/09\/2026/);
  });
});
