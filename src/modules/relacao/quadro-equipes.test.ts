import { describe, expect, it } from "vitest";
import type {
  TarefaEquipe,
  VisaoTarefasEquipe,
} from "@/lib/dados/tipos-relacao";
import {
  fraseEquipe,
  fraseQuadroEquipes,
  montarQuadroEquipes,
} from "./quadro-equipes";

function tarefa(parcial: Partial<TarefaEquipe>): TarefaEquipe {
  return {
    id: parcial.titulo ?? "t",
    titulo: "Tarefa",
    tipo: "outro",
    prioridade: "normal",
    status: "aberta",
    venceEm: null,
    vencida: false,
    equipe: "comercial",
    responsavel: null,
    familia: null,
    ...parcial,
  };
}

const visao: VisaoTarefasEquipe = {
  equipes: [
    {
      equipe: "comercial",
      abertas: 4,
      emAndamento: 1,
      vencidas: 1,
      semResponsavel: 1,
      concluidas7d: 2,
    },
    {
      equipe: "coordenacao",
      abertas: 1,
      emAndamento: 0,
      vencidas: 0,
      semResponsavel: 1,
      concluidas7d: 0,
    },
  ],
  pessoas: [],
  tarefas: [
    tarefa({
      titulo: "B normal",
      responsavel: "Zélia",
      venceEm: "2026-10-01T10:00:00Z",
    }),
    tarefa({
      titulo: "A vencida",
      responsavel: "Zélia",
      vencida: true,
      venceEm: "2026-09-29T10:00:00Z",
    }),
    tarefa({ titulo: "C alta", responsavel: "Ana", prioridade: "alta" }),
    tarefa({ titulo: "D sem dono" }),
    tarefa({ titulo: "E coordenação", equipe: "coordenacao" }),
  ],
};

describe("montarQuadroEquipes", () => {
  it("uma coluna por equipe, pessoas pelo nome e sem responsável primeiro", () => {
    const quadro = montarQuadroEquipes(visao);
    expect(quadro.map((e) => e.rotulo)).toEqual(["Comercial", "Coordenação"]);
    const comercial = quadro[0]!;
    expect(comercial.pessoas.map((p) => p.nome)).toEqual([
      null,
      "Ana",
      "Zélia",
    ]);
    // Dentro da pessoa, a vencida vem antes (nunca ranking entre pessoas).
    expect(comercial.pessoas[2]!.tarefas.map((t) => t.titulo)).toEqual([
      "A vencida",
      "B normal",
    ]);
    expect(comercial.pessoas[2]!.vencidas).toBe(1);
  });

  it("as frases contam o total, o que venceu e o que está sem dono", () => {
    const quadro = montarQuadroEquipes(visao);
    expect(fraseQuadroEquipes(quadro)).toBe(
      "5 tarefas abertas em 2 equipes. 1 venceu. 2 estão sem responsável.",
    );
    expect(fraseEquipe(quadro[0]!)).toBe(
      "1 vencida, 1 sem responsável, 1 em andamento. 2 concluídas nos últimos 7 dias.",
    );
    expect(fraseEquipe(quadro[1]!)).toBe(
      "Nenhuma vencida, 1 sem responsável. Nenhuma concluída nos últimos 7 dias.",
    );
    expect(fraseQuadroEquipes([])).toBe(
      "Nenhuma tarefa aberta nas equipes agora.",
    );
  });
});
