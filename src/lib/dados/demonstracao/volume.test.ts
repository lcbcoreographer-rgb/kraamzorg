import { afterEach, describe, expect, it, vi } from "vitest";
import { FAMILIAS, OPORTUNIDADES, PESSOAS } from "./fixtures";
import { gerarVolume, volumeGrandeLigado } from "./volume";

describe("volume extra do modo demonstração", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("só liga com KZ_DEMO_VOLUME=grande", () => {
    vi.stubEnv("KZ_DEMO_VOLUME", "");
    expect(volumeGrandeLigado()).toBe(false);
    vi.stubEnv("KZ_DEMO_VOLUME", "grande");
    expect(volumeGrandeLigado()).toBe(true);
  });

  it("gera famílias fictícias sem colidir com as fixtures", () => {
    const v = gerarVolume(Date.UTC(2026, 8, 30, 12));
    expect(v.familias.length).toBe(36);
    expect(v.oportunidades.length).toBe(36);
    const ids = [...FAMILIAS, ...v.familias].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nomes = [...FAMILIAS, ...v.familias].map((f) => f.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    const telefones = [...PESSOAS, ...v.pessoas].map((p) => p.telefoneE164);
    expect(new Set(telefones).size).toBe(telefones.length);
    const opIds = [...OPORTUNIDADES, ...v.oportunidades].map((o) => o.id);
    expect(new Set(opIds).size).toBe(opIds.length);
  });

  it("usa só nomes de teste e telefones da faixa de teste", () => {
    const v = gerarVolume(Date.UTC(2026, 8, 30, 12));
    for (const f of v.familias) expect(f.nome).toMatch(/^Família Teste /);
    for (const p of v.pessoas) {
      expect(p.nome).toMatch(/ Teste /);
      expect(p.telefoneE164).toMatch(/^\+551190000\d{4}$/);
    }
  });

  it("toda família tem contato principal e oportunidade", () => {
    const v = gerarVolume(Date.UTC(2026, 8, 30, 12));
    for (const f of v.familias) {
      expect(
        v.pessoas.some((p) => p.familiaId === f.id && p.contatoPrincipal),
      ).toBe(true);
      expect(v.oportunidades.some((o) => o.familiaId === f.id)).toBe(true);
    }
  });
});
