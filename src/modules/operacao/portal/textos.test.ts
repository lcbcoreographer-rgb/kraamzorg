import { describe, expect, it } from "vitest";
import type { FamiliaPortal } from "@/lib/dados/tipos-equipe";
import {
  diaEmFrase,
  enderecoEmTexto,
  fraseDoDia,
  fraseEstadoSensivel,
  fraseProximaVisita,
  ligacaoDeMapa,
  proximaVisitaDaFamilia,
  rotuloAcompanhamento,
  tituloDeHoje,
  visitasDoDiaSeguinte,
} from "./textos";

function visita(
  sobrescreve: Partial<FamiliaPortal["visitas"][number]> = {},
): FamiliaPortal["visitas"][number] {
  return {
    visitaId: "v1",
    diaNumero: 2,
    data: "2026-09-30",
    horaPrevista: "09:00",
    estado: "agendada",
    checkinEm: null,
    checkoutEm: null,
    ...sobrescreve,
  };
}

function familia(visitas: FamiliaPortal["visitas"]): FamiliaPortal {
  return {
    familiaId: "f1",
    nomeExibicao: "Família Teste",
    bairro: null,
    cidade: null,
    uf: null,
    dpp: null,
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    gemelar: false,
    estadoSensivel: "normal",
    papel: "titular",
    acompanhamento: null,
    visitas,
  };
}

describe("títulos e frases do dia", () => {
  it("escreve o dia em português, sem dois pontos nem travessão", () => {
    expect(diaEmFrase("2026-09-24")).toBe("quinta 24/09");
    expect(tituloDeHoje("2026-09-29")).toBe("Hoje, terça 29/09");
  });

  it("resume as visitas do dia por turno", () => {
    expect(fraseDoDia([])).toBe("Nenhuma visita marcada para hoje.");
    expect(fraseDoDia([{ turno: "tarde" }])).toBe("Uma visita, à tarde.");
    expect(fraseDoDia([{ turno: "manha" }, { turno: "tarde" }])).toBe(
      "Duas visitas, manhã e tarde.",
    );
  });
});

describe("endereço e mapa", () => {
  it("junta só as partes que existem", () => {
    expect(
      enderecoEmTexto(
        { logradouro: "Rua das Flores", numero: "10", bairro: "Centro" },
        "Cidade Teste",
        null,
      ),
    ).toBe("Rua das Flores, 10, Centro, Cidade Teste");
    expect(enderecoEmTexto(null, null, null)).toBeNull();
  });

  it("abre o mapa do aparelho sem passar por site nenhum", () => {
    expect(ligacaoDeMapa("Rua A, 1")).toBe("geo:0,0?q=Rua%20A%2C%201");
  });
});

describe("estado sensível", () => {
  it("família normal não leva aviso", () => {
    expect(fraseEstadoSensivel("normal")).toBeNull();
  });

  it("família em pausa diz que nenhuma mensagem automática sai", () => {
    expect(fraseEstadoSensivel("bloqueio_total")).toMatch(
      /Nenhuma mensagem automática/,
    );
    expect(fraseEstadoSensivel("atencao")).toMatch(/coordenação/);
  });
});

describe("próxima visita da família", () => {
  it("pega a primeira visita aberta de hoje em diante", () => {
    const f = familia([
      visita({ visitaId: "passada", data: "2026-09-28", estado: "concluida" }),
      visita({ visitaId: "b", data: "2026-10-01", horaPrevista: "09:00" }),
      visita({ visitaId: "a", data: "2026-09-30", horaPrevista: "14:00" }),
      visita({
        visitaId: "cancelada",
        data: "2026-09-29",
        estado: "cancelada",
      }),
    ]);
    expect(proximaVisitaDaFamilia(f, "2026-09-29")?.visitaId).toBe("a");
  });

  it("sem visita aberta, diz que não há", () => {
    expect(fraseProximaVisita(null)).toBe(
      "Nenhuma visita marcada por enquanto.",
    );
    expect(fraseProximaVisita(visita())).toBe(
      "Próxima visita: quarta 30/09 às 09:00, dia 2.",
    );
  });

  it("dá um rótulo para cada estado do acompanhamento", () => {
    expect(rotuloAcompanhamento("em_execucao")).toBe("Em acompanhamento");
    expect(rotuloAcompanhamento(null)).toBe("Sem acompanhamento marcado");
  });

  it("lista as visitas de amanhã por hora", () => {
    const f = familia([
      visita({ visitaId: "x", data: "2026-09-30", horaPrevista: "14:00" }),
      visita({ visitaId: "y", data: "2026-09-30", horaPrevista: "08:00" }),
      visita({ visitaId: "z", data: "2026-09-30", estado: "reagendada" }),
    ]);
    const lista = visitasDoDiaSeguinte([f], "2026-09-30");
    expect(lista.map((v) => v.horaPrevista)).toEqual(["08:00", "14:00"]);
  });
});

describe("sem travessão nem meia-risca nos textos do portal e da equipe", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  function arquivos(pasta: string): string[] {
    return readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome);
      return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
    });
  }

  it("nenhum arquivo de tela tem travessão ou meia-risca", () => {
    const pastas = [
      "src/modules/operacao/portal",
      "src/modules/operacao/equipe",
      "src/app/(enfermeira)",
      "src/app/(app)/equipe",
      "src/app/(app)/agenda",
      "src/app/portal-offline",
    ];
    const achados = pastas
      .flatMap(arquivos)
      .filter((a) => /\.(tsx?|md)$/.test(a) && !a.endsWith("textos.test.ts"))
      .filter((a) => /[\u2013\u2014]/.test(readFileSync(a, "utf8")));
    expect(achados).toEqual([]);
  });
});
