import { describe, expect, it } from "vitest";
import { ErroRepositorio } from "@/lib/dados/erros";
import { centavosDoTexto, textoDeCentavos } from "./valores";
import { fraseConflito, fraseErroEquipe, fraseSinteseEquipe } from "./textos";

const VAZIO = {
  emVisita: 0,
  emAtendimento: 0,
  reservada: 0,
  backup: 0,
  ofertaPendente: 0,
  folga: 0,
  livre: 0,
  ofertaMaisAntigaHoras: null,
};

describe("fraseSinteseEquipe", () => {
  it("resume o dia da equipe em uma frase", () => {
    expect(
      fraseSinteseEquipe({
        ...VAZIO,
        emVisita: 3,
        livre: 1,
        reservada: 2,
        ofertaPendente: 1,
        ofertaMaisAntigaHoras: 18,
      }),
    ).toBe(
      "3 em visita agora, 1 livre, 2 reservadas para esta semana, 1 oferta sem resposta há 18 h.",
    );
  });

  it("passa a contar em dias quando a oferta espera 48 horas ou mais", () => {
    expect(
      fraseSinteseEquipe({
        ...VAZIO,
        ofertaPendente: 2,
        ofertaMaisAntigaHoras: 72,
      }),
    ).toBe("2 ofertas sem resposta há 3 dias.");
  });

  it("diz a verdade quando não há ninguém na equipe", () => {
    expect(fraseSinteseEquipe(VAZIO)).toBe(
      "Nenhuma enfermeira ativa na equipe ainda.",
    );
  });
});

describe("fraseConflito", () => {
  it("mostra o limite lido do parâmetro, sem número fixo", () => {
    expect(
      fraseConflito({ codigo: "limite_visitas_dia", limite: 3, quantas: 4 }),
    ).toBe("Passa do limite do dia: ficariam 4 visitas e o máximo é 3.");
  });

  it("diz o período que muda", () => {
    expect(
      fraseConflito({
        codigo: "periodo_diferente_do_d1",
        referencia: "manha",
        turno: "tarde",
      }),
    ).toMatch(/O período muda/);
  });

  it("tem frase para cada conflito", () => {
    for (const codigo of [
      "bloqueio",
      "sobreposicao",
      "profissional_inativa",
    ] as const) {
      expect(fraseConflito({ codigo }).length).toBeGreaterThan(10);
    }
  });
});

describe("fraseErroEquipe", () => {
  it("traduz o código do banco para o que fazer", () => {
    expect(
      fraseErroEquipe(new Error("equipe:saida_sem_chegada"), "gravar"),
    ).toBe("Registre a chegada antes da saída.");
  });

  it("sem permissão e sem conexão têm frase própria", () => {
    expect(
      fraseErroEquipe(new ErroRepositorio("sem_permissao", "x"), "gravar"),
    ).toMatch(/permissão/);
    expect(
      fraseErroEquipe(new ErroRepositorio("indisponivel", "x"), "gravar"),
    ).toMatch(/Nada foi alterado/);
  });

  it("erro desconhecido diz o que aconteceu e que nada mudou", () => {
    expect(fraseErroEquipe(new Error("boom"), "salvar a profissional")).toBe(
      "Não foi possível salvar a profissional. Nada foi alterado; tente de novo.",
    );
  });
});

describe("dinheiro em centavos", () => {
  it("converte o que a pessoa digita", () => {
    expect(centavosDoTexto("100")).toBe(10000);
    expect(centavosDoTexto("R$ 1.250,50")).toBe(125050);
    expect(centavosDoTexto("")).toBeNull();
    expect(Number.isNaN(centavosDoTexto("abc"))).toBe(true);
  });

  it("volta para o campo sem perder centavos", () => {
    expect(textoDeCentavos(10000)).toBe("100");
    expect(textoDeCentavos(10050)).toBe("100,50");
    expect(textoDeCentavos(null)).toBe("");
  });
});
