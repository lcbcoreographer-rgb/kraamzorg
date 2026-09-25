import { describe, expect, it } from "vitest";
import {
  destinosPermitidos,
  papelProvavelmenteConfirma,
  rotuloEstagio,
} from "./estagios";

describe("destinosPermitidos: espelha privado.transicao_permitida (PRD 7.1 e 7.2)", () => {
  it("de novo (P1): em_conversa_ia, nao_qualificado, fora_de_cobertura, nutricao e perdido", () => {
    const destinos = destinosPermitidos(1, "novo").map((d) => d.estagio);
    expect(destinos.sort()).toEqual(
      [
        "em_conversa_ia",
        "nao_qualificado",
        "fora_de_cobertura",
        "nutricao",
        "perdido",
      ].sort(),
    );
  });

  it("sessao_venda_realizada não existe como origem em P1 (é o fim da linha principal)", () => {
    // sessao_venda_realizada só tem saída para o pipeline 2, que é outra máquina.
    expect(destinosPermitidos(1, "sessao_venda_realizada")).toEqual([]);
  });

  it("de qualificado (P1) não inclui sessao_venda_realizada direto (falta a sessão)", () => {
    const destinos = destinosPermitidos(1, "qualificado").map((d) => d.estagio);
    expect(destinos).not.toContain("sessao_venda_realizada");
    expect(destinos).toContain("sessao_venda_agendada");
    expect(destinos).toContain("perdido");
  });

  it("null sem estágio (oportunidade sem estagio_p2 ainda, olhando P2)", () => {
    expect(destinosPermitidos(2, null)).toEqual([]);
  });

  it("de intercorrencia (P2) só a coordenação, e só de volta ao que existia antes", () => {
    const destinos = destinosPermitidos(2, "intercorrencia");
    expect(destinos.length).toBeGreaterThan(0);
    expect(destinos.every((d) => d.papelMinimo === "coordenacao")).toBe(true);
  });

  it("qualquer estágio ativo do P2 pode ir para intercorrencia, sem papel mínimo (0006: 'qualquer pessoa com papel, ou o sistema')", () => {
    const destino = destinosPermitidos(2, "pagamento_confirmado").find(
      (d) => d.estagio === "intercorrencia",
    );
    expect(destino).toBeTruthy();
    expect(destino?.papelMinimo).toBeNull();
  });

  it("bebe_nasceu chega de qualquer estágio depois de pagamento_confirmado (PRD 7.2, protótipo comercial-pipeline.html)", () => {
    for (const de of [
      "pagamento_confirmado",
      "nota_fiscal_emitida",
      "consulta_prenatal_agendada",
      "consulta_realizada",
      "enfermeira_designada",
      "aguardando_nascimento",
    ] as const) {
      const destinos = destinosPermitidos(2, de).map((d) => d.estagio);
      expect(destinos).toContain("bebe_nasceu");
    }
  });

  it("a linha principal automática do P2 (ganho até atendimento_liberado) continua no menu, com o papel de quem confirma", () => {
    expect(destinosPermitidos(2, "ganho").map((d) => d.estagio)).toContain(
      "contrato_gerado",
    );
    const paraCobranca = destinosPermitidos(2, "assinado").find(
      (d) => d.estagio === "cobranca_gerada",
    );
    expect(paraCobranca?.papelMinimo).toBe("financeiro");
    expect(
      destinosPermitidos(2, "aguardando_alta").map((d) => d.estagio),
    ).toContain("atendimento_liberado");
  });

  it("rótulo de cada destino já vem pronto para o menu", () => {
    const destino = destinosPermitidos(1, "novo").find(
      (d) => d.estagio === "perdido",
    );
    expect(destino?.rotulo).toBe("Perdido");
  });
});

describe("papelProvavelmenteConfirma: cosmético, a defesa real é o banco", () => {
  it("sem papel mínimo, qualquer papel passa", () => {
    expect(papelProvavelmenteConfirma(["comercial"], null, "novo")).toBe(true);
  });

  it("com o papel mínimo, passa", () => {
    expect(
      papelProvavelmenteConfirma(
        ["coordenacao"],
        "coordenacao",
        "nota_fiscal_emitida",
      ),
    ).toBe(true);
  });

  it("diretoria substitui qualquer papel, menos saindo de intercorrencia", () => {
    expect(
      papelProvavelmenteConfirma(["diretoria"], "coordenacao", "assinado"),
    ).toBe(true);
    expect(
      papelProvavelmenteConfirma(
        ["diretoria"],
        "coordenacao",
        "intercorrencia",
      ),
    ).toBe(false);
  });

  it("sem o papel nem diretoria, não passa", () => {
    expect(
      papelProvavelmenteConfirma(["comercial"], "diretoria", "assinado"),
    ).toBe(false);
  });
});

describe("rotuloEstagio", () => {
  it("nomes em português, sem código de banco cru", () => {
    expect(rotuloEstagio(1, "em_conversa_ia")).toBe("Em conversa");
    expect(rotuloEstagio(2, "aguardando_nascimento")).toBe(
      "Aguardando nascimento",
    );
  });
});
