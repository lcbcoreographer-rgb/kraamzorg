import { describe, expect, it } from "vitest";
import type { LinhaExportacaoMarketing } from "@/lib/dados/tipos-relacao";
import { celulaCsv, CABECALHO_CSV, csvDaExportacao } from "./csv";
import { codigoDeOrigem, linkDaPagina, linkWhatsAppDoCanal } from "./links";
import { atalhosDePeriodo, periodoDaBusca } from "./periodo";

describe("links de captação (P47)", () => {
  const canais = {
    numeroE164: "+5511900000001",
    prefixo: "KZ",
    textoModelo: "Olá, quero conhecer a Kraamzorg. Código: {codigo}",
  };

  it("o código de origem é prefixo, traço e canal", () => {
    expect(codigoDeOrigem("KZ", "IGBIO")).toBe("KZ-IGBIO");
    expect(codigoDeOrigem(null, "IGBIO")).toBe("IGBIO");
  });

  it("o link wa.me leva o número sem sinal e o texto com o código", () => {
    const link = linkWhatsAppDoCanal(canais, { codigo: "IGBIO" });
    expect(link).toMatch(/^https:\/\/wa\.me\/5511900000001\?text=/);
    expect(decodeURIComponent(link!.split("text=")[1]!)).toBe(
      "Olá, quero conhecer a Kraamzorg. Código: KZ-IGBIO",
    );
  });

  it("sem número oficial ou sem texto não há link (nada inventado)", () => {
    expect(
      linkWhatsAppDoCanal({ ...canais, numeroE164: null }, { codigo: "X" }),
    ).toBeNull();
    expect(
      linkWhatsAppDoCanal({ ...canais, textoModelo: null }, { codigo: "X" }),
    ).toBeNull();
  });

  it("a página do canal usa o código em minúsculas", () => {
    expect(linkDaPagina("https://app.exemplo.invalid", "IGBIO")).toBe(
      "https://app.exemplo.invalid/c/igbio",
    );
  });
});

describe("CSV do marketing (P47)", () => {
  const linha: LinhaExportacaoMarketing = {
    nomeExibicao: "Família Teste Aurora",
    dpp: "2027-01-15",
    gemelar: false,
    primeiraGestacao: true,
    origem: "meta_ads",
    codigoOrigem: "META",
    utm: { utm_source: "meta", utm_campaign: "a;b" },
    criadoEm: "2026-08-12T10:00:00-03:00",
  };

  it("abre no Excel: BOM, ponto e vírgula e quebra de linha do Windows", () => {
    const csv = csvDaExportacao([linha]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [cabecalho, corpo] = csv.slice(1).split("\r\n");
    expect(cabecalho!.split(";")).toHaveLength(CABECALHO_CSV.length);
    expect(corpo).toContain(
      "Família Teste Aurora;2027-01-15;não;sim;meta_ads;META;",
    );
  });

  it("célula que parece fórmula ganha apóstrofo; célula com ponto e vírgula vai entre aspas", () => {
    expect(celulaCsv("=SOMA(A1)")).toBe("'=SOMA(A1)");
    expect(celulaCsv("+55")).toBe("'+55");
    expect(celulaCsv("@x")).toBe("'@x");
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv("simples")).toBe("simples");
    expect(celulaCsv('a;"b"')).toBe('"a;""b"""');
  });

  it("não tem coluna de telefone, e-mail nem documento", () => {
    expect(CABECALHO_CSV.join(" ").toLowerCase()).not.toMatch(
      /telefone|e-mail|cpf|endereço/,
    );
  });
});

describe("período (P47)", () => {
  it("data inválida vira sem limite", () => {
    expect(periodoDaBusca({ desde: "2026-09-01", ate: "amanhã" })).toEqual({
      desde: "2026-09-01",
      ate: null,
    });
    expect(periodoDaBusca({})).toEqual({ desde: null, ate: null });
  });

  it("atalhos: este mês e mês passado, inclusive na virada do ano e em fevereiro", () => {
    expect(atalhosDePeriodo("2026-09-30").esteMes).toEqual({
      desde: "2026-09-01",
      ate: "2026-09-30",
    });
    expect(atalhosDePeriodo("2026-09-30").mesPassado).toEqual({
      desde: "2026-08-01",
      ate: "2026-08-31",
    });
    expect(atalhosDePeriodo("2027-01-10").mesPassado).toEqual({
      desde: "2026-12-01",
      ate: "2026-12-31",
    });
    expect(atalhosDePeriodo("2028-03-05").mesPassado).toEqual({
      desde: "2028-02-01",
      ate: "2028-02-29",
    });
  });
});
