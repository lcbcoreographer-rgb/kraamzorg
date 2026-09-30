import { describe, expect, it } from "vitest";
import type { CartaoOportunidade, ResumoFamilia } from "@/lib/dados/tipos";
import {
  linhaDaFamilia,
  oportunidadeDaFamilia,
  proximoPassoDa,
  tempoDaFamilia,
} from "./linha-familia";

const HOJE = "2026-09-30";

const resumo = (parcial: Partial<ResumoFamilia>): ResumoFamilia => ({
  id: "f1",
  nome: "Família Teste Aurora",
  bairro: "Pinheiros",
  cidade: "São Paulo",
  uf: "SP",
  dpp: null,
  dataNascimento: null,
  dataAlta: null,
  dataInicioEfetivo: null,
  estadoSensivel: "normal",
  naoContatar: false,
  gemelar: false,
  ...parcial,
});

const cartao = (parcial: Partial<CartaoOportunidade>): CartaoOportunidade => ({
  oportunidadeId: "o1",
  familiaId: "f1",
  nomeFamilia: "Família Teste Aurora",
  pipeline: 1,
  estagioP1: "qualificado",
  estagioP2: null,
  classificacao: null,
  score: null,
  responsavelId: null,
  dpp: null,
  dataNascimento: null,
  cidade: null,
  uf: null,
  bairro: null,
  estadoSensivel: "normal",
  proximoContatoEm: null,
  pdfEnviadoEm: null,
  motivoPerda: null,
  atualizadoEm: "2026-09-29T10:00:00Z",
  transferenciaAberta: false,
  ...parcial,
});

describe("tempoDaFamilia", () => {
  it("gestando: a semana em mono, sem frase", () => {
    expect(
      tempoDaFamilia(resumo({ dpp: "2026-11-24" }), "gestando", HOJE),
    ).toEqual({ frase: null, medida: "32s1d" });
  });

  it("DPP passada sem nascimento: a frase e a medida separadas", () => {
    expect(
      tempoDaFamilia(resumo({ dpp: "2026-09-27" }), "gestando", HOJE),
    ).toEqual({ frase: null, medida: "40s3d" });
    expect(
      tempoDaFamilia(resumo({ dpp: "2026-08-01" }), "gestando", HOJE),
    ).toEqual({ frase: "DPP passou há", medida: "60 dias" });
  });

  it("nasceu, alta e início são fatos com a data", () => {
    expect(
      tempoDaFamilia(resumo({ dataNascimento: "2026-09-17" }), "nasceu", HOJE),
    ).toEqual({ frase: "Nasceu em", medida: "17/09" });
    expect(
      tempoDaFamilia(
        resumo({ dataNascimento: "2026-09-17", dataAlta: "2026-09-19" }),
        "nasceu",
        HOJE,
      ),
    ).toEqual({ frase: "Alta em", medida: "19/09" });
    expect(
      tempoDaFamilia(
        resumo({ dataInicioEfetivo: "2026-09-20" }),
        "atendimento",
        HOJE,
      ),
    ).toEqual({ frase: "Início em", medida: "20/09" });
  });

  it("freio: nenhuma semana nem data futura (DESIGN.md, 11.8)", () => {
    expect(
      tempoDaFamilia(
        resumo({ dpp: "2027-01-10", estadoSensivel: "bloqueio_total" }),
        "freio",
        HOJE,
      ),
    ).toBeNull();
  });
});

describe("proximoPassoDa", () => {
  it("transferência antes de retorno, retorno antes de quem cuida", () => {
    expect(
      proximoPassoDa(
        cartao({ transferenciaAberta: true, proximoContatoEm: "2026-10-02" }),
        "eu",
      ).tipo,
    ).toBe("transferencia");
    expect(
      proximoPassoDa(cartao({ proximoContatoEm: "2026-10-02" }), "eu"),
    ).toEqual({ tipo: "retorno", frase: "Retorno em", data: "02/10" });
    expect(proximoPassoDa(cartao({ responsavelId: "eu" }), "eu").frase).toBe(
      "Com você",
    );
    expect(proximoPassoDa(cartao({}), "eu").frase).toBe("Sem responsável");
    expect(proximoPassoDa(cartao({ responsavelId: "outra" }), "eu").frase).toBe(
      "Com outra pessoa",
    );
  });
});

describe("linhaDaFamilia", () => {
  it("usa o estágio do pipeline em que a oportunidade está", () => {
    const linha = linhaDaFamilia(
      resumo({ dpp: "2026-11-24" }),
      cartao({ pipeline: 2, estagioP1: "qualificado", estagioP2: "assinado" }),
      { hoje: HOJE, usuarioId: null },
    );
    expect(linha.estagio).toBe("Assinado");
    expect(linha.fase).toBe("gestando");
  });

  it("sem oportunidade visível, sem estágio e sem próximo passo", () => {
    const linha = linhaDaFamilia(resumo({ dpp: "2026-11-24" }), null, {
      hoje: HOJE,
      usuarioId: null,
    });
    expect(linha.estagio).toBeNull();
    expect(linha.proximoPasso).toBeNull();
  });

  it("a oportunidade da família é a atualizada por último", () => {
    const antiga = cartao({
      oportunidadeId: "a",
      atualizadoEm: "2026-01-01T00:00:00Z",
    });
    const nova = cartao({
      oportunidadeId: "b",
      atualizadoEm: "2026-09-01T00:00:00Z",
    });
    expect(oportunidadeDaFamilia([antiga, nova])?.oportunidadeId).toBe("b");
    expect(oportunidadeDaFamilia([])).toBeNull();
  });
});
