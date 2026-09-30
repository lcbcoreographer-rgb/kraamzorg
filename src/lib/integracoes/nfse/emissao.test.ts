// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type {
  DadosEmissaoNota,
  ResultadoNotaRegistro,
} from "@/lib/dados/tipos-nota";
import {
  consultarNota,
  emitirNota,
  LIMITE_ARQUIVO_NOTA_BYTES,
  paraRegistro,
  urlDeArquivoAceita,
} from "./emissao";
import type { AdaptadorNfse, EmissaoNfseEntrada, ResultadoNfse } from "./tipos";

const NOTA = "b0000000-0000-4000-8000-000000000001";
const COBRANCA = "c0000000-0000-4000-8000-000000000001";

const DADOS: DadosEmissaoNota = {
  notaId: NOTA,
  cobrancaId: COBRANCA,
  familiaId: "f0000000-0000-4000-8000-000000000001",
  status: "processando",
  valorCentavos: 420000,
  codigoServico: "05266",
  descricaoServico: "Cuidado domiciliar pós-parto",
  tomador: {
    nome: "Carla Teste Pagadora",
    cpf: "52998224725",
    email: "carla@exemplo.invalid",
    endereco: {
      logradouro: "Rua de Teste",
      numero: "200",
      bairro: "Bairro de Teste",
      cep: "01310100",
      uf: "SP",
      municipioCodigoIbge: "3550308",
    },
  },
};

function emissor(resultado: ResultadoNfse | Error): AdaptadorNfse & {
  emitidas: EmissaoNfseEntrada[];
} {
  const emitidas: EmissaoNfseEntrada[] = [];
  return {
    emitidas,
    async emitir(entrada) {
      emitidas.push(entrada);
      if (resultado instanceof Error) throw resultado;
      return resultado;
    },
    async consultar() {
      if (resultado instanceof Error) throw resultado;
      return resultado;
    },
    async cancelar() {
      throw new Error("não usado");
    },
  };
}

function ambiente(resposta: (url: string) => Response | Promise<Response>) {
  const salvos: { caminho: string; contentType: string; bytes: number }[] = [];
  const registros: ResultadoNotaRegistro[] = [];
  return {
    salvos,
    registros,
    deps: (e: AdaptadorNfse) => ({
      emissor: e,
      armazenamento: {
        async salvar(
          caminho: string,
          conteudo: Uint8Array,
          contentType: string,
        ) {
          salvos.push({ caminho, contentType, bytes: conteudo.byteLength });
        },
      },
      registrar: async (r: ResultadoNotaRegistro) => {
        registros.push(r);
      },
      baixar: (async (url: string | URL) =>
        resposta(String(url))) as typeof fetch,
    }),
  };
}

const pdf = () =>
  new Response(new TextEncoder().encode("%PDF-1.7 nota"), { status: 200 });
const xml = () =>
  new Response(new TextEncoder().encode('<?xml version="1.0"?><NFSe/>'), {
    status: 200,
  });

