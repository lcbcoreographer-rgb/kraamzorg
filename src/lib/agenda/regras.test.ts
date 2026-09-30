import { describe, expect, it } from "vitest";
import {
  conferirHorarioDoRegistro,
  conflitosVisita,
  situacaoDocumento,
  statusProfissional,
  turnoDaVisita,
  visitaMovivel,
  visitaOcupaAgenda,
  type AcompanhamentoRegra,
  type BloqueioRegra,
  type DesignacaoRegra,
  type ParametrosAgenda,
  type VisitaRegra,
} from "./regras";

/**
 * As mesmas contas do pgTAP 022 (privado.turno_da_visita,
 * privado.conflitos_visita, privado.status_profissional, 0007 e 0022), em
 * TypeScript, com o dia fixo em 29/09/2026 (terça-feira).
 */

const P: ParametrosAgenda = {
  visitasPorDia: 2,
  periodos: {
    manha: { inicio: "05:00", fim: "12:00" },
    tarde: { inicio: "12:00", fim: "20:00" },
  },
  janelaDpp: { antes: 21, depois: 14 },
  documentoAvisoDias: 30,
  registro: { toleranciaFuturoMinutos: 5, maxAtrasoHoras: 48 },
};

const HOJE = "2026-09-29";

function acomp(
  id: string,
  extra: Partial<AcompanhamentoRegra> = {},
): AcompanhamentoRegra {
  return {
    id,
    periodo: "manha",
    horasPorVisita: 3,
    estado: "ativo",
    familiaDpp: null,
    familiaDataNascimento: null,
    ...extra,
  };
}

let seq = 0;
function visita(
  extra: Partial<VisitaRegra> &
    Pick<VisitaRegra, "acompanhamentoId" | "profissionalId">,
): VisitaRegra {
  seq += 1;
  return {
    id: `v${seq}`,
    diaNumero: 1,
    data: HOJE,
    horaPrevista: "08:00",
    estado: "agendada",
    checkinEm: null,
    checkoutEm: null,
    ...extra,
  };
}

describe("turno da visita", () => {
  it("pela hora contra as faixas do parâmetro", () => {
    expect(turnoDaVisita("08:00", null, P)).toBe("manha");
    expect(turnoDaVisita("11:59", null, P)).toBe("manha");
    expect(turnoDaVisita("12:00", null, P)).toBe("tarde");
    expect(turnoDaVisita("19:59:00", null, P)).toBe("tarde");
    expect(turnoDaVisita("20:00", null, P)).toBeNull();
    expect(turnoDaVisita("04:59", null, P)).toBeNull();
  });

  it("sem hora, pelo período do acompanhamento", () => {
    expect(turnoDaVisita(null, "tarde", P)).toBe("tarde");
    expect(turnoDaVisita(null, "noite_avaliar", P)).toBeNull();
    expect(turnoDaVisita(null, null, P)).toBeNull();
  });
});

describe("estados da visita", () => {
  it("só a visita que não começou se reagenda", () => {
    for (const e of [
      "agendada",
      "confirmada",
      "a_caminho",
      "reagendada",
      "nao_realizada_familia",
      "nao_realizada_profissional",
    ] as const) {
      expect(visitaMovivel(e)).toBe(true);
    }
    for (const e of [
      "iniciada",
      "concluida",
      "ficha_pendente",
      "ficha_entregue",
      "encerrada",
      "cancelada",
    ] as const) {
      expect(visitaMovivel(e)).toBe(false);
    }
  });

  it("reagendada, cancelada e não realizada não ocupam a agenda", () => {
    expect(visitaOcupaAgenda("reagendada")).toBe(false);
    expect(visitaOcupaAgenda("cancelada")).toBe(false);
    expect(visitaOcupaAgenda("nao_realizada_familia")).toBe(false);
    expect(visitaOcupaAgenda("agendada")).toBe(true);
    expect(visitaOcupaAgenda("ficha_pendente")).toBe(true);
  });
});

