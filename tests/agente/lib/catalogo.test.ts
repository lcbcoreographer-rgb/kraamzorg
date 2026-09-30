// @vitest-environment node
/**
 * P28 · O catálogo do roteiro não depende de banco: confere que os 28 casos do
 * Apêndice C estão na ordem, que cada roteiro do modelo simulado aponta para um
 * turno que existe e é do tipo certo, e que os textos que a família escreve não
 * levam travessão. Roda em qualquer máquina (`pnpm test`).
 */
import { describe, expect, it } from "vitest";
import { CASOS, CASOS_DO_APENDICE, TOTAL_DO_APENDICE } from "./casos";
import { regrasUniversais } from "./regras";
import { ehAcao } from "./tipos";
import { CASOS_SO_SIMULADOR } from "../local/casos-so-simulador";
import { ROTEIROS } from "../local/roteiros";

const TODOS = [...CASOS, ...CASOS_SO_SIMULADOR.map((s) => s.caso)];

describe("catálogo do roteiro da Isadora", () => {
  it("tem os 28 casos do Apêndice C, na ordem", () => {
    expect(TOTAL_DO_APENDICE).toBe(28);
    expect(CASOS_DO_APENDICE.map((c) => c.rotulo)).toEqual(
      Array.from({ length: 28 }, (_, i) => String(i + 1)),
    );
    expect(CASOS_DO_APENDICE.map((c) => c.id)).toEqual(
      Array.from(
        { length: 28 },
        (_, i) => `C${String(i + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("não repete caso nem regra dentro de um caso", () => {
    expect(new Set(TODOS.map((c) => c.id)).size).toBe(TODOS.length);
    for (const caso of TODOS) {
      const ids = [...regrasUniversais(), ...caso.regras].map((r) => r.id);
      expect(new Set(ids).size, `regras repetidas em ${caso.id}`).toBe(
        ids.length,
      );
    }
  });

  it("cada regra que aponta para um turno aponta para um turno que existe", () => {
    for (const caso of TODOS) {
      for (const regra of caso.regras) {
        if (regra.turno === undefined) continue;
        expect(
          regra.turno >= 1 && regra.turno <= caso.turnos.length,
          `${caso.id}: ${regra.id} aponta para o turno ${regra.turno}, e o caso tem ${caso.turnos.length}`,
        ).toBe(true);
      }
    }
  });

  it("o roteiro do modelo só fala em turno de mensagem, e o do gerador de retorno só em turno do agendador", () => {
    const porId = new Map(TODOS.map((c) => [c.id, c]));
    for (const [id, turnos] of Object.entries(ROTEIROS)) {
      const caso = porId.get(id);
      expect(caso, `roteiro de um caso que não existe: ${id}`).toBeDefined();
      for (const [chave, roteiro] of Object.entries(turnos)) {
        const turno = caso?.turnos[Number(chave) - 1];
        expect(turno, `${id}: o turno ${chave} não existe`).toBeDefined();
        if (!turno) continue;
        if (roteiro.agente || roteiro.classificador) {
          expect(
            ehAcao(turno),
            `${id}: o modelo de conversa não roda no turno ${chave}, que é uma ação`,
          ).toBe(false);
        }
        if (roteiro.followup) {
          expect(
            ehAcao(turno) &&
              (turno.acao === "executarAgendador" ||
                turno.acao === "executarFollowup"),
            `${id}: o gerador de retorno só roda em ação do agendador (turno ${chave})`,
          ).toBe(true);
        }
      }
    }
  });

  it("todo caso que anda o relógio ou roda o agendador abre a janela de envio", () => {
    for (const caso of CASOS) {
      const usaAgendador = caso.turnos.some(
        (t) =>
          ehAcao(t) &&
          (t.acao === "executarAgendador" || t.acao === "executarFollowup"),
      );
      if (!usaAgendador) continue;
      const abre = (caso.preparo ?? []).some(
        (p) =>
          p.preparo === "janelaDeEnvioAberta" || p.preparo === "agendaDeTeste",
      );
      expect(
        abre,
        `${caso.id} roda o agendador com a janela de envio fechada`,
      ).toBe(true);
    }
  });

  it("o que a família escreve não tem travessão nem meia-risca", () => {
    for (const caso of TODOS) {
      for (const turno of caso.turnos) {
        if (ehAcao(turno)) continue;
        const texto = JSON.stringify(turno);
        expect(texto, `${caso.id}`).not.toMatch(/[–—]/);
      }
    }
  });

  it("os casos de agenda usam só e-mail de exemplo e nomes fictícios", () => {
    const emails = JSON.stringify(TODOS.map((c) => c.turnos)).match(
      /[\w.+-]+@[\w.-]+\.[a-z]+/gi,
    );
    for (const email of emails ?? []) expect(email).toMatch(/@example\.com$/);
  });
});
