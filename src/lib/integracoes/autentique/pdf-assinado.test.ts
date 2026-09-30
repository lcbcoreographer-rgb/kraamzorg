import { describe, expect, it, vi } from "vitest";
import {
  baixarPdfAssinado,
  buscarDocumento,
  criarDocumento,
  ErroApiAutentique,
} from "./cliente";

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => corpo } as Response;
}

function documento(signed: string | null, assinou = true) {
  const feito = assinou ? { created_at: "2026-09-29T15:00:00Z" } : null;
  return {
    data: {
      document: {
        id: "doc-1",
        name: "Contrato",
        created_at: "2026-09-28T15:00:00Z",
        files: { signed },
        signatures: [
          {
            public_id: "1",
            name: "A",
            email: "a@exemplo.invalid",
            action: { name: "SIGN" },
            signed: feito,
            rejected: null,
          },
        ],
      },
    },
  };
}

describe("reconsulta do documento", () => {
  it("pede o arquivo assinado e devolve o link só quando existe", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        respostaJson(documento("https://arquivos.exemplo.invalid/a.pdf")),
      )
      .mockResolvedValueOnce(respostaJson(documento(null, false)));
    const pronto = await buscarDocumento({ token: "t", fetchImpl }, "doc-1");
    expect(pronto.arquivoAssinadoUrl).toBe(
      "https://arquivos.exemplo.invalid/a.pdf",
    );
    expect(pronto.concluido).toBe(true);
    const corpo = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(corpo.query).toContain("files { signed }");

    const pendente = await buscarDocumento({ token: "t", fetchImpl }, "doc-1");
    expect(pendente.arquivoAssinadoUrl).toBeUndefined();
    expect(pendente.concluido).toBe(false);
  });
});

describe("PDF assinado", () => {
  const PDF = new TextEncoder().encode("%PDF-1.7 teste");

  it("baixa sem mandar o token da API e confere que é PDF", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => PDF.buffer,
    } as Response);
    const bytes = await baixarPdfAssinado(
      "https://arquivos.exemplo.invalid/a.pdf",
      fetchImpl,
    );
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("%PDF");
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(
      /authorization|bearer/i,
    );
  });

  it("recusa link que não é https, resposta de erro, arquivo vazio e arquivo que não é PDF", async () => {
    const fetchImpl = vi.fn();
    await expect(
      baixarPdfAssinado("http://arquivos.exemplo.invalid/a.pdf", fetchImpl),
    ).rejects.toThrow(/https/);
    expect(fetchImpl).not.toHaveBeenCalled();

    const erro = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(
      baixarPdfAssinado("https://arquivos.exemplo.invalid/a.pdf", erro),
    ).rejects.toThrow(/403/);

    const vazio = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);
    await expect(
      baixarPdfAssinado("https://arquivos.exemplo.invalid/a.pdf", vazio),
    ).rejects.toThrow(/vazio/);

    const html = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        new TextEncoder().encode("<html>login</html>").buffer,
    } as Response);
    await expect(
      baixarPdfAssinado("https://arquivos.exemplo.invalid/a.pdf", html),
    ).rejects.toThrow(/não é um PDF/);
  });
});

describe("erros da API: só é definitivo o que certamente não criou o documento", () => {
  const entrada = {
    nomeDocumento: "Contrato",
    arquivo: {
      nomeArquivo: "c.pdf",
      conteudo: new Uint8Array([1]),
      tipoConteudo: "application/pdf",
    },
    gestante: {
      nome: "A",
      email: "a@exemplo.invalid",
      papel: "assinar" as const,
    },
    kraamzorg: {
      nome: "B",
      email: "b@exemplo.invalid",
      papel: "assinar" as const,
    },
  };

  async function falha(fetchImpl: typeof fetch) {
    try {
      await criarDocumento({ token: "t", sandbox: true, fetchImpl }, entrada);
    } catch (erro) {
      return erro;
    }
    throw new Error("era para falhar");
  }

  it("4xx e erro de validação do GraphQL: definitivo", async () => {
    const e4 = await falha(
      vi.fn().mockResolvedValue(respostaJson({}, false, 422)),
    );
    expect(e4).toBeInstanceOf(ErroApiAutentique);
    expect((e4 as ErroApiAutentique).definitivo).toBe(true);
    const gql = await falha(
      vi
        .fn()
        .mockResolvedValue(
          respostaJson({ errors: [{ message: "e-mail inválido" }] }),
        ),
    );
    expect((gql as ErroApiAutentique).definitivo).toBe(true);
  });

  it("5xx, rede caída e resposta sem dado: incerto (o documento pode ter sido criado)", async () => {
    const e5 = await falha(
      vi.fn().mockResolvedValue(respostaJson({}, false, 503)),
    );
    expect((e5 as ErroApiAutentique).definitivo).toBe(false);
    const rede = await falha(
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    expect(rede).toBeInstanceOf(ErroApiAutentique);
    expect((rede as ErroApiAutentique).definitivo).toBe(false);
    const semDado = await falha(vi.fn().mockResolvedValue(respostaJson({})));
    expect((semDado as ErroApiAutentique).definitivo).toBe(false);
  });
});