describe("conflitos de uma visita", () => {
  const acomps = [
    acomp("A1"),
    acomp("A2", { periodo: "tarde" }),
    acomp("A6", { periodo: "tarde" }),
    acomp("A7"),
  ];
  const visitas = [
    visita({
      id: "a1d1",
      acompanhamentoId: "A1",
      profissionalId: "PA",
      horaPrevista: "08:00",
    }),
    visita({
      id: "a2d1",
      acompanhamentoId: "A2",
      profissionalId: "PA",
      horaPrevista: "14:00",
    }),
  ];
  const base = { profissionalId: "PA", profissionalAtiva: true, data: HOJE };

  it("horário livre da manhã: nenhum conflito", () => {
    const r = conflitosVisita(
      {
        ...base,
        horaPrevista: "10:00",
        acompanhamentoId: "A1",
        visitaId: "a1d3",
      },
      visitas,
      [],
      acomps,
      P,
    );
    expect(r).toEqual([]);
  });

  it("período diferente do D1 e sobreposição com a visita das 14:00", () => {
    const r = conflitosVisita(
      {
        ...base,
        horaPrevista: "14:30",
        acompanhamentoId: "A1",
        visitaId: "a1d3",
      },
      visitas,
      [],
      acomps,
      P,
    );
    expect(r.map((c) => c.codigo)).toEqual([
      "periodo_diferente_do_d1",
      "sobreposicao",
    ]);
    expect(r[0]).toMatchObject({ turno: "tarde", referencia: "manha" });
    expect(r[1]).toMatchObject({ visitaId: "a2d1" });
  });

  it("passar do limite de visitas por dia traz o limite e a contagem", () => {
    const r = conflitosVisita(
      {
        ...base,
        horaPrevista: "19:00",
        acompanhamentoId: "A6",
        visitaId: "a6d1",
      },
      visitas,
      [],
      acomps,
      P,
    );
    expect(r).toEqual([
      { codigo: "limite_visitas_dia", limite: 2, quantas: 3 },
    ]);
  });

  it("dia com bloqueio de agenda", () => {
    const bloqueios: BloqueioRegra[] = [
      { profissionalId: "PE", inicio: HOJE, fim: "2026-10-01" },
    ];
    const r = conflitosVisita(
      {
        profissionalId: "PE",
        profissionalAtiva: true,
        data: "2026-09-30",
        horaPrevista: "09:00",
        acompanhamentoId: "A7",
        visitaId: "a7d1",
      },
      [],
      bloqueios,
      acomps,
      P,
    );
    expect(r).toEqual([{ codigo: "bloqueio" }]);
  });

  it("profissional inativa", () => {
    const r = conflitosVisita(
      {
        ...base,
        profissionalAtiva: false,
        data: "2026-10-05",
        horaPrevista: "08:00",
        acompanhamentoId: "A1",
      },
      [],
      [],
      acomps,
      P,
    );
    expect(r).toEqual([{ codigo: "profissional_inativa" }]);
  });

  it("as visitas da mesma família não contam entre si", () => {
    const r = conflitosVisita(
      {
        ...base,
        horaPrevista: "08:00",
        acompanhamentoId: "A1",
        visitaId: "novo",
      },
      visitas,
      [],
      acomps,
      P,
    );
    expect(r).toEqual([]);
  });

  it("sem hora, o mesmo turno conta como sobreposto", () => {
    const semHora = [
      visita({
        id: "x",
        acompanhamentoId: "A1",
        profissionalId: "PZ",
        horaPrevista: null,
      }),
    ];
    const r = conflitosVisita(
      {
        profissionalId: "PZ",
        profissionalAtiva: true,
        data: HOJE,
        horaPrevista: "09:00",
        acompanhamentoId: "A7",
        visitaId: "a7d1",
      },
      semHora,
      [],
      acomps,
      P,
    );
    expect(r.map((c) => c.codigo)).toEqual(["sobreposicao"]);
  });

  it("visita reagendada não pesa na carga do dia", () => {
    const cheia = [
      ...visitas,
      visita({
        id: "r",
        acompanhamentoId: "A6",
        profissionalId: "PA",
        horaPrevista: "19:00",
        estado: "reagendada",
      }),
    ];
    const r = conflitosVisita(
      {
        ...base,
        horaPrevista: "18:00",
        acompanhamentoId: "A6",
        visitaId: "a6d2",
      },
      cheia,
      [],
      acomps,
      P,
    );
    expect(r.map((c) => c.codigo)).toEqual(["limite_visitas_dia"]);
  });
});

