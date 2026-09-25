import { describe, expect, it, vi } from "vitest";
import { EmissorNacionalAdaptador } from "./emissor-nacional";
import { DESCRICAO_SERVICO_NFSE } from "./descricao";

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => corpo } as Response;
}

const entradaBase = {
  cobrancaId: "cobranca-1",
  tomador: {
    nome: "Pagador Teste",
    cpfCnpj: "00000000000",
    endereco: {
      logradouro: "Rua Exemplo",
      numero: "100",
      bairro: "Centro",
      municipioCodigoIbge: "3550308",
      uf: "SP",
      cep: "01000-000",
    },
  },
  valorCentavos: 420000,
  codigoServico: "05266",
};

describe("EmissorNacionalAdaptador.emitir", () => {
  it("usa sempre a descrição fixa de cuidado domiciliar pós-parto, mesmo tentando sobrescrever", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        respostaJson({ status: "processando", provider_ref: "ref-1" }),
      );

    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
    });

    await adaptador.emitir({
      ...entradaBase,
      // @ts-expect-error tentativa deliberada de forçar outro texto
      descricao: "outra coisa qualquer",
    });

    const corpo = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(corpo.descricao).toBe(DESCRICAO_SERVICO_NFSE);
    expect(corpo.descricao).toBe("cuidado domiciliar pós-parto");
  });

  it("tomador é quem paga e o código de serviço vem do cadastro (nunca reescrito)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaJson({ status: "processando" }));

    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
    });

    await adaptador.emitir(entradaBase);

    const corpo = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(corpo.tomador.nome).toBe("Pagador Teste");
    expect(corpo.tomador.cpf_cnpj).toBe("00000000000");
    expect(corpo.codigo_servico).toBe("05266");
    expect(corpo.referencia_externa).toBe("cobranca-1");
  });

  it("mapeia os estados: emitida, processando, erro e cancelada", async () => {
    const adaptador = (status: string) =>
      new EmissorNacionalAdaptador({
        baseUrl: "https://nfse.exemplo.invalid",
        apiKey: "chave",
        fetchImpl: vi
          .fn()
          .mockResolvedValue(respostaJson({ status, provider_ref: "r" })),
      });

    expect((await adaptador("autorizada").emitir(entradaBase)).estado).toBe(
      "emitida",
    );
    expect((await adaptador("processando").emitir(entradaBase)).estado).toBe(
      "processando",
    );
    expect((await adaptador("rejeitada").emitir(entradaBase)).estado).toBe(
      "erro",
    );
  });

  it("tenta de novo em falha transitória (5xx) e devolve sucesso quando a segunda tentativa funciona", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respostaJson({}, false, 503))
      .mockResolvedValueOnce(
        respostaJson({ status: "emitida", provider_ref: "ref-ok" }),
      );
    const esperarImpl = vi.fn().mockResolvedValue(undefined);

    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
      esperarImpl,
      tentativasMaximas: 3,
    });

    const resultado = await adaptador.emitir(entradaBase);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(esperarImpl).toHaveBeenCalledTimes(1);
    expect(resultado.estado).toBe("emitida");
    expect(resultado.providerRef).toBe("ref-ok");
    expect(resultado.tentativas).toBe(2);
  });

  it("esgota as tentativas em falha transitória persistente e devolve erro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({}, false, 500));
    const esperarImpl = vi.fn().mockResolvedValue(undefined);

    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
      esperarImpl,
      tentativasMaximas: 3,
    });

    const resultado = await adaptador.emitir(entradaBase);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(esperarImpl).toHaveBeenCalledTimes(2);
    expect(resultado.estado).toBe("erro");
    expect(resultado.tentativas).toBe(3);
  });

  it("erro permanente (4xx, pedido inválido) não tenta de novo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({}, false, 422));
    const esperarImpl = vi.fn();

    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
      esperarImpl,
      tentativasMaximas: 3,
    });

    const resultado = await adaptador.emitir(entradaBase);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(esperarImpl).not.toHaveBeenCalled();
    expect(resultado.estado).toBe("erro");
    expect(resultado.tentativas).toBe(1);
  });
});

describe("EmissorNacionalAdaptador.consultar e cancelar", () => {
  it("consultar devolve o estado atual pela referência do provedor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        status: "emitida",
        provider_ref: "ref-1",
        numero: "123",
        pdf_url: "https://nfse.exemplo.invalid/ref-1.pdf",
        xml_url: "https://nfse.exemplo.invalid/ref-1.xml",
      }),
    );
    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
    });

    const resultado = await adaptador.consultar("ref-1");

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://nfse.exemplo.invalid/dps/ref-1/consulta",
    );
    expect(resultado.estado).toBe("emitida");
    expect(resultado.numero).toBe("123");
  });

  it("cancelar envia o motivo e devolve o estado cancelada", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaJson({ status: "cancelada" }));
    const adaptador = new EmissorNacionalAdaptador({
      baseUrl: "https://nfse.exemplo.invalid",
      apiKey: "chave",
      fetchImpl,
    });

    const resultado = await adaptador.cancelar("ref-1", "contrato cancelado");

    const corpo = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(corpo.motivo).toBe("contrato cancelado");
    expect(resultado.estado).toBe("cancelada");
  });
});
