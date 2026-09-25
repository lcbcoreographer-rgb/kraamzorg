import { describe, expect, it } from "vitest";
import { lerRegrasDoSeed } from "./seed-regra-alerta.test-util";
import { SINAIS_SEM_CAMPO, buscarSinalManual } from "./sinais";

describe("SINAIS_SEM_CAMPO (K-07, seletor de sinais do DOC 3 sem campo)", () => {
  it("cobre os sinais citados no PRD 9.3 (cefaleia com alteração visual, dor torácica, convulsão, sangue nas fezes)", () => {
    const codigos = SINAIS_SEM_CAMPO.map((s) => s.codigo);
    expect(codigos).toEqual(
      expect.arrayContaining(["PU-05", "PU-06", "RN-06", "RN-05"]),
    );
  });

  it("não tem código duplicado", () => {
    const codigos = SINAIS_SEM_CAMPO.map((s) => s.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("nasce pendente de aprovação clínica (K-07 está em aberto no PRD 22.3)", () => {
    for (const sinal of SINAIS_SEM_CAMPO) {
      expect(sinal.pendenteAprovacaoClinica).toBe(true);
    }
  });

  it("buscarSinalManual encontra pelo código e devolve undefined para código desconhecido", () => {
    expect(buscarSinalManual("RN-06")?.descricao).toBe("Convulsão");
    expect(buscarSinalManual("XX-99")).toBeUndefined();
  });

  it("todo sinal do seletor existe em regra_alerta com o mesmo grupo, severidade, descrição e conduta", () => {
    const porId = new Map(lerRegrasDoSeed().map((l) => [l.id, l]));
    for (const sinal of SINAIS_SEM_CAMPO) {
      const linha = porId.get(sinal.codigo);
      expect(linha, sinal.codigo).toBeDefined();
      expect(sinal.grupo, sinal.codigo).toBe(linha?.grupo);
      expect(sinal.severidade, sinal.codigo).toBe(linha?.severidade);
      expect(sinal.descricao, sinal.codigo).toBe(linha?.descricao);
      expect(sinal.conduta, sinal.codigo).toBe(linha?.conduta);
    }
  });

  it("nenhum sinal manual pede ocorrência privada (só SM imediato pede, e SM tem campo no bloco 7)", () => {
    expect(SINAIS_SEM_CAMPO.filter((s) => s.exigeOcorrenciaPrivada)).toEqual(
      [],
    );
  });
});
