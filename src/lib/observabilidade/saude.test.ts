import { describe, expect, it } from "vitest";
import { avaliarSaude, type DadosSaude } from "./saude";

const bom: DadosSaude = {
  recalculo_diario: {
    horas_desde: 3,
    tolerancia_horas: 26,
    atrasado: false,
    com_erro: false,
  },
  cron: [{ job: "processar_automacoes", status: "succeeded" }],
  webhooks: [
    { origem: "whatsapp", falha_recente: false },
    {
      origem: "infinitepay",
      ultimo_ok_em: "2026-09-30T09:00:00Z",
      falha_recente: false,
    },
  ],
  falhas: {
    janela_horas: 24,
    automacoes_com_falha: 0,
    sincronizacao_com_erro: 0,
  },
};

const estados = (d: DadosSaude | null) =>
  Object.fromEntries(
    avaliarSaude(d).verificacoes.map((v) => [v.nome, v.estado]),
  );

describe("avaliarSaude", () => {
  it("tudo em dia: ok, e webhook que nunca chegou não é falha", () => {
    const s = avaliarSaude(bom);
    expect(s.estado).toBe("ok");
    expect(
      s.verificacoes.find((v) => v.nome === "webhook_whatsapp")?.detalhe,
    ).toBe("Nenhuma chamada recebida ainda.");
  });

  it("banco inacessível: falha", () => {
    expect(avaliarSaude(null)).toMatchObject({ estado: "falha" });
  });

  it("recálculo das 7h atrasado, sem rodada ou sem tolerância configurada: falha", () => {
    expect(
      avaliarSaude({
        ...bom,
        recalculo_diario: { ...bom.recalculo_diario, atrasado: true },
      }).estado,
    ).toBe("falha");
    expect(avaliarSaude({ ...bom, recalculo_diario: {} }).estado).toBe("falha");
    expect(
      avaliarSaude({
        ...bom,
        recalculo_diario: { atrasado: true, tolerancia_horas: null },
      }).verificacoes[1]?.detalhe,
    ).toContain("tolerância não configurada");
  });

  it("recálculo concluído com erro, job falho, webhook com falha e falhas recentes: atenção", () => {
    expect(
      estados({
        ...bom,
        recalculo_diario: { ...bom.recalculo_diario, com_erro: true },
      }).recalculo_diario,
    ).toBe("atencao");
    expect(
      estados({
        ...bom,
        cron: [{ job: "processar_automacoes", status: "failed" }],
      }).agendador,
    ).toBe("atencao");
    expect(
      estados({
        ...bom,
        webhooks: [{ origem: "autentique", falha_recente: true }],
      }).webhook_autentique,
    ).toBe("atencao");
    expect(
      estados({ ...bom, falhas: { janela_horas: 24, automacoes_com_falha: 2 } })
        .falhas_recentes,
    ).toBe("atencao");
    expect(
      estados({
        ...bom,
        falhas: { janela_horas: 24, sincronizacao_com_erro: 1 },
      }).falhas_recentes,
    ).toBe("atencao");
  });

  it("o pior estado manda", () => {
    const s = avaliarSaude({
      ...bom,
      recalculo_diario: { atrasado: true },
      falhas: { automacoes_com_falha: 5 },
    });
    expect(s.estado).toBe("falha");
  });

  it("nenhuma verificação carrega dado de pessoa", () => {
    const texto = JSON.stringify(
      avaliarSaude({
        ...bom,
        webhooks: [
          {
            origem: "whatsapp",
            falha_recente: true,
            ultima_falha_em: "2026-09-30T11:00:00Z",
          },
        ],
      }),
    );
    expect(texto).not.toMatch(/@|\+55|cpf/i);
  });
});
