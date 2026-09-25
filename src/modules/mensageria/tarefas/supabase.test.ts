// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caminho Supabase do freio e do "Enviei", sem banco: o cliente de servidor
 * e o `rpcPendente` são trocados por dublês. Prova que (1) o app chama
 * `api.pode_enviar_mensagem` com família, categoria e canal, (2) o código
 * do banco vira frase de gente, (3) função ausente ou erro fecham o freio e
 * (4) o "Enviei" grava só pela função `api.registrar_envio_tarefa`, nunca
 * por insert direto em `mensagem` (que não tem grant, 0007).
 */
const dubles = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dados/modo", () => ({ modoDados: () => "supabase" }));
vi.mock("@/lib/db/cliente-servidor", () => ({
  criarClienteServidor: async () => ({ from: dubles.from }),
}));
vi.mock("@/lib/dados/supabase/comum", () => ({
  rpcPendente: (
    _cliente: unknown,
    funcao: string,
    args: Record<string, unknown>,
  ) => dubles.rpc(funcao, args),
}));
vi.mock("@/lib/dados/fabrica", () => ({
  obterRepositorios: async () => {
    throw new Error(
      "o caminho Supabase não deveria passar pelo repositório aqui",
    );
  },
}));

import { ErroRepositorio } from "@/lib/dados/erros";
import { registrarEnvioTarefa } from "./registrar-envio";
import { criarVerificadorFreio } from "./verificador-freio";

beforeEach(() => {
  dubles.rpc.mockReset();
  dubles.from.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("criarVerificadorFreio (Supabase)", () => {
  it("chama api.pode_enviar_mensagem com família, categoria e canal", async () => {
    dubles.rpc.mockResolvedValue({ pode: true, motivo: null });
    const resultado = await criarVerificadorFreio()({
      familiaId: "fam-1",
      categoria: "operacional",
      canal: "manual",
    });
    expect(resultado.pode).toBe(true);
    expect(dubles.rpc).toHaveBeenCalledWith("pode_enviar_mensagem", {
      familia_id: "fam-1",
      categoria: "operacional",
      canal: "manual",
    });
  });

  it("código do banco vira frase; o código só segue em `codigo`", async () => {
    dubles.rpc.mockResolvedValue({
      pode: false,
      motivo: "freio_bloqueio_total",
    });
    const resultado = await criarVerificadorFreio()({
      familiaId: "fam-1",
      categoria: "conteudo",
    });
    expect(resultado.pode).toBe(false);
    expect(resultado.codigo).toBe("freio_bloqueio_total");
    expect(resultado.motivo).toMatch(/bloqueio total/);
    expect(resultado.motivo).not.toContain("freio_bloqueio_total");
  });

  it("função ainda ausente no banco: fecha o freio, nunca deixa passar", async () => {
    dubles.rpc.mockRejectedValue(
      new ErroRepositorio("funcao_pendente", "api.pode_enviar_mensagem"),
    );
    const resultado = await criarVerificadorFreio()({
      familiaId: "fam-1",
      categoria: "conteudo",
    });
    expect(resultado.pode).toBe(false);
    expect(resultado.codigo).toBe("funcao_pendente");
  });

  it("erro de rede também fecha o freio", async () => {
    dubles.rpc.mockRejectedValue(new Error("rede"));
    const resultado = await criarVerificadorFreio()({
      familiaId: "fam-1",
      categoria: "conteudo",
    });
    expect(resultado.pode).toBe(false);
  });
});

describe("registrarEnvioTarefa (Supabase)", () => {
  it("grava só pela função api.registrar_envio_tarefa, sem tocar em tabela", async () => {
    dubles.rpc.mockResolvedValue(null);
    await registrarEnvioTarefa({
      tarefaId: "tar-1",
      familiaId: "fam-1",
      textoEnviado: "Oi!",
    });
    expect(dubles.rpc).toHaveBeenCalledWith("registrar_envio_tarefa", {
      tarefa_id: "tar-1",
      texto: "Oi!",
    });
    expect(dubles.from).not.toHaveBeenCalled();
  });

  it("função ausente: propaga funcao_pendente e nada é concluído", async () => {
    dubles.rpc.mockRejectedValue(
      new ErroRepositorio("funcao_pendente", "api.registrar_envio_tarefa"),
    );
    await expect(
      registrarEnvioTarefa({
        tarefaId: "tar-1",
        familiaId: "fam-1",
        textoEnviado: "Oi!",
      }),
    ).rejects.toMatchObject({ codigo: "funcao_pendente" });
    expect(dubles.from).not.toHaveBeenCalled();
  });
});
