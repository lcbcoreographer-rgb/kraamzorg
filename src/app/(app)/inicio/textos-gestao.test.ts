import { describe, expect, it } from "vitest";
import type { AlertaClinicoResumo } from "@/lib/dados/tipos-assistencial";
import type { VisitaAgenda } from "@/lib/dados/tipos-equipe";
import type { RadarFamilia } from "@/lib/dados/tipos-operacao";
import {
  alertasEmOrdem,
  contextoOfertas,
  fichasSemAssinatura,
  fraseAlertas,
  fraseRadar,
  fraseSessoes,
  radarDaSemana,
  visitasPorEnfermeira,
} from "./textos-gestao";

function visita(parcial: Partial<VisitaAgenda>): VisitaAgenda {
  return {
    visitaId: "v",
    acompanhamentoId: "a",
    familiaId: "f",
    nomeExibicao: "Família Teste Lua",
    bairro: null,
    cidade: null,
    diaNumero: 1,
    diasContratados: 6,
    data: "2026-09-30",
    horaPrevista: "08:00",
    horasPorVisita: 4,
    turno: "manha",
    estado: "agendada",
    profissionalId: "p1",
    profissionalNome: "Profissional Teste Sul 1",
    movivel: true,
    conflitos: [],
    ...parcial,
  };
}

function alerta(parcial: Partial<AlertaClinicoResumo>): AlertaClinicoResumo {
  return {
    id: "a",
    familiaId: "f",
    nomeFamilia: "Família Teste Cedro",
    estadoSensivel: "normal",
    visitaId: null,
    diaNumero: 2,
    bebeId: null,
    regraId: "r",
    grupo: "g",
    descricao: "d",
    severidade: "prioritario",
    campo: null,
    valorObservado: null,
    conduta: "c",
    criadoEm: "2026-09-30T10:00:00Z",
    reconhecidoEm: null,
    sinalIdentificado: null,
    acionadoEm: null,
    orientacaoMedica: null,
    condutaAdotada: null,
    fechadoEm: null,
    versao: 1,
    ...parcial,
  };
}

describe("Início da coordenação e da diretoria", () => {
  it("visitas de hoje por enfermeira: só o dia, sem canceladas, em ordem de hora", () => {
    const grupos = visitasPorEnfermeira(
      [
        visita({ visitaId: "1", horaPrevista: "14:00" }),
        visita({ visitaId: "2", horaPrevista: "09:00" }),
        visita({ visitaId: "3", estado: "cancelada" }),
        visita({ visitaId: "4", data: "2026-10-01" }),
        visita({
          visitaId: "5",
          profissionalId: "p2",
          profissionalNome: "Profissional Teste Norte 1",
        }),
      ],
      "2026-09-30",
    );
    expect(grupos.map((g) => g.nome)).toEqual([
      "Profissional Teste Norte 1",
      "Profissional Teste Sul 1",
    ]);
    expect(grupos[1]!.visitas.map((v) => v.visitaId)).toEqual(["2", "1"]);
  });

  it("fichas sem assinatura são as visitas em ficha pendente", () => {
    expect(
      fichasSemAssinatura([
        visita({ estado: "ficha_pendente" }),
        visita({ estado: "ficha_entregue" }),
      ]),
    ).toHaveLength(1);
  });

  it("ofertas: a espera em horas ou dias, nunca número solto", () => {
    expect(contextoOfertas(0, null)).toBe("todas respondidas");
    expect(contextoOfertas(1, 18)).toBe("a mais antiga há 18 h");
    expect(contextoOfertas(2, 50)).toBe("a mais antiga há 2 dias");
  });

  it("alertas: imediato primeiro e a frase diz o que falta registrar", () => {
    const lista = [
      alerta({ id: "b", severidade: "prioritario" }),
      alerta({ id: "a", severidade: "imediato" }),
    ];
    expect(alertasEmOrdem(lista).map((a) => a.id)).toEqual(["a", "b"]);
    expect(fraseAlertas(lista)).toBe(
      "2 alertas abertos, 1 pede conduta imediata. 2 ainda esperam o registro do acionamento.",
    );
    expect(fraseAlertas([])).toMatch(/^Nenhum alerta clínico aberto agora/);
  });

  it("radar da semana: de hoje até domingo, e a DPP dita como estimativa", () => {
    const f = (dpp: string) => ({ familiaId: dpp, dpp }) as RadarFamilia;
    const semana = radarDaSemana(
      [f("2026-10-05"), f("2026-10-02"), f("2026-09-29"), f("2026-10-04")],
      "2026-09-30",
      "2026-10-04",
    );
    expect(semana.map((x) => x.dpp)).toEqual(["2026-10-02", "2026-10-04"]);
    expect(fraseRadar(2, 1)).toMatch(/estimativa e não move nada sozinha\.$/);
  });

  it("sessões: o que espera registro vem antes do que está marcado", () => {
    expect(fraseSessoes(1, 3)).toBe(
      "Uma conversa já passou do horário e espera o registro de como foi.",
    );
    expect(fraseSessoes(0, 2)).toBe(
      "Nenhuma conversa espera registro. 2 conversas marcadas pela frente.",
    );
  });
});
