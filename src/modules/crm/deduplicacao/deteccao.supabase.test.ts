// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caminho Supabase da detecção (P17 item 1), sem banco: o cliente e o
 * `rpcPendente` são dublês. Prova que a tela recebe os pares que
 * `api.buscar_duplicatas_pipeline` (0017) devolve, e não mais a lista vazia
 * com `indisponivelNoBanco` de quando a função ainda não existia.
 */
const dubles = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dados/modo", () => ({ modoDados: () => "supabase" }));
vi.mock("@/lib/auth/sessao", () => ({
  exigirSessao: async () => ({ usuarioId: "u-1", papeis: ["comercial"] }),
}));
vi.mock("@/lib/db/cliente-servidor", () => ({
  criarClienteServidor: async () => ({}),
}));
vi.mock("@/lib/dados/supabase/comum", () => ({
  rpcPendente: (
    _cliente: unknown,
    funcao: string,
    args: Record<string, unknown>,
  ) => dubles.rpc(funcao, args),
}));

import { ErroRepositorio } from "@/lib/dados/erros";
import { listarDuplicatas } from "./deteccao";

const familia = (id: string, nome: string) => ({
  id,
  nome,
  bairro: null,
  cidade: "São Paulo",
  dpp: "2031-06-01",
});

beforeEach(() => {
  dubles.rpc.mockReset();
});

describe("listarDuplicatas (Supabase)", () => {
  it("devolve os pares de api.buscar_duplicatas_pipeline", async () => {
    const certa = {
      tipo: "certa",
      a: familia("f-1", "Família Teste Alfa"),
      b: familia("f-2", "Família Teste Beta"),
      telefone: "+5511900000001",
    };
    const provavel = {
      tipo: "provavel",
      a: familia("f-3", "Família Teste Gama"),
      b: familia("f-4", "Família Teste Gama Duplicada"),
      similaridade: 0.71,
      diasEntreDpp: 5,
    };
    const nova = {
      tipo: "certa",
      a: familia("f-6", "Família Teste Nova"),
      b: familia("f-5", "Família Teste Antiga"),
      telefone: "+5511900000005",
      diasEntreDatas: 400,
    };
    dubles.rpc.mockResolvedValue({
      certas: [certa],
      provaveis: [provavel],
      novasGestacoes: [nova],
      indisponivelNoBanco: false,
    });

    const resultado = await listarDuplicatas();

    expect(dubles.rpc).toHaveBeenCalledWith("buscar_duplicatas_pipeline", {});
    expect(resultado.indisponivelNoBanco).toBe(false);
    expect(resultado.certas).toEqual([certa]);
    expect(resultado.provaveis).toEqual([provavel]);
    expect(resultado.novasGestacoes).toEqual([nova]);
  });

  it("sem nenhum par, é 'nenhuma duplicata', não 'indisponível'", async () => {
    dubles.rpc.mockResolvedValue({
      certas: [],
      provaveis: [],
      novasGestacoes: [],
      indisponivelNoBanco: false,
    });
    const resultado = await listarDuplicatas();
    expect(resultado.indisponivelNoBanco).toBe(false);
    expect(resultado.certas).toEqual([]);
  });

  it("função ausente no banco vira indisponivelNoBanco", async () => {
    dubles.rpc.mockRejectedValue(
      new ErroRepositorio("funcao_pendente", "api.buscar_duplicatas_pipeline"),
    );
    const resultado = await listarDuplicatas();
    expect(resultado.indisponivelNoBanco).toBe(true);
    expect(resultado.certas).toEqual([]);
  });

  it("outro erro do banco sobe para a tela tratar", async () => {
    dubles.rpc.mockRejectedValue(
      new ErroRepositorio("sem_permissao", "api.buscar_duplicatas_pipeline"),
    );
    await expect(listarDuplicatas()).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });
});
