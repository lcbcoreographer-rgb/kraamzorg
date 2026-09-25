import { describe, expect, it } from "vitest";
import { formatarData, formatarDataHora } from "./data";

describe("formatarData", () => {
  it("formata coluna date (aaaa-mm-dd) sem deslocar fuso", () => {
    expect(formatarData("2026-09-24")).toBe("24/09/2026");
  });

  it("não perde um dia em datas no início do mês", () => {
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
  });

  it("formata timestamptz UTC convertendo para America/Sao_Paulo", () => {
    // 2026-09-24T02:30:00Z é 2026-09-23 23:30 em Brasília (UTC-3): ainda dia 23.
    expect(formatarData("2026-09-24T02:30:00Z")).toBe("23/09/2026");
  });

  it("formata timestamptz que continua no mesmo dia em Brasília", () => {
    expect(formatarData("2026-09-24T15:00:00Z")).toBe("24/09/2026");
  });

  it("aceita um objeto Date", () => {
    expect(formatarData(new Date("2026-09-24T12:00:00Z"))).toBe("24/09/2026");
  });

  it("devolve aviso para data inválida em vez de quebrar", () => {
    expect(formatarData("não é uma data")).toBe("Data inválida");
  });
});

describe("formatarDataHora", () => {
  it("formata data e hora no padrão do PRD (vírgula entre data e hora)", () => {
    expect(formatarDataHora("2026-09-24T12:14:00Z")).toBe("24/09/2026, 09:14");
  });

  it("preenche hora e minuto com dois dígitos", () => {
    expect(formatarDataHora("2026-01-05T03:05:00Z")).toBe("05/01/2026, 00:05");
  });

  it("devolve aviso para data inválida", () => {
    expect(formatarDataHora("xyz")).toBe("Data inválida");
  });
});
