import { describe, expect, it } from "vitest";
import {
  contagemParaNavegacao,
  iniciais,
  lerFiltro,
  prazoCurto,
  quandoNaLista,
  rotuloDoDia,
} from "./lista";

const AGORA = new Date("2026-09-30T15:00:00.000Z"); // 12:00 em Brasília

describe("lerFiltro (a URL guarda o filtro da lista)", () => {
  it("aceita os filtros conhecidos e volta para 'todas' no resto", () => {
    expect(lerFiltro("esperando")).toBe("esperando");
    expect(lerFiltro("nao_lead")).toBe("nao_lead");
    expect(lerFiltro("qualquer")).toBe("todas");
    expect(lerFiltro(null)).toBe("todas");
  });
});

describe("iniciais do avatar", () => {
  it("pula 'Família' e 'Teste' e fica com até duas letras", () => {
    expect(iniciais("Família Teste Aurora")).toBe("A");
    expect(iniciais("Marina Alves de Souza")).toBe("MA");
    expect(iniciais("Íris")).toBe("Í");
  });
  it("telefone não vira letra (o avatar mostra o ícone de pessoa)", () => {
    expect(iniciais("+55 11 90000-0029")).toBe("");
    expect(iniciais(null)).toBe("");
  });
});

describe("hora na linha, como no WhatsApp", () => {
  it("hoje mostra a hora de Brasília; ontem, 'ontem'; antes, a data curta", () => {
    expect(quandoNaLista("2026-09-30T13:13:00.000Z", AGORA)).toBe("10:13");
    expect(quandoNaLista("2026-09-29T15:00:00.000Z", AGORA)).toBe("ontem");
    expect(quandoNaLista("2026-09-25T15:00:00.000Z", AGORA)).toBe("25/09");
    expect(quandoNaLista(null, AGORA)).toBe("");
  });
  it("separador de dia do fio: Hoje, Ontem ou a data", () => {
    expect(rotuloDoDia("2026-09-30T13:13:00.000Z", AGORA)).toBe("Hoje");
    expect(rotuloDoDia("2026-09-29T13:13:00.000Z", AGORA)).toBe("Ontem");
    expect(rotuloDoDia("2026-09-20T13:13:00.000Z", AGORA)).toBe("20/09/2026");
  });
});

describe("prazoCurto (o canto da linha)", () => {
  it("minutos, horas e dias; vencido vira 'venceu' com o resto para o leitor de tela", () => {
    expect(prazoCurto("2026-09-30T15:38:00.000Z", AGORA)).toEqual({
      antes: "vence em ",
      visivel: "38 min",
      depois: "",
    });
    expect(prazoCurto("2026-09-30T18:00:00.000Z", AGORA)?.visivel).toBe("3 h");
    expect(prazoCurto("2026-10-02T15:00:00.000Z", AGORA)?.visivel).toBe("2 d");
    expect(prazoCurto("2026-09-30T14:52:00.000Z", AGORA)).toEqual({
      antes: "",
      visivel: "venceu",
      depois: " há 8 min",
    });
    expect(prazoCurto(null, AGORA)).toBeNull();
  });
});

describe("contagemParaNavegacao (contador do item Conversas)", () => {
  const base = {
    status: "aberto" as const,
    prioridade: "normal" as const,
    motivo: "contratar" as const,
    criadoEm: "2026-09-30T14:00:00.000Z",
    slaVenceEm: "2026-09-30T18:00:00.000Z",
  };

  it("conta só quem espera alguém; no prazo, o contador é neutro", () => {
    expect(
      contagemParaNavegacao(
        [base, { ...base, status: "assumido" as const }],
        AGORA,
      ),
    ).toEqual({ esperando: 1, urgente: false });
  });

  it("prazo vencido ou relato de saúde pedem atenção", () => {
    expect(
      contagemParaNavegacao(
        [{ ...base, slaVenceEm: "2026-09-30T14:30:00.000Z" }],
        AGORA,
      ).urgente,
    ).toBe(true);
    expect(
      contagemParaNavegacao(
        [{ ...base, motivo: "saude" as const, prioridade: "maxima" as const }],
        AGORA,
      ).urgente,
    ).toBe(true);
  });

  it("perda nunca pinta o contador de vermelho (DESIGN.md, seção 8)", () => {
    expect(
      contagemParaNavegacao(
        [
          {
            ...base,
            motivo: "perda" as const,
            prioridade: "maxima" as const,
            slaVenceEm: "2026-09-30T14:30:00.000Z",
          },
        ],
        AGORA,
      ),
    ).toEqual({ esperando: 1, urgente: false });
  });
});
