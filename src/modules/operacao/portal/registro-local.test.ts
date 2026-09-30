import { describe, expect, it } from "vitest";
import type { VisitaPortal } from "@/lib/dados/tipos-equipe";
import { aplicarMarcasLocais } from "./registro-local";

const visita = {
  visitaId: "v1",
  estado: "agendada",
  checkinEm: null,
  checkoutEm: null,
} as unknown as VisitaPortal;

describe("aplicarMarcasLocais e a falta de sinal", () => {
  it("chegada que só falhou por falta de sinal continua salva no aparelho, sem mensagem de erro", () => {
    const r = aplicarMarcasLocais(visita, {
      chegada: {
        valor: "2026-09-30T05:00:00.000Z",
        estadoItem: "erro",
        erro: "Failed to fetch",
        semRede: true,
      },
      saida: null,
    });
    expect(r.chegadaSituacao).toBe("no_aparelho");
    expect(r.erroEnvio).toBeNull();
  });

  it("recusa do servidor continua sendo erro, com a mensagem", () => {
    const r = aplicarMarcasLocais(visita, {
      chegada: {
        valor: "2026-09-30T05:00:00.000Z",
        estadoItem: "erro",
        erro: "equipe:fora_do_dia_da_visita",
        semRede: false,
      },
      saida: null,
    });
    expect(r.chegadaSituacao).toBe("erro");
    expect(r.erroEnvio).toBe("equipe:fora_do_dia_da_visita");
  });
});
