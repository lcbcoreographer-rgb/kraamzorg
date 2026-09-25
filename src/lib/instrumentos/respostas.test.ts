import { describe, expect, it } from "vitest";
import doc2 from "../../../supabase/dados/instrumentos/doc2.json";
import doc1 from "../../../supabase/dados/instrumentos/doc1.json";
import { definicaoInstrumento, lerDefinicao } from "./schema";
import {
  alertasSatisfeitos,
  avaliarCondicao,
  comValor,
  etapasVisiveis,
  paraDados,
  pendenciasParaConcluir,
  respostasVazias,
  type RespostasFormulario,
} from "./respostas";

const DOC2 = lerDefinicao(doc2);
const DOC1 = lerDefinicao(doc1);
const GEMEOS = [
  { id: "bebe-a", rotulo: "Bebê 1" },
  { id: "bebe-b", rotulo: "Bebê 2" },
];

describe("esquema", () => {
  it("recusa condição que cita campo inexistente", () => {
    const resultado = definicaoInstrumento.safeParse({
      ...doc2,
      blocos: [
        {
          id: "1",
          titulo: "Teste",
          campos: [
            {
              id: "x",
              tipo: "texto",
              rotulo: "X",
              aparece_se: { campo: "1.nao_existe", operador: "=", valor: true },
            },
          ],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it("recusa campo repetido no mesmo bloco e id fora de snake_case", () => {
    const repetido = definicaoInstrumento.safeParse({
      ...doc2,
      cabecalho: undefined,
      blocos: [
        {
          id: "1",
          titulo: "Teste",
          campos: [
            { id: "a", tipo: "sim_nao", rotulo: "A" },
            { id: "a", tipo: "sim_nao", rotulo: "B" },
          ],
        },
      ],
    });
    expect(repetido.success).toBe(false);
    const semSnake = definicaoInstrumento.safeParse({
      ...doc2,
      cabecalho: undefined,
      blocos: [
        {
          id: "1",
          titulo: "T",
          campos: [{ id: "Dor Máxima", tipo: "sim_nao", rotulo: "A" }],
        },
      ],
    });
    expect(semSnake.success).toBe(false);
  });

  it("recusa regra que não é do DOC 3", () => {
    const resultado = definicaoInstrumento.safeParse({
      ...doc2,
      cabecalho: undefined,
      blocos: [
        {
          id: "1",
          titulo: "T",
          campos: [
            {
              id: "a",
              tipo: "sim_nao",
              rotulo: "A",
              alertas: [{ descricao: "x", regras: ["XX-01"] }],
            },
          ],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });
});

describe("condição para aparecer", () => {
  it("DOC 2: motivo do contato só aparece quando o contato com médico é necessário", () => {
    const campo = DOC2.blocos.find((b) => b.id === "9")?.campos[1];
    expect(campo?.aparece_se).toBeDefined();
    const cond = campo!.aparece_se!;
    let respostas = respostasVazias();
    expect(avaliarCondicao(cond, { definicao: DOC2, respostas })).toBe(false);
    respostas = comValor(
      respostas,
      { bloco: "9", campo: "contato_medico_necessario" },
      false,
    );
    expect(avaliarCondicao(cond, { definicao: DOC2, respostas })).toBe(false);
    respostas = comValor(
      respostas,
      { bloco: "9", campo: "contato_medico_necessario" },
      true,
    );
    expect(avaliarCondicao(cond, { definicao: DOC2, respostas })).toBe(true);
  });

  it("DOC 2: o bloco do último dia só vira etapa no último dia", () => {
    const ids = (ultimo: boolean) =>
      etapasVisiveis({
        definicao: DOC2,
        respostas: respostasVazias(),
        contexto: { ultimo_dia: ultimo },
      }).map((b) => b.id);
    expect(ids(false)).not.toContain("ultimo_dia");
    expect(ids(true)).toContain("ultimo_dia");
    expect(
      etapasVisiveis({ definicao: DOC2, respostas: respostasVazias() }),
    ).toHaveLength(26);
  });

  it("DOC 1: história de amamentação detalhada só quando amamentou antes", () => {
    const e = DOC1.blocos.find((b) => b.id === "E")!;
    const cond = e.campos[1]!.aparece_se!;
    const com = (v: string) =>
      comValor(
        respostasVazias(),
        { bloco: "E", campo: "amamentou_anteriormente" },
        v,
      );
    expect(
      avaliarCondicao(cond, { definicao: DOC1, respostas: com("nao") }),
    ).toBe(false);
    expect(
      avaliarCondicao(cond, {
        definicao: DOC1,
        respostas: com("nao_se_aplica"),
      }),
    ).toBe(false);
    expect(
      avaliarCondicao(cond, { definicao: DOC1, respostas: com("sim") }),
    ).toBe(true);
  });
});

describe("obrigatórios para concluir (PRD 9.2 v4.2)", () => {
  function preencherTudo(): RespostasFormulario {
    let r = respostasVazias();
    const pend = pendenciasParaConcluir(DOC2, r, { bebes: GEMEOS });
    for (const p of pend) r = comValor(r, p, valorQualquer(p.bloco, p.campo));
    return r;
  }

  function valorQualquer(bloco: string, campo: string) {
    const c = DOC2.blocos
      .find((b) => b.id === bloco)
      ?.campos.find((x) => x.id === campo);
    switch (c?.tipo) {
      case "sim_nao":
        return false;
      case "escala":
        return c.complemento ? { valor: 9, complemento: "otimo" } : 0;
      case "numero":
        return c.partes ? { partes: { sistolica: 110, diastolica: 70 } } : 1;
      case "opcao_unica":
        return c.opcoes[0]!.valor;
      case "multipla":
        return [c.opcoes[0]!.valor];
      default:
        return "texto sintético";
    }
  }

  it("lista data, horário, sinais vitais, o bloco de amamentação inteiro, os vitais e o peso de cada bebê e o resumo", () => {
    const pend = pendenciasParaConcluir(DOC2, respostasVazias(), {
      bebes: GEMEOS,
    });
    const chaves = pend.map((p) =>
      [p.bloco, p.campo, p.bebe].filter(Boolean).join("."),
    );
    expect(chaves).toContain("1.data");
    expect(chaves).toContain("1.horario");
    expect(chaves).toContain("2.1.pressao_arterial");
    expect(chaves).toContain("2.13.quem_mais_apoia");
    expect(chaves).toContain("3.1.peso.bebe-a");
    expect(chaves).toContain("3.1.peso.bebe-b");
    expect(chaves).toContain("resumo.resumo_descritivo");
    // assinatura é automática: conferida pelo P39 no ato de assinar
    expect(chaves).not.toContain("assinatura.enfermeira_e_hora");
    // último dia fora do contexto
    expect(chaves.some((c) => c.startsWith("ultimo_dia"))).toBe(false);
    // 2 + 3 (2.1) + 19 (2.5 a 2.13) + 4 × 2 bebês + 1 resumo
    expect(pend).toHaveLength(2 + 3 + 19 + 8 + 1);
  });

  it("some tudo quando tudo é respondido, e o peso de um bebê só não basta", () => {
    const completo = preencherTudo();
    expect(pendenciasParaConcluir(DOC2, completo, { bebes: GEMEOS })).toEqual(
      [],
    );
    const semPesoB = comValor(
      completo,
      { bloco: "3.1", campo: "peso", bebe: "bebe-b" },
      null,
    );
    expect(
      pendenciasParaConcluir(DOC2, semPesoB, { bebes: GEMEOS }).map(
        (p) => p.rotuloBebe,
      ),
    ).toEqual(["Bebê 2"]);
  });

  it("pressão arterial precisa das duas partes; LATCH precisa da nota e da avaliação", () => {
    let r = preencherTudo();
    r = comValor(
      r,
      { bloco: "2.1", campo: "pressao_arterial" },
      { partes: { sistolica: 110, diastolica: null } },
    );
    r = comValor(
      r,
      { bloco: "2.8", campo: "latch" },
      { valor: null, complemento: "ruim" },
    );
    expect(
      pendenciasParaConcluir(DOC2, r, { bebes: GEMEOS }).map((p) => p.campo),
    ).toEqual(["pressao_arterial", "latch"]);
  });

  it("no último dia, o pediatra aceita justificativa no lugar do contato", () => {
    let r = preencherTudo();
    const ctx = { ultimo_dia: true };
    expect(
      pendenciasParaConcluir(DOC2, r, { bebes: GEMEOS, contexto: ctx }).map(
        (p) => p.campo,
      ),
    ).toEqual(["contato_obstetra", "contato_pediatra", "resumo_encerramento"]);
    r = comValor(
      r,
      { bloco: "ultimo_dia", campo: "contato_obstetra" },
      "contato sintético",
    );
    r = comValor(
      r,
      { bloco: "ultimo_dia", campo: "contato_pediatra" },
      { ausente: true, justificativa: "" },
    );
    r = comValor(
      r,
      { bloco: "ultimo_dia", campo: "resumo_encerramento" },
      "resumo sintético",
    );
    expect(
      pendenciasParaConcluir(DOC2, r, { bebes: GEMEOS, contexto: ctx }).map(
        (p) => p.campo,
      ),
    ).toEqual(["contato_pediatra"]);
    r = comValor(
      r,
      { bloco: "ultimo_dia", campo: "contato_pediatra" },
      { ausente: true, justificativa: "Família não tinha o número." },
    );
    expect(
      pendenciasParaConcluir(DOC2, r, { bebes: GEMEOS, contexto: ctx }),
    ).toEqual([]);
  });
});

describe("alertas ligados", () => {
  const temperatura = DOC2.blocos.find((b) => b.id === "2.1")!.campos[1]!;
  const tempRn = DOC2.blocos.find((b) => b.id === "3.1")!.campos[0]!;

  it("temperatura da puérpera: 38 dispara PU-01; 37,6 cai na faixa de PU-08; 36,8 nada", () => {
    const regras = (v: number) => {
      const r = comValor(
        respostasVazias(),
        { bloco: "2.1", campo: "temperatura" },
        v,
      );
      return alertasSatisfeitos(
        temperatura,
        { bloco: "2.1", campo: "temperatura" },
        { definicao: DOC2, respostas: r },
      ).flatMap((a) => a.regras);
    };
    expect(regras(38)).toEqual(["PU-01"]);
    expect(regras(37.6)).toEqual(["PU-08"]);
    expect(regras(36.8)).toEqual([]);
  });

  it("temperatura do RN avalia o bebê certo em gemelares (RN-08)", () => {
    let r = respostasVazias();
    r = comValor(
      r,
      { bloco: "3.1", campo: "temperatura", bebe: "bebe-a" },
      36.7,
    );
    r = comValor(
      r,
      { bloco: "3.1", campo: "temperatura", bebe: "bebe-b" },
      35.6,
    );
    const para = (bebe: string) =>
      alertasSatisfeitos(
        tempRn,
        { bloco: "3.1", campo: "temperatura", bebe },
        { definicao: DOC2, respostas: r },
      ).flatMap((a) => a.regras);
    expect(para("bebe-a")).toEqual([]);
    expect(para("bebe-b")).toEqual(["RN-08"]);
  });

  it("sem resposta, nada dispara", () => {
    expect(
      alertasSatisfeitos(
        temperatura,
        { bloco: "2.1", campo: "temperatura" },
        { definicao: DOC2, respostas: respostasVazias() },
      ),
    ).toEqual([]);
  });
});

describe("forma de registro_atendimento.dados", () => {
  it("bloco do recém-nascido vira lista, um item por bebê", () => {
    let r = respostasVazias();
    r = comValor(r, { bloco: "1", campo: "data" }, "2030-01-10");
    r = comValor(r, { bloco: "3.1", campo: "peso", bebe: "bebe-a" }, 2890);
    r = comValor(r, { bloco: "3.1", campo: "peso", bebe: "bebe-b" }, 2710);
    const dados = paraDados(DOC2, r, GEMEOS);
    expect(dados["1"]).toEqual({ data: "2030-01-10" });
    expect(dados["3.1"]).toEqual([
      { peso: 2890, bebe_id: "bebe-a" },
      { peso: 2710, bebe_id: "bebe-b" },
    ]);
    expect(dados["3"]).toEqual([{ bebe_id: "bebe-a" }, { bebe_id: "bebe-b" }]);
  });
});
