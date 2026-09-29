import { describe, expect, it } from "vitest";
import { fraseDoDia } from "./frase-do-dia";

describe("fraseDoDia (DESIGN.md 11.4, voz.md seção 5)", () => {
  it("transferências esperando e tarefas de hoje, por extenso", () => {
    expect(
      fraseDoDia({
        transferenciasEsperando: 3,
        transferenciasComEquipe: 1,
        tarefasAtrasadas: 0,
        tarefasHoje: 4,
      }),
    ).toBe(
      "Três transferências esperam alguém da equipe e quatro tarefas vencem hoje.",
    );
  });

  it("singular concorda o verbo", () => {
    expect(
      fraseDoDia({
        transferenciasEsperando: 1,
        transferenciasComEquipe: 0,
        tarefasAtrasadas: 0,
        tarefasHoje: 1,
      }),
    ).toBe(
      "Uma transferência espera alguém da equipe e uma tarefa vence hoje.",
    );
  });

  it("só transferências já assumidas: diz que estão com a equipe", () => {
    expect(
      fraseDoDia({
        transferenciasEsperando: 0,
        transferenciasComEquipe: 2,
        tarefasAtrasadas: 0,
        tarefasHoje: 0,
      }),
    ).toBe(
      "Duas transferências já estão com alguém da equipe e nenhuma tarefa vence hoje.",
    );
  });

  it("atrasadas e de hoje viram duas frases, sem acumular 'e'", () => {
    expect(
      fraseDoDia({
        transferenciasEsperando: 0,
        transferenciasComEquipe: 0,
        tarefasAtrasadas: 2,
        tarefasHoje: 12,
      }),
    ).toBe(
      "Nenhuma transferência espera por você. Duas tarefas estão atrasadas e 12 vencem hoje.",
    );
  });
});
