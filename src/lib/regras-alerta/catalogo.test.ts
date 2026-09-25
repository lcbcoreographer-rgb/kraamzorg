import { describe, expect, it } from "vitest";
import { regraDoBanco, validarCatalogo } from "./avaliar";
import { CATALOGO_REGRAS } from "./catalogo";
import { normalizarCondicao } from "./condicao";
import { lerRegrasDoSeed } from "./seed-regra-alerta.test-util";

const ATIVAS_DOC3 = [
  "PU-01",
  "PU-04",
  "RN-01",
  "RN-03",
  "RN-04",
  "RN-07",
  "RN-08",
];

function buscar(id: string) {
  const regra = CATALOGO_REGRAS.find((r) => r.id === id);
  if (!regra) throw new Error(`regra ${id} não encontrada no catálogo`);
  return regra;
}

describe("CATALOGO_REGRAS (referência do Apêndice B)", () => {
  it("não tem ids de vínculo duplicados", () => {
    const ids = CATALOGO_REGRAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ativa deriva sempre de fonte === 'doc3'", () => {
    for (const regra of CATALOGO_REGRAS) {
      expect(regra.ativa, regra.id).toBe(regra.fonte === "doc3");
    }
  });

  it('só as sete linhas com "Fonte: DOC 3" no Apêndice B ficam ativas', () => {
    const ativas = CATALOGO_REGRAS.filter((r) => r.ativa).map((r) => r.id);
    expect(ativas.sort()).toEqual([...ATIVAS_DOC3].sort());
  });

  it("[clínico], v4.0 e linha sem fonte ficam desligadas (PU-08, RN-13, RN-10, SM-01 a SM-07, LATCH)", () => {
    for (const id of [
      "PU-08",
      "PU-04-episiotomia",
      "RN-13",
      "RN-10",
      "LATCH",
      "SM-01",
      "SM-02",
      "SM-03",
      "SM-04",
      "SM-05",
      "SM-06",
      "SM-07",
    ]) {
      const regra = buscar(id);
      expect(regra.fonte, id).not.toBe("doc3");
      expect(regra.ativa, id).toBe(false);
    }
  });

  it("toda condição preenchida segue um dos formatos documentados", () => {
    for (const regra of CATALOGO_REGRAS) {
      if (regra.condicao === null) continue;
      expect(normalizarCondicao(regra.condicao), regra.id).not.toBeNull();
    }
  });

  it("nenhuma regra ativa fica sem campo ou sem condição válida", () => {
    expect(validarCatalogo(CATALOGO_REGRAS)).toEqual([]);
  });
});

describe("CATALOGO_REGRAS confere com regra_alerta do seed", () => {
  const seed = lerRegrasDoSeed();

  it("o seed tem o DOC 3 inteiro (38 linhas) e o leitor enxerga todas", () => {
    expect(seed).toHaveLength(38);
  });

  it("as regras ativas são as mesmas, com o mesmo campo e o mesmo JSON de condição", () => {
    const ativasSeed = seed.filter((l) => l.ativa);
    expect(ativasSeed.map((l) => l.id).sort()).toEqual([...ATIVAS_DOC3].sort());
    for (const linha of ativasSeed) {
      const regra = buscar(linha.id);
      expect(regra.campo, linha.id).toBe(linha.campo);
      expect(regra.condicao, linha.id).toEqual(linha.condicao);
    }
  });

  it("todo código do catálogo que existe no seed tem grupo, severidade, conduta e campo iguais", () => {
    const porId = new Map(seed.map((l) => [l.id, l]));
    for (const regra of CATALOGO_REGRAS) {
      const linha = porId.get(regra.codigo);
      if (!linha) continue; // LATCH, sucções e apoio: sem código do DOC 3
      expect(regra.grupo, regra.id).toBe(linha.grupo);
      expect(regra.severidade, regra.id).toBe(linha.severidade);
      expect(regra.conduta, regra.id).toBe(linha.conduta);
      if (linha.campo !== null) expect(regra.campo, regra.id).toBe(linha.campo);
    }
  });

  it("toda linha do seed vira RegraAlerta pelo regraDoBanco e o cache não tem regra ativa quebrada", () => {
    const catalogo = seed.map(regraDoBanco);
    expect(catalogo).toHaveLength(38);
    expect(validarCatalogo(catalogo)).toEqual([]);
  });
});