describe("estado calculado da profissional", () => {
  const acomps = [
    acomp("ATIVA", { estado: "ativo" }),
    acomp("ESPERA", { estado: "aguardando", familiaDpp: "2026-10-02" }),
    acomp("LONGE", { estado: "aguardando", familiaDpp: "2027-03-01" }),
    acomp("NASCEU", {
      estado: "aguardando",
      familiaDpp: "2026-10-02",
      familiaDataNascimento: "2026-09-27",
    }),
    acomp("FIM", { estado: "encerrado", familiaDpp: "2026-10-02" }),
  ];
  const desig = (
    profissionalId: string,
    acompanhamentoId: string,
    papel: "titular" | "backup",
    status: DesignacaoRegra["status"] = "aceita",
  ): DesignacaoRegra => ({
    profissionalId,
    acompanhamentoId,
    papel,
    status,
  });
  const calcular = (
    profissionalId: string,
    visitas: VisitaRegra[],
    designacoes: DesignacaoRegra[],
    bloqueios: BloqueioRegra[] = [],
    dia = HOJE,
  ) =>
    statusProfissional(
      { profissionalId, dia, hoje: HOJE },
      visitas,
      designacoes,
      acomps,
      bloqueios,
      P,
    );

  it("em visita: check-in feito e sem check-out, hoje", () => {
    const v = visita({
      acompanhamentoId: "ATIVA",
      profissionalId: "P",
      estado: "iniciada",
      checkinEm: "2026-09-29T11:05:00Z",
    });
    expect(calcular("P", [v], [desig("P", "ATIVA", "titular")])).toBe(
      "em_visita",
    );
  });

  it("volta a em atendimento depois do check-out", () => {
    const v = visita({
      acompanhamentoId: "ATIVA",
      profissionalId: "P",
      estado: "ficha_pendente",
      checkinEm: "2026-09-29T11:05:00Z",
      checkoutEm: "2026-09-29T14:00:00Z",
    });
    expect(calcular("P", [v], [desig("P", "ATIVA", "titular")])).toBe(
      "em_atendimento",
    );
  });

  it("em visita só vale para hoje", () => {
    const v = visita({
      acompanhamentoId: "ATIVA",
      profissionalId: "P",
      estado: "iniciada",
      checkinEm: "2026-09-29T11:05:00Z",
    });
    expect(
      calcular("P", [v], [desig("P", "ATIVA", "titular")], [], "2026-10-01"),
    ).toBe("em_atendimento");
  });

  it("em atendimento pede visita na semana do dia", () => {
    const daSemana = visita({
      acompanhamentoId: "ATIVA",
      profissionalId: "P",
      data: "2026-10-02",
    });
    const deOutraSemana = visita({
      acompanhamentoId: "ATIVA",
      profissionalId: "P",
      data: "2026-10-06",
    });
    expect(calcular("P", [daSemana], [desig("P", "ATIVA", "titular")])).toBe(
      "em_atendimento",
    );
    expect(
      calcular("P", [deOutraSemana], [desig("P", "ATIVA", "titular")]),
    ).toBe("livre");
  });

  it("reservada: titular de família que aguarda o nascimento com a janela da DPP na semana", () => {
    expect(calcular("P", [], [desig("P", "ESPERA", "titular")])).toBe(
      "reservada",
    );
    expect(calcular("P", [], [desig("P", "LONGE", "titular")])).toBe("livre");
    expect(calcular("P", [], [desig("P", "NASCEU", "titular")])).toBe("livre");
  });

  it("backup aceita de família na janela", () => {
    expect(calcular("P", [], [desig("P", "ESPERA", "backup")])).toBe("backup");
    expect(calcular("P", [], [desig("P", "FIM", "backup")])).toBe("livre");
  });

  it("oferta pendente e a precedência sobre folga", () => {
    const bloqueio: BloqueioRegra = {
      profissionalId: "P",
      inicio: HOJE,
      fim: HOJE,
    };
    expect(
      calcular(
        "P",
        [],
        [desig("P", "LONGE", "titular", "oferecida")],
        [bloqueio],
      ),
    ).toBe("oferta_pendente");
    expect(
      calcular(
        "P",
        [],
        [desig("P", "LONGE", "titular", "recusada")],
        [bloqueio],
      ),
    ).toBe("folga");
  });

  it("livre quando nada se aplica", () => {
    expect(calcular("P", [], [])).toBe("livre");
  });
});

describe("documentos", () => {
  it("vencido, vencendo em 30 dias, em dia e sem validade", () => {
    expect(situacaoDocumento("2026-09-28", HOJE, 30)).toBe("vencido");
    expect(situacaoDocumento(HOJE, HOJE, 30)).toBe("vencendo");
    expect(situacaoDocumento("2026-10-29", HOJE, 30)).toBe("vencendo");
    expect(situacaoDocumento("2026-10-30", HOJE, 30)).toBe("em_dia");
    expect(situacaoDocumento(null, HOJE, 30)).toBe("sem_validade");
  });
});

describe("hora de chegada e saída vinda do aparelho", () => {
  const agora = new Date("2026-09-29T14:00:00Z");
  it("aceita a hora do aparelho no dia da visita", () => {
    expect(
      conferirHorarioDoRegistro(
        new Date("2026-09-29T11:07:00Z"),
        agora,
        HOJE,
        HOJE,
        P,
      ),
    ).toBeNull();
  });
  it("recusa no futuro além da tolerância", () => {
    expect(
      conferirHorarioDoRegistro(
        new Date("2026-09-29T14:04:00Z"),
        agora,
        HOJE,
        HOJE,
        P,
      ),
    ).toBeNull();
    expect(
      conferirHorarioDoRegistro(
        new Date("2026-09-29T14:06:00Z"),
        agora,
        HOJE,
        HOJE,
        P,
      )?.codigo,
    ).toBe("hora_no_futuro");
  });
  it("recusa hora muito antiga e de outro dia", () => {
    expect(
      conferirHorarioDoRegistro(
        new Date("2026-09-27T11:00:00Z"),
        agora,
        HOJE,
        "2026-09-27",
        P,
      )?.codigo,
    ).toBe("hora_muito_antiga");
    expect(
      conferirHorarioDoRegistro(
        new Date("2026-09-28T20:00:00Z"),
        agora,
        HOJE,
        "2026-09-28",
        P,
      )?.codigo,
    ).toBe("fora_do_dia_da_visita");
  });
});
