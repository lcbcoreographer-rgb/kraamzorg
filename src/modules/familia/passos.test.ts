import { describe, expect, it } from "vitest";
import type { PortalFamiliaCompleto } from "@/lib/dados/tipos-relacao";
import { montarPassos } from "./passos";

const base: PortalFamiliaCompleto = {
  situacao: "ok",
  primeiroNome: "Aurora",
  nomeFamilia: "Família Teste Aurora",
  gemelar: false,
  datas: {
    dpp: "2026-10-20",
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
  },
  contratoAssinadoEm: "2026-09-06T10:00:00-03:00",
  pagamentoConfirmadoEm: null,
  prenatal: null,
  acompanhamento: null,
  enfermeira: null,
  visitas: [],
  pesquisa: null,
  evolucoes: { ativo: false, itens: [] },
  contato: { nome: null, telefoneE164: null, horario: null, funcao: null },
  textos: {
    passo_contrato: "Contrato assinado",
    passo_pagamento: "Pagamento confirmado",
    agora_pagamento: "Estamos confirmando o pagamento.",
  },
};

describe("próximos passos da família (P49)", () => {
  it("só um passo é o de agora: o primeiro que falta", () => {
    const passos = montarPassos(base, "2026-09-30");
    expect(passos.filter((p) => p.estado === "agora")).toHaveLength(1);
    expect(passos.find((p) => p.estado === "agora")?.chave).toBe("pagamento");
    expect(passos[0]).toMatchObject({
      chave: "contrato",
      estado: "feito",
      titulo: "Contrato assinado",
    });
    expect(passos.find((p) => p.chave === "pagamento")?.apoio).toBe(
      "Estamos confirmando o pagamento.",
    );
    expect(passos.find((p) => p.chave === "alta")?.estado).toBe("depois");
  });

  it("a DPP é estimativa e nunca faz o nascimento ou a alta acontecerem", () => {
    const passos = montarPassos(
      { ...base, datas: { ...base.datas, dpp: "2020-01-01" } },
      "2026-09-30",
    );
    expect(passos.find((p) => p.chave === "nascimento")?.estado).not.toBe(
      "feito",
    );
    expect(passos.find((p) => p.chave === "nascimento")?.data).toBeNull();
    expect(passos.find((p) => p.chave === "alta")?.estado).not.toBe("feito");
  });

  it("nascimento e alta só valem com a data de fato", () => {
    const passos = montarPassos(
      {
        ...base,
        pagamentoConfirmadoEm: "2026-09-07T10:00:00-03:00",
        prenatal: {
          estado: "realizada",
          agendadaPara: null,
          realizadaEm: "2026-09-12T10:40:00-03:00",
        },
        enfermeira: { nome: null, fotoPath: null },
        datas: {
          dpp: "2026-10-20",
          dataNascimento: "2026-10-05",
          dataAlta: "2026-10-07",
          dataInicioEfetivo: "2026-10-08",
        },
        visitas: [
          { dia: 1, data: "2026-10-08", hora: "09:00", feita: true },
          { dia: 2, data: "2026-10-09", hora: "09:00", feita: false },
        ],
      },
      "2026-10-08",
    );
    expect(passos.find((p) => p.chave === "nascimento")).toMatchObject({
      estado: "feito",
      data: "2026-10-05",
    });
    expect(passos.find((p) => p.chave === "alta")).toMatchObject({
      estado: "feito",
      data: "2026-10-07",
    });
    const visitas = passos.find((p) => p.chave === "visitas")!;
    expect(visitas.estado).toBe("agora");
    expect(visitas.data).toBe("2026-10-09");
    expect(visitas.dataMarcada).toBe(true);
  });
});