describe("emitirNota", () => {
  it("manda o tomador que paga, o serviço do cadastro e o valor; guarda PDF e XML por id e registra a nota", async () => {
    const e = emissor({
      estado: "emitida",
      providerRef: "ref-1",
      numero: "154",
      pdfUrl: "https://arquivos.provedor.exemplo/nota.pdf",
      xmlUrl: "https://arquivos.provedor.exemplo/nota.xml",
      tentativas: 1,
    });
    const a = ambiente((url) => (url.endsWith(".pdf") ? pdf() : xml()));
    const r = await emitirNota(DADOS, a.deps(e));

    expect(e.emitidas).toEqual([
      expect.objectContaining({
        cobrancaId: COBRANCA,
        valorCentavos: 420000,
        codigoServico: "05266",
        descricaoServico: "Cuidado domiciliar pós-parto",
        tomador: expect.objectContaining({
          nome: "Carla Teste Pagadora",
          cpfCnpj: "52998224725",
          endereco: expect.objectContaining({ municipioCodigoIbge: "3550308" }),
        }),
      }),
    ]);
    expect(a.salvos.map((s) => s.caminho).sort()).toEqual([
      `notas/${NOTA}.pdf`,
      `notas/${NOTA}.xml`,
    ]);
    expect(a.registros).toEqual([
      {
        estado: "emitida",
        providerRef: "ref-1",
        numero: "154",
        pdfPath: `notas/${NOTA}.pdf`,
        xmlPath: `notas/${NOTA}.xml`,
      },
    ]);
    expect(r).toEqual({
      estado: "emitida",
      numero: "154",
      erro: null,
      tentativas: 1,
    });
  });

  it("erro do provedor volta como o motivo e a nota fica em erro, para reenviar", async () => {
    const e = emissor({
      estado: "erro",
      erro: "NFS-e: resposta HTTP 422 (CPF do tomador inválido)",
      tentativas: 1,
    });
    const a = ambiente(() => pdf());
    const r = await emitirNota(DADOS, a.deps(e));
    expect(r.estado).toBe("erro");
    expect(r.erro).toBe("NFS-e: resposta HTTP 422 (CPF do tomador inválido)");
    expect(a.registros).toEqual([
      expect.objectContaining({
        estado: "erro",
        erro: "NFS-e: resposta HTTP 422 (CPF do tomador inválido)",
      }),
    ]);
  });

  it("exceção do adaptador também vira erro registrado, nunca deixa a nota presa em processamento", async () => {
    const a = ambiente(() => pdf());
    const r = await emitirNota(
      DADOS,
      a.deps(emissor(new Error("boom interno"))),
    );
    expect(r.estado).toBe("erro");
    expect(r.erro).toMatch(/Não deu para falar com o provedor/);
    expect(r.erro).not.toMatch(/boom/);
    expect(a.registros).toHaveLength(1);
  });

  it("emitida sem número vira erro em vez de nota sem número", async () => {
    const a = ambiente(() => pdf());
    const r = await emitirNota(
      DADOS,
      a.deps(emissor({ estado: "emitida", tentativas: 1 })),
    );
    expect(r.estado).toBe("erro");
    expect(r.erro).toMatch(/sem informar o número/);
  });

  it("provedor ainda processando registra só a referência", async () => {
    const a = ambiente(() => pdf());
    const r = await emitirNota(
      DADOS,
      a.deps(
        emissor({ estado: "processando", providerRef: "ref-9", tentativas: 1 }),
      ),
    );
    expect(r.estado).toBe("processando");
    expect(a.registros).toEqual([
      { estado: "processando", providerRef: "ref-9" },
    ]);
  });

  it("a nota vale mesmo se o arquivo do provedor não baixa ou não é do tipo esperado", async () => {
    const e = emissor({
      estado: "emitida",
      numero: "7",
      pdfUrl: "https://arquivos.provedor.exemplo/a.pdf",
      xmlUrl: "https://arquivos.provedor.exemplo/a.xml",
      tentativas: 1,
    });
    const a = ambiente((url) =>
      url.endsWith(".pdf")
        ? new Response("erro", { status: 500 })
        : new Response("isto não é xml", { status: 200 }),
    );
    const r = await emitirNota(DADOS, a.deps(e));
    expect(r.estado).toBe("emitida");
    expect(a.salvos).toEqual([]);
    expect(a.registros[0]).toMatchObject({ pdfPath: null, xmlPath: null });
  });

  it("arquivo maior que o limite do bucket não é guardado", async () => {
    const grande = new Uint8Array(LIMITE_ARQUIVO_NOTA_BYTES + 1);
    grande.set(new TextEncoder().encode("%PDF-1.7"));
    const a = ambiente(() => new Response(grande, { status: 200 }));
    const registro = await paraRegistro(
      NOTA,
      {
        estado: "emitida",
        numero: "9",
        pdfUrl: "https://arquivos.provedor.exemplo/grande.pdf",
        tentativas: 1,
      },
      a.deps(emissor(new Error("não usado"))),
    );
    expect(registro.pdfPath).toBeNull();
    expect(a.salvos).toEqual([]);
  });
});

describe("consultarNota", () => {
  it("registra o que o provedor respondeu, mantendo a referência", async () => {
    const a = ambiente(() => pdf());
    const r = await consultarNota(
      NOTA,
      "ref-3",
      a.deps(emissor({ estado: "processando", tentativas: 1 })),
    );
    expect(r.estado).toBe("processando");
    expect(a.registros).toEqual([
      { estado: "processando", providerRef: "ref-3" },
    ]);
  });

  it("falha na consulta não muda a nota", async () => {
    const a = ambiente(() => pdf());
    const r = await consultarNota(
      NOTA,
      "ref-3",
      a.deps(emissor(new Error("rede"))),
    );
    expect(r.estado).toBe("processando");
  });
});

describe("urlDeArquivoAceita", () => {
  it("aceita só https em endereço público", () => {
    expect(urlDeArquivoAceita("https://arquivos.provedor.exemplo/n.pdf")).toBe(
      true,
    );
    for (const ruim of [
      "http://arquivos.provedor.exemplo/n.pdf",
      "https://localhost/n.pdf",
      "https://127.0.0.1/n.pdf",
      "https://10.0.0.5/n.pdf",
      "https://[::1]/n.pdf",
      "https://servico.internal/n.pdf",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "não é url",
    ]) {
      expect(urlDeArquivoAceita(ruim), ruim).toBe(false);
    }
  });
});
