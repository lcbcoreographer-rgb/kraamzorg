import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_ARMAZENAMENTO,
  pedirArmazenamentoPersistente,
  situacaoGuardada,
} from "./armazenamento";

beforeEach(() => {
  localStorage.clear();
});

describe("pedirArmazenamentoPersistente", () => {
  it("já persistente: não pede de novo", async () => {
    const persist = vi.fn(async () => true);
    const r = await pedirArmazenamentoPersistente({
      persisted: async () => true,
      persist,
    });
    expect(r).toBe("persistente");
    expect(persist).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE_ARMAZENAMENTO)).toBe("persistente");
  });

  it("pede e o navegador concede", async () => {
    const r = await pedirArmazenamentoPersistente({
      persisted: async () => false,
      persist: async () => true,
    });
    expect(r).toBe("persistente");
  });

  it("pede e o navegador nega: temporário", async () => {
    const r = await pedirArmazenamentoPersistente({
      persisted: async () => false,
      persist: async () => false,
    });
    expect(r).toBe("temporario");
    expect(situacaoGuardada()).toBe("temporario");
  });

  it("navegador sem a API ou com erro: indisponível, sem lançar", async () => {
    expect(await pedirArmazenamentoPersistente({})).toBe("indisponivel");
    expect(await pedirArmazenamentoPersistente(undefined)).toBe("indisponivel");
    expect(
      await pedirArmazenamentoPersistente({
        persist: async () => {
          throw new Error("bloqueado");
        },
      }),
    ).toBe("indisponivel");
  });

  it("situacaoGuardada ignora valor estranho", () => {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, "qualquer coisa");
    expect(situacaoGuardada()).toBeNull();
  });
});
