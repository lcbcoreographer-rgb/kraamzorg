import { describe, expect, it } from "vitest";
import { partesComMedidas } from "./componentes";
import { campo } from "./conteudo";
import { linhaPesoDoCampo } from "./documento";

describe("medidas em mono no PDF (DESIGN.md 11.9)", () => {
  it("separa só o número com a unidade e as datas; a frase fica em Inter", () => {
    expect(partesComMedidas("3.120 g em 20/09/2026, dia de vida 2")).toEqual([
      { texto: "3.120 g", medida: true },
      { texto: " em ", medida: false },
      { texto: "20/09/2026", medida: true },
      { texto: ", dia de vida 2", medida: false },
    ]);
    expect(partesComMedidas("Febre de 38,2 °C na puérpera")).toEqual([
      { texto: "Febre de ", medida: false },
      { texto: "38,2 °C", medida: true },
      { texto: " na puérpera", medida: false },
    ]);
  });

  it("não confunde palavra com unidade ('2 gêmeos' não é medida)", () => {
    expect(partesComMedidas("2 gêmeos")).toEqual([
      { texto: "2 gêmeos", medida: false },
    ]);
  });
});

describe("curva de peso em tabela (DESIGN.md 11.9)", () => {
  it("lê a pesagem do campo de texto, sem mudar o conteúdo", () => {
    expect(
      linhaPesoDoCampo(
        campo("Peso em 20/09/2026", "3.120 g (domicílio), dia de vida 2"),
      ),
    ).toEqual({
      data: "20/09/2026",
      diaVida: "2",
      peso: "3.120 g",
      origem: "domicílio",
    });
    expect(
      linhaPesoDoCampo(campo("Peso ao nascer", "3.250 g (18/09/2026)")),
    ).toEqual({
      data: "18/09/2026",
      diaVida: "0",
      peso: "3.250 g",
      origem: "nascimento",
    });
  });

  it("campo fora do formato continua como 'Rótulo: valor'", () => {
    expect(linhaPesoDoCampo(campo("Menor peso", "3.080 g"))).toBeNull();
  });
});
