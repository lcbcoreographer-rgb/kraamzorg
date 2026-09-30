// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emitirNotaAutomatica, type ClienteRpc } from "./servico-webhooks";
import type { AdaptadorNfse, EmissaoNfseEntrada } from "./nfse/tipos";

/**
 * P43: emissão automática depois do pagamento confirmado. O banco decide se
 * emite (parâmetro nfse_emissao.automatica) e marca "processando"; o servidor
 * pede ao provedor e devolve o resultado.
 */

const COBRANCA = "c0000000-0000-4000-8000-000000000001";
const NOTA = "b0000000-0000-4000-8000-000000000001";

function banco(respostas: Record<string, unknown>) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const cliente: ClienteRpc = {
    async rpc(funcao, args) {
      chamadas.push({ funcao, args });
      return { data: respostas[funcao] ?? null, error: null };
    },
  };
  return { cliente, chamadas };
}

const EMITIR = {
  emitir: true,
  nota_id: NOTA,
  cobranca_id: COBRANCA,
  familia_id: "f0000000-0000-4000-8000-000000000001",
  status: "processando",
  valor_centavos: 420000,
  codigo_servico: "05266",
  descricao_servico: "Cuidado domiciliar pós-parto",
  tomador: {
    nome: "Carla Teste Pagadora",
    cpf: "52998224725",
    email: null,
    endereco: {
      logradouro: "Rua de Teste",
      numero: "200",
      bairro: "Bairro de Teste",
      cep: "01310100",
      uf: "SP",
      municipio_codigo_ibge: "3550308",
    },
  },
};

function emissor(
  resultado: Awaited<ReturnType<AdaptadorNfse["emitir"]>>,
): AdaptadorNfse & { entradas: EmissaoNfseEntrada[] } {
  const entradas: EmissaoNfseEntrada[] = [];
  return {
    entradas,
    async emitir(entrada) {
      entradas.push(entrada);
      return resultado;
    },
    async consultar() {
      return resultado;
    },
    async cancelar() {
      return resultado;
    },
  };
}

const armazenamento = { async salvar() {} };

describe("emitirNotaAutomatica", () => {
  it("emissão manual: nada é pedido ao provedor", async () => {
    const { cliente, chamadas } = banco({
      nota_para_emissao_automatica: { emitir: false, motivo: "manual" },
    });
    const e = emissor({ estado: "emitida", numero: "1", tentativas: 1 });
    const r = await emitirNotaAutomatica(cliente, COBRANCA, e, armazenamento);
    expect(r).toEqual({ emitiu: false, motivo: "manual" });
    expect(e.entradas).toEqual([]);
    expect(chamadas.map((c) => c.funcao)).toEqual([
      "nota_para_emissao_automatica",
    ]);
  });

  it("automática: emite com o id da cobrança como chave de idempotência e registra a nota emitida", async () => {
    const { cliente, chamadas } = banco({
      nota_para_emissao_automatica: EMITIR,
    });
    const e = emissor({
      estado: "emitida",
      providerRef: "ref-7",
      numero: "2026/7",
      tentativas: 1,
    });
    const r = await emitirNotaAutomatica(cliente, COBRANCA, e, armazenamento);
    expect(r).toEqual({ emitiu: true, estado: "emitida", erro: null });
    expect(e.entradas[0]).toMatchObject({
      cobrancaId: COBRANCA,
      tomador: { nome: "Carla Teste Pagadora", cpfCnpj: "52998224725" },
    });
    expect(chamadas[1]).toEqual({
      funcao: "nota_registrar_resultado",
      args: {
        p_nota_id: NOTA,
        p_estado: "emitida",
        p_provider_ref: "ref-7",
        p_numero: "2026/7",
        p_pdf_path: null,
        p_xml_path: null,
        p_erro: null,
      },
    });
  });

  it("o provedor recusa: a nota volta ao banco com o motivo, para o financeiro reenviar", async () => {
    const { cliente, chamadas } = banco({
      nota_para_emissao_automatica: EMITIR,
    });
    const e = emissor({
      estado: "erro",
      erro: "NFS-e: resposta HTTP 422 (CPF inválido)",
      tentativas: 1,
    });
    const r = await emitirNotaAutomatica(cliente, COBRANCA, e, armazenamento);
    expect(r).toEqual({
      emitiu: true,
      estado: "erro",
      erro: "NFS-e: resposta HTTP 422 (CPF inválido)",
    });
    expect(chamadas[1]?.args).toMatchObject({
      p_estado: "erro",
      p_erro: "NFS-e: resposta HTTP 422 (CPF inválido)",
    });
  });

  it("dados do tomador incompletos: o banco já deixou a nota em erro e o provedor nem é chamado", async () => {
    const { cliente } = banco({
      nota_para_emissao_automatica: {
        emitir: false,
        motivo: "dados_incompletos",
      },
    });
    const e = emissor({ estado: "emitida", numero: "1", tentativas: 1 });
    const r = await emitirNotaAutomatica(cliente, COBRANCA, e, armazenamento);
    expect(r).toEqual({ emitiu: false, motivo: "dados_incompletos" });
    expect(e.entradas).toEqual([]);
  });

  it("erro do banco lança, para o chamador tratar como melhor esforço", async () => {
    const cliente: ClienteRpc = {
      async rpc() {
        return { data: null, error: { code: "XX000" } };
      },
    };
    await expect(
      emitirNotaAutomatica(
        cliente,
        COBRANCA,
        emissor({ estado: "emitida", numero: "1", tentativas: 1 }),
        armazenamento,
      ),
    ).rejects.toThrow(/falha em nota_para_emissao_automatica/);
  });
});
