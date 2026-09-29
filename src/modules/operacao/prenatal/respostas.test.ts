import { describe, expect, it } from "vitest";
import doc1 from "../../../../supabase/dados/instrumentos/doc1.json";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import type { RespostasFormulario } from "@/lib/instrumentos/respostas";
import { respostasEmTexto, textoDoValor } from "./respostas";

const definicao = lerDefinicao(doc1);

function campo(bloco: string, id: string) {
  const c = definicao.blocos
    .find((b) => b.id === bloco)
    ?.campos.find((x) => x.id === id);
  if (!c) throw new Error(`${bloco}.${id}`);
  return c;
}

describe("textoDoValor", () => {
  it("texto, número, sim ou não e data", () => {
    expect(textoDoValor(campo("C", "nome_da_gestante"), "Ana Teste")).toBe(
      "Ana Teste",
    );
    expect(textoDoValor(campo("C", "idade_da_gestante"), 31)).toBe("31 anos");
    expect(textoDoValor(campo("E", "dor_lesao_mamilar_anterior"), true)).toBe(
      "Sim",
    );
    expect(textoDoValor(campo("E", "dor_lesao_mamilar_anterior"), false)).toBe(
      "Não",
    );
    expect(
      textoDoValor(campo("B", "data_provavel_do_parto"), "2026-11-08"),
    ).toBe("08/11/2026");
  });

  it("opção única mostra o rótulo aprovado, não o valor interno", () => {
    const c = campo("D", "gestacoes_anteriores");
    if (!("opcoes" in c)) throw new Error("sem opções");
    const primeira = c.opcoes[0]!;
    expect(textoDoValor(c, primeira.valor)).toBe(primeira.rotulo);
  });

  it("valor que a definição não conhece aparece como está", () => {
    expect(
      textoDoValor(campo("D", "gestacoes_anteriores"), "valor_desconhecido"),
    ).toBe("valor_desconhecido");
  });

  it("múltipla escolha junta os rótulos com vírgula", () => {
    const c = campo("G", "temas_abordados");
    if (!("opcoes" in c)) throw new Error("sem opções");
    const [a, b] = c.opcoes;
    expect(textoDoValor(c, [a!.valor, b!.valor])).toBe(
      `${a!.rotulo}, ${b!.rotulo}`,
    );
  });
});

describe("respostasEmTexto", () => {
  it("só o que foi respondido, bloco por bloco, na ordem da definição", () => {
    const respostas: RespostasFormulario = {
      blocos: {
        H: { nome_do_obstetra: "Dr. Teste" },
        C: {
          nome_da_gestante: "Ana Teste",
          idade_da_gestante: 31,
          ocupacao_da_gestante: "  ",
        },
      },
      por_bebe: {},
    };
    const blocos = respostasEmTexto(definicao, respostas);
    expect(blocos.map((b) => b.bloco)).toEqual(["C", "H"]);
    expect(blocos[0]!.linhas).toEqual([
      {
        campo: "nome_da_gestante",
        rotulo: "Nome da gestante",
        texto: "Ana Teste",
      },
      {
        campo: "idade_da_gestante",
        rotulo: "Idade da gestante",
        texto: "31 anos",
      },
    ]);
  });

  it("entrevista em branco não gera nenhum bloco", () => {
    expect(respostasEmTexto(definicao, { blocos: {}, por_bebe: {} })).toEqual(
      [],
    );
  });
});
