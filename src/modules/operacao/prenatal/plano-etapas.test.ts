import { describe, expect, it } from "vitest";
import doc1 from "../../../../supabase/dados/instrumentos/doc1.json";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import {
  enderecoDoProgresso,
  PLANO_ENTREVISTA_PRENATAL,
  pontoDeRetomada,
} from "./plano-etapas";

/**
 * O plano de etapas só reorganiza campos que já existem na definição
 * aprovada do DOC 1 (CLAUDE.md, "Clínico"): nenhum campo criado, removido ou
 * repetido. Estes testes travam isso.
 */

const definicao = lerDefinicao(doc1);

function enderecosDoPlano(): string[] {
  const nomeados = new Set<string>();
  for (const etapa of PLANO_ENTREVISTA_PRENATAL) {
    for (const item of etapa.itens) {
      for (const campo of item.campos ?? [])
        nomeados.add(`${item.bloco}.${campo}`);
    }
  }
  const saida: string[] = [];
  for (const etapa of PLANO_ENTREVISTA_PRENATAL) {
    for (const item of etapa.itens) {
      const bloco = definicao.blocos.find((b) => b.id === item.bloco);
      if (!bloco) throw new Error(`bloco ${item.bloco} não existe`);
      const campos =
        item.campos ??
        bloco.campos
          .map((c) => c.id)
          .filter((id) => !nomeados.has(`${bloco.id}.${id}`));
      for (const campo of campos) saida.push(`${item.bloco}.${campo}`);
    }
  }
  return saida;
}

describe("PLANO_ENTREVISTA_PRENATAL", () => {
  it("tem oito etapas com id e título", () => {
    expect(PLANO_ENTREVISTA_PRENATAL).toHaveLength(8);
    expect(PLANO_ENTREVISTA_PRENATAL.map((e) => e.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    for (const etapa of PLANO_ENTREVISTA_PRENATAL)
      expect(etapa.titulo.length).toBeGreaterThan(2);
  });

  it("cobre todos os campos do DOC 1 exatamente uma vez, sem inventar nenhum", () => {
    const doPlano = enderecosDoPlano();
    const daDefinicao = definicao.blocos.flatMap((b) =>
      b.campos.map((c) => `${b.id}.${c.id}`),
    );
    expect(new Set(doPlano).size).toBe(doPlano.length); // nenhum repetido
    expect([...doPlano].sort()).toEqual([...daDefinicao].sort());
  });

  it("cada campo citado existe no bloco citado", () => {
    for (const etapa of PLANO_ENTREVISTA_PRENATAL) {
      for (const item of etapa.itens) {
        const bloco = definicao.blocos.find((b) => b.id === item.bloco);
        for (const campo of item.campos ?? []) {
          expect(
            bloco?.campos.some((c) => c.id === campo),
            `${item.bloco}.${campo}`,
          ).toBe(true);
        }
      }
    }
  });

  it("a etapa 4 é a história obstétrica (bloco D)", () => {
    expect(PLANO_ENTREVISTA_PRENATAL[3]!.itens.map((i) => i.bloco)).toEqual([
      "D",
    ]);
  });
});

describe("enderecoDoProgresso", () => {
  it("separa bloco e campo", () => {
    expect(enderecoDoProgresso("B.percentil")).toEqual({
      bloco: "B",
      campo: "percentil",
    });
  });
  it("ignora o que não tem ponto no meio", () => {
    expect(enderecoDoProgresso(null)).toBeUndefined();
    expect(enderecoDoProgresso("")).toBeUndefined();
    expect(enderecoDoProgresso("percentil")).toBeUndefined();
    expect(enderecoDoProgresso(".percentil")).toBeUndefined();
    expect(enderecoDoProgresso("B.")).toBeUndefined();
  });
});

describe("pontoDeRetomada", () => {
  it("sem marca, abre na primeira etapa e sem campo", () => {
    expect(pontoDeRetomada(null)).toEqual({
      etapaInicial: 0,
      campoInicial: undefined,
    });
  });

  it("etapa 4 e campo do bloco D reabrem na etapa 4, no campo onde parou", () => {
    expect(pontoDeRetomada({ etapa: 4, campo: "D.filhos_vivos" })).toEqual({
      etapaInicial: 3,
      campoInicial: { bloco: "D", campo: "filhos_vivos" },
    });
  });

  it("campo de outra etapa é ignorado: reabre na etapa, sem foco em campo", () => {
    expect(pontoDeRetomada({ etapa: 4, campo: "C.nome_da_gestante" })).toEqual({
      etapaInicial: 3,
      campoInicial: undefined,
    });
  });

  it("campo do bloco dividido só vale na etapa que o cita", () => {
    // B.percentil é da etapa 3; B.hora_de_termino, da 8; B.coletador, da 1.
    expect(
      pontoDeRetomada({ etapa: 3, campo: "B.percentil" }).campoInicial,
    ).toEqual({ bloco: "B", campo: "percentil" });
    expect(
      pontoDeRetomada({ etapa: 3, campo: "B.hora_de_termino" }).campoInicial,
    ).toBeUndefined();
    expect(
      pontoDeRetomada({ etapa: 8, campo: "B.hora_de_termino" }).campoInicial,
    ).toEqual({ bloco: "B", campo: "hora_de_termino" });
    expect(
      pontoDeRetomada({ etapa: 1, campo: "B.coletador" }).campoInicial,
    ).toEqual({ bloco: "B", campo: "coletador" });
  });

  it("etapa fora do plano é trazida para dentro dele", () => {
    expect(pontoDeRetomada({ etapa: 99, campo: null }).etapaInicial).toBe(7);
    expect(pontoDeRetomada({ etapa: 0, campo: null }).etapaInicial).toBe(0);
  });
});
