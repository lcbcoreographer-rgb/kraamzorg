import { describe, expect, it } from "vitest";
import type {
  DesignadaNoRadar,
  OcupacaoSemana,
  Radar,
  RadarFamilia,
} from "@/lib/dados/tipos-operacao";
import {
  agruparRadar,
  contarUrgentes,
  filtrarPorPraca,
  ocupacaoPorPraca,
  pontosDeAtencao,
  pracasDoRadar,
} from "./agrupar";

function desig(
  status: DesignadaNoRadar["status"] = "aceita",
): DesignadaNoRadar {
  return {
    designacaoId: "d",
    profissionalId: "p",
    nome: "Sul 1",
    status,
    prazoRespostaEm: null,
  };
}

function familia(
  nome: string,
  extra: Partial<RadarFamilia> = {},
): RadarFamilia {
  return {
    familiaId: `f-${nome}`,
    nome,
    cidade: "São Paulo",
    uf: "SP",
    regiaoId: "r1",
    regiao: "São Paulo",
    gemelar: false,
    dpp: "2026-10-20",
    ig: "37s0d",
    igSemanas: 37,
    diasParaDpp: 21,
    naJanela: false,
    passouDaJanela: false,
    estagioP2: "aguardando_nascimento",
    consultaStatus: "realizada",
    titular: desig(),
    backup: desig(),
    ultimoContato: "2026-09-28T12:00:00Z",
    diasSemContato: 1,
    semContato: false,
    checkinPendente: false,
    dppSemConfirmacao: false,
    dppSemContato: false,
    estadoSensivel: "normal",
    ...extra,
  };
}

function ocupacao(
  regiaoId: string,
  regiao: string,
  semana: string,
  pct: number,
): OcupacaoSemana {
  return {
    regiaoId,
    regiao,
    semana,
    ocupacaoPct: pct,
    familias: 1,
    acimaDoLimite: pct >= 85,
  };
}

function radar(familias: RadarFamilia[]): Radar {
  return {
    hoje: "2026-09-29",
    janela: { antes: 21, depois: 14 },
    limiteAlertaPct: 85,
    familias,
    nasceram: [
      {
        familiaId: "n1",
        nome: "N1",
        regiaoId: "r1",
        dataNascimento: "2026-09-28",
        estagioP2: "bebe_nasceu",
        previsaoAlta: null,
        titular: null,
      },
      {
        familiaId: "n2",
        nome: "N2",
        regiaoId: "r2",
        dataNascimento: "2026-09-28",
        estagioP2: "bebe_nasceu",
        previsaoAlta: null,
        titular: null,
      },
    ],
    ocupacao: [
      ocupacao("r2", "Londrina", "2026-09-28", 20),
      ocupacao("r1", "São Paulo", "2026-10-05", 90),
      ocupacao("r1", "São Paulo", "2026-09-28", 40),
    ],
  };
}

describe("agruparRadar", () => {
  it("separa quem está na janela, quem passou dela e quem ainda está longe", () => {
    const g = agruparRadar([
      familia("A", { naJanela: true }),
      familia("B", { passouDaJanela: true }),
      familia("C"),
    ]);
    expect(g.naJanela.map((f) => f.nome)).toEqual(["A"]);
    expect(g.passaramDaJanela.map((f) => f.nome)).toEqual(["B"]);
    expect(g.adiante.map((f) => f.nome)).toEqual(["C"]);
  });
});

describe("filtro por praça", () => {
  const r = radar([
    familia("A"),
    familia("B", { regiaoId: "r2", regiao: "Londrina" }),
  ]);
  it("lista as praças em ordem alfabética, sem repetir", () => {
    expect(pracasDoRadar(r).map((p) => p.regiao)).toEqual([
      "Londrina",
      "São Paulo",
    ]);
  });
  it("sem filtro devolve tudo; com filtro, só a praça", () => {
    expect(filtrarPorPraca(r, null)).toBe(r);
    const f = filtrarPorPraca(r, "r2");
    expect(f.familias.map((x) => x.nome)).toEqual(["B"]);
    expect(f.nasceram.map((x) => x.nome)).toEqual(["N2"]);
    expect(f.ocupacao.map((x) => x.regiao)).toEqual(["Londrina"]);
  });
});

describe("pontosDeAtencao", () => {
  it("família tranquila não tem ponto", () => {
    expect(pontosDeAtencao(familia("A"))).toEqual([]);
  });

  it("sem titular na janela do parto é alerta, e vem primeiro", () => {
    const pontos = pontosDeAtencao(
      familia("A", { naJanela: true, titular: null, backup: null }),
    );
    expect(pontos[0]).toMatchObject({ chave: "sem_titular", tom: "alerta" });
    expect(pontos.map((p) => p.chave)).toContain("sem_backup");
  });

  it("sem titular fora da janela é só aviso", () => {
    expect(pontosDeAtencao(familia("A", { titular: null }))[0]).toMatchObject({
      chave: "sem_titular",
      tom: "aviso",
    });
  });

  it("titular recusada ou com prazo vencido conta como sem titular; oferta sem resposta, não", () => {
    expect(
      pontosDeAtencao(familia("A", { titular: desig("recusada") }))[0]!.chave,
    ).toBe("sem_titular");
    expect(
      pontosDeAtencao(familia("A", { titular: desig("expirada") }))[0]!.chave,
    ).toBe("sem_titular");
    expect(
      pontosDeAtencao(familia("A", { titular: desig("oferecida") }))[0]!.chave,
    ).toBe("titular_sem_resposta");
  });

  it("DPP passada sem resposta da família é alerta; sem confirmação, aviso; check-in pendente e sem contato", () => {
    const a = pontosDeAtencao(
      familia("A", { dppSemContato: true, dppSemConfirmacao: true }),
    );
    expect(a.find((p) => p.chave === "dpp_sem_contato")?.tom).toBe("alerta");
    expect(a.some((p) => p.chave === "dpp_sem_confirmacao")).toBe(false);

    const b = pontosDeAtencao(familia("A", { dppSemConfirmacao: true }));
    expect(b.find((p) => p.chave === "dpp_sem_confirmacao")?.tom).toBe("aviso");

    const c = pontosDeAtencao(
      familia("A", {
        checkinPendente: true,
        semContato: true,
        diasSemContato: 9,
      }),
    );
    expect(c.map((p) => p.texto)).toEqual([
      "Check-in da data provável pendente",
      "Sem contato há 9 dias",
    ]);
    expect(
      pontosDeAtencao(
        familia("A", { semContato: true, diasSemContato: null }),
      ).map((p) => p.texto),
    ).toEqual(["Sem nenhum contato registrado"]);
    expect(
      pontosDeAtencao(
        familia("A", { semContato: true, diasSemContato: 1 }),
      ).map((p) => p.texto),
    ).toEqual(["Sem contato há 1 dia"]);
  });

  it("contarUrgentes conta as famílias com algum ponto de alerta", () => {
    expect(
      contarUrgentes([
        familia("A", { naJanela: true, titular: null }),
        familia("B"),
        familia("C", { dppSemContato: true }),
        familia("D", { checkinPendente: true }),
      ]),
    ).toBe(2);
  });
});

describe("ocupacaoPorPraca", () => {
  it("agrupa por praça e ordena as semanas", () => {
    const linhas = ocupacaoPorPraca(radar([]).ocupacao);
    expect(linhas.map((l) => l.regiao)).toEqual(["Londrina", "São Paulo"]);
    expect(linhas[1]!.semanas.map((s) => s.semana)).toEqual([
      "2026-09-28",
      "2026-10-05",
    ]);
  });
});
