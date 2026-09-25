import { describe, expect, it } from "vitest";
import { CATALOGO_REGRAS } from "./catalogo";

function buscar(id: string) {
  const regra = CATALOGO_REGRAS.find((r) => r.id === id);
  if (!regra) throw new Error(`regra ${id} não encontrada no catálogo`);
  return regra;
}

describe("CATALOGO_REGRAS", () => {
  it("não tem ids de vínculo duplicados", () => {
    const ids = CATALOGO_REGRAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ativa deriva sempre de fonte === 'doc3'", () => {
    for (const regra of CATALOGO_REGRAS) {
      expect(regra.ativa).toBe(regra.fonte === "doc3");
    }
  });

  it("regras com fonte DOC 3 ficam ativas (PU-01, PU-04 pela cesárea, RN-01, RN-03, RN-04, RN-07, RN-08)", () => {
    for (const id of [
      "PU-01-temperatura",
      "PU-04-cesarea",
      "RN-01-respiracao",
      "RN-03-atividade",
      "RN-04-diurese",
      "RN-07-coto",
      "RN-08-temperatura",
    ]) {
      const regra = buscar(id);
      expect(regra.fonte).toBe("doc3");
      expect(regra.ativa).toBe(true);
    }
  });

  it("regras marcadas [clínico] no Apêndice B ficam inativas (PU-08, PU-04 episiotomia, RN-13, RN-10, K-03 LATCH)", () => {
    for (const id of [
      "PU-08-temperatura-persistente",
      "PU-04-episiotomia",
      "RN-13-curva-peso",
      "RN-10-ictericia",
      "K03-latch",
    ]) {
      const regra = buscar(id);
      expect(regra.fonte).not.toBe("doc3");
      expect(regra.ativa).toBe(false);
    }
  });

  it("o grupo de saúde mental (SM-01 a SM-07) vem ativo, com fonte DOC 3", () => {
    const grupoSm = CATALOGO_REGRAS.filter((r) => r.grupo === "saude_mental");
    expect(grupoSm).toHaveLength(7);
    for (const regra of grupoSm) {
      expect(regra.fonte).toBe("doc3");
      expect(regra.ativa).toBe(true);
    }
  });

  it("toda regra ativa com campo definido também tem condicao", () => {
    for (const regra of CATALOGO_REGRAS.filter((r) => r.ativa)) {
      if (regra.campo) expect(regra.condicao).not.toBeNull();
    }
  });
});
