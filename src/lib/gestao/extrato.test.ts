import { describe, expect, it } from "vitest";
import {
  dataParaIso,
  lerExtrato,
  sha256Hex,
  valorParaCentavos,
} from "./extrato";

/** Leitura do extrato (P46 item 4): OFX e CSV, valores em centavos sem ponto flutuante. */

describe("valor em centavos", () => {
  it.each([
    ["4.350,00", 435000],
    ["-126,67", -12667],
    ["-126.67", -12667],
    ["R$ 1.234,56", 123456],
    ["(120,00)", -12000],
    ["120,00-", -12000],
    ["1.234", 123400],
    ["10", 1000],
    ["0,5", 50],
    ["+7,05", 705],
  ])("%s vira %i", (bruto, centavos) => {
    expect(valorParaCentavos(bruto)).toBe(centavos);
  });

  it.each(["", "abc", "1,2,3x", "R$", "--5"])("%s não é um valor", (bruto) => {
    expect(valorParaCentavos(bruto)).toBeNull();
  });

  it("não perde centavos em valores que o ponto flutuante erraria", () => {
    expect(valorParaCentavos("0,29")).toBe(29);
    expect(valorParaCentavos("1.005,10")).toBe(100510);
  });
});

describe("data", () => {
  it("aceita dd/mm/aaaa e aaaa-mm-dd e recusa data que não existe", () => {
    expect(dataParaIso("10/05/2026")).toBe("2026-05-10");
    expect(dataParaIso("2026-05-10")).toBe("2026-05-10");
    expect(dataParaIso("31/02/2026")).toBeNull();
    expect(dataParaIso("ontem")).toBeNull();
  });
});

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260510120000[-3:BRT]
<TRNAMT>4350.00
<FITID>doc-1
<MEMO>PIX RECEBIDO SINTETICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260525
<TRNAMT>-1266,67
<FITID>doc-2
<NAME>PAGAMENTO EQUIPE SINTETICO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("lê data, valor, descrição e documento de cada lançamento", () => {
    const r = lerExtrato(OFX);
    expect(r).toEqual({
      ok: true,
      formato: "ofx",
      linhas: [
        {
          data: "2026-05-10",
          valorCentavos: 435000,
          descricao: "PIX RECEBIDO SINTETICO",
          documento: "doc-1",
        },
        {
          data: "2026-05-25",
          valorCentavos: -126667,
          descricao: "PAGAMENTO EQUIPE SINTETICO",
          documento: "doc-2",
        },
      ],
    });
  });

  it("lançamento com valor inválido aponta o número dele", () => {
    const ruim = OFX.replace("4350.00", "muito");
    expect(lerExtrato(ruim)).toEqual({
      ok: false,
      erro: "linha_invalida",
      linha: 1,
    });
  });

  it("OFX sem lançamentos é recusado", () => {
    expect(lerExtrato("<OFX></OFX>")).toEqual({
      ok: false,
      erro: "sem_linhas",
    });
  });
});

describe("CSV", () => {
  it("ponto e vírgula, cabeçalho em português e valor com vírgula", () => {
    const csv = [
      "Data;Histórico;Documento;Valor",
      '10/05/2026;"PIX; RECEBIDO SINTETICO";doc-1;4.350,00',
      "25/05/2026;PAGAMENTO EQUIPE SINTETICO;doc-2;-1.266,67",
    ].join("\r\n");
    const r = lerExtrato(csv);
    expect(r).toMatchObject({ ok: true, formato: "csv" });
    if (!r.ok) return;
    expect(r.linhas).toEqual([
      {
        data: "2026-05-10",
        valorCentavos: 435000,
        descricao: "PIX; RECEBIDO SINTETICO",
        documento: "doc-1",
      },
      {
        data: "2026-05-25",
        valorCentavos: -126667,
        descricao: "PAGAMENTO EQUIPE SINTETICO",
        documento: "doc-2",
      },
    ]);
  });

  it("colunas separadas de crédito e débito", () => {
    const csv = [
      "Data,Descrição,Crédito,Débito",
      "2026-05-10,Recebido,100.50,",
      "2026-05-11,Pago,,20.00",
    ].join("\n");
    const r = lerExtrato(csv);
    expect(r.ok && r.linhas.map((l) => l.valorCentavos)).toEqual([
      10050, -2000,
    ]);
  });

  it("cabeçalho que não é de extrato é recusado", () => {
    expect(lerExtrato("Nome;Idade\nA;1")).toEqual({
      ok: false,
      erro: "formato_nao_reconhecido",
    });
  });

  it("linha com data inválida aponta a linha do arquivo", () => {
    const csv = [
      "Data;Histórico;Valor",
      "10/05/2026;ok;1,00",
      "32/13/2026;ruim;2,00",
    ].join("\n");
    expect(lerExtrato(csv)).toEqual({
      ok: false,
      erro: "linha_invalida",
      linha: 3,
    });
  });

  it("arquivo vazio e só cabeçalho", () => {
    expect(lerExtrato("  \n ")).toEqual({ ok: false, erro: "arquivo_vazio" });
    expect(lerExtrato("Data;Histórico;Valor")).toEqual({
      ok: false,
      erro: "sem_linhas",
    });
  });
});

describe("sha256", () => {
  it("é estável e tem 64 caracteres hexadecimais", async () => {
    const a = await sha256Hex("extrato sintético");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("extrato sintético")).toBe(a);
    expect(await sha256Hex("outro")).not.toBe(a);
    // valor conhecido do algoritmo
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
