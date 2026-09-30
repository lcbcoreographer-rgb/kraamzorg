// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ErroRepositorio } from "@/lib/dados/erros";
import type { OperacaoRepositorio } from "@/lib/dados/repositorios";
import type { ResultadoSalvarCampo } from "@/lib/dados/tipos-operacao";
import {
  CAMPO_PROGRESSO,
  campoPrenatal,
  processarItensPrenatal,
} from "./prenatal";
import type { ItemSincronizacaoEntrada } from "./tipos";

/**
 * Sincronização da entrevista pré-natal (P35): cada item da fila vira uma
 * chamada de `salvarCampo`, na ordem de criação, e o resultado de um não
 * derruba o lote.
 */

const CONSULTA = "22222222-2222-4222-8222-222222222222";

function item(
  n: number,
  sobrescreve: Partial<ItemSincronizacaoEntrada> = {},
): ItemSincronizacaoEntrada {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    usuarioId: "u1",
    entidade: "consulta_prenatal",
    entidadeId: CONSULTA,
    campo: "C.nome_da_gestante",
    payload: "Ana Teste",
    versaoBase: 1,
    criadoNoClienteEm: `2026-09-29T10:00:0${n}.000Z`,
    ...sobrescreve,
  };
}

function operacaoCom(
  salvar: (
    pedido: Parameters<OperacaoRepositorio["salvarCampo"]>[0],
  ) => Promise<ResultadoSalvarCampo>,
) {
  return { salvarCampo: vi.fn(salvar) } as unknown as OperacaoRepositorio & {
    salvarCampo: ReturnType<typeof vi.fn>;
  };
}

const OK = (versao: number): ResultadoSalvarCampo => ({
  ok: true,
  versao,
  conflito: false,
  original: null,
  repetido: false,
});

describe("campoPrenatal", () => {
  it("monta o endereço bloco.campo", () => {
    expect(campoPrenatal("B", "percentil")).toBe("B.percentil");
  });
});

describe("processarItensPrenatal", () => {
  it("aplica em ordem de criação e manda o id do item para a idempotência", async () => {
    const operacao = operacaoCom(async () => OK(2));
    const resultados = await processarItensPrenatal(
      [
        item(3, { campo: "D.filhos_vivos", payload: "1" }),
        item(1),
        item(2, { campo: "C.idade_da_gestante", payload: 31 }),
      ],
      operacao,
    );
    expect(operacao.salvarCampo.mock.calls.map((c) => c[0].campo)).toEqual([
      "nome_da_gestante",
      "idade_da_gestante",
      "filhos_vivos",
    ]);
    expect(operacao.salvarCampo.mock.calls[0]![0]).toMatchObject({
      consultaId: CONSULTA,
      bloco: "C",
      valor: "Ana Teste",
      versaoBase: 1,
      itemId: "00000000-0000-4000-8000-000000000001",
    });
    expect(resultados.map((r) => r.status)).toEqual([
      "processado",
      "processado",
      "processado",
    ]);
  });

  it("a marca de onde a pessoa parou vira progresso, sem bloco nem campo", async () => {
    const operacao = operacaoCom(async () => OK(3));
    await processarItensPrenatal(
      [
        item(1, {
          campo: CAMPO_PROGRESSO,
          payload: { etapa: 4, campo: "D.filhos_vivos" },
        }),
      ],
      operacao,
    );
    expect(operacao.salvarCampo).toHaveBeenCalledWith(
      expect.objectContaining({
        bloco: null,
        campo: null,
        valor: null,
        progresso: { etapa: 4, campo: "D.filhos_vivos" },
      }),
    );
  });

  it("progresso com etapa inválida vira erro do item, sem chamar o servidor", async () => {
    const operacao = operacaoCom(async () => OK(1));
    const [r] = await processarItensPrenatal(
      [item(1, { campo: CAMPO_PROGRESSO, payload: { etapa: 0 } })],
      operacao,
    );
    expect(r).toMatchObject({ status: "erro", erro: "progresso inválido" });
    expect(operacao.salvarCampo).not.toHaveBeenCalled();
  });

  it("conflito devolve o original que estava no servidor e a versão atual", async () => {
    const operacao = operacaoCom(async () => ({
      ok: false,
      versao: 7,
      conflito: true,
      original: "Bia Teste",
      repetido: false,
    }));
    const [r] = await processarItensPrenatal([item(1)], operacao);
    expect(r).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      status: "conflito",
      conflito: {
        original: "Bia Teste",
        versaoAtual: 7,
        tentativa: "Ana Teste",
      },
    });
  });

  it("entidade de outra rota, item sem consulta ou sem endereço de campo viram erro", async () => {
    const operacao = operacaoCom(async () => OK(1));
    const resultados = await processarItensPrenatal(
      [
        item(1, { entidade: "visita" }),
        item(2, { entidadeId: null }),
        item(3, { campo: "sem_ponto" }),
      ],
      operacao,
    );
    expect(resultados.map((r) => r.status)).toEqual(["erro", "erro", "erro"]);
    expect(operacao.salvarCampo).not.toHaveBeenCalled();
  });

  it("recusa e falta de permissão do servidor não derrubam o lote e não vazam detalhe técnico", async () => {
    const operacao = operacaoCom(async (pedido) => {
      if (pedido.campo === "idade_da_gestante") {
        throw new ErroRepositorio("sem_permissao", "detalhe interno do banco");
      }
      if (pedido.campo === "filhos_vivos") {
        throw new ErroRepositorio("recusado", "operacao:campo_inexistente");
      }
      return OK(2);
    });
    const resultados = await processarItensPrenatal(
      [
        item(1),
        item(2, { campo: "C.idade_da_gestante", payload: 30 }),
        item(3, { campo: "D.filhos_vivos", payload: "1" }),
      ],
      operacao,
    );
    expect(resultados.map((r) => r.status)).toEqual([
      "processado",
      "erro",
      "erro",
    ]);
    expect(resultados[1]).toMatchObject({
      erro: "sem permissão para gravar esta entrevista",
    });
    expect(resultados[2]).toMatchObject({
      erro: "o servidor recusou este campo",
    });
    expect(JSON.stringify(resultados)).not.toContain("detalhe interno");
  });

  it("erro que não é do repositório sobe, para a rota responder 503 e o aparelho tentar de novo", async () => {
    const operacao = operacaoCom(async () => {
      throw new Error("rede caiu");
    });
    await expect(processarItensPrenatal([item(1)], operacao)).rejects.toThrow(
      "rede caiu",
    );
  });
});
