import { describe, expect, it, vi } from "vitest";
import { buscarDocumento, criarDocumento } from "./cliente";

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => corpo,
  } as Response;
}

describe("criarDocumento", () => {
  it("envia multipart com operations, map e arquivo, e mapeia signatários e testemunha", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        data: {
          createDocument: {
            id: "doc-1",
            name: "Contrato 123",
            created_at: "2026-09-25T10:00:00Z",
            signatures: [
              {
                public_id: "sig-gestante",
                name: "Gestante Teste",
                email: "gestante@exemplo.invalid",
                action: { name: "SIGN" },
                signed: null,
              },
              {
                public_id: "sig-kraamzorg",
                name: "Kraamzorg Brasil",
                email: "contrato@kraamzorg.invalid",
                action: { name: "SIGN" },
                signed: null,
              },
              {
                public_id: "sig-testemunha",
                name: "Parceiro Teste",
                email: null,
                action: { name: "WITNESS" },
                signed: null,
              },
            ],
          },
        },
      }),
    );

    const documento = await criarDocumento(
      { token: "token-sandbox", sandbox: true, fetchImpl },
      {
        nomeDocumento: "Contrato 123",
        arquivo: {
          nomeArquivo: "contrato-123.pdf",
          conteudo: new Uint8Array([1, 2, 3]),
          tipoConteudo: "application/pdf",
        },
        gestante: {
          nome: "Gestante Teste",
          email: "gestante@exemplo.invalid",
          papel: "assinar",
        },
        kraamzorg: {
          nome: "Kraamzorg Brasil",
          email: "contrato@kraamzorg.invalid",
          papel: "assinar",
        },
        testemunha: { nome: "Parceiro Teste", papel: "testemunha" },
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, requisicao] = fetchImpl.mock.calls[0]!;
    expect(endpoint).toBe("https://api.autentique.com.br/v2/graphql");
    expect(requisicao.headers.Authorization).toBe("Bearer token-sandbox");
    expect(requisicao.body).toBeInstanceOf(FormData);

    const formData = requisicao.body as FormData;
    const operations = JSON.parse(formData.get("operations") as string);
    expect(operations.variables.document.name).toBe("Contrato 123");
    expect(operations.variables.sandbox).toBe(true);
    expect(operations.variables.signers).toHaveLength(3);
    expect(operations.variables.signers[2].action).toBe("WITNESS");
    expect(operations.variables.file).toBeNull();
    expect(JSON.parse(formData.get("map") as string)).toEqual({
      "0": ["variables.file"],
    });
    expect(formData.get("0")).toBeInstanceOf(Blob);

    expect(documento.id).toBe("doc-1");
    expect(documento.signatarios).toHaveLength(3);
    expect(documento.signatarios[2]!.papel).toBe("testemunha");
    expect(documento.concluido).toBe(false);
  });

  it("sandbox falso não muda o formato da chamada, só a variável sandbox", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        data: {
          createDocument: {
            id: "doc-2",
            name: "Contrato 124",
            created_at: "2026-09-25T10:00:00Z",
            signatures: [],
          },
        },
      }),
    );

    await criarDocumento(
      { token: "token-producao", sandbox: false, fetchImpl },
      {
        nomeDocumento: "Contrato 124",
        arquivo: {
          nomeArquivo: "contrato-124.pdf",
          conteudo: new Uint8Array([1]),
          tipoConteudo: "application/pdf",
        },
        gestante: { nome: "Gestante", papel: "assinar" },
        kraamzorg: { nome: "Kraamzorg", papel: "assinar" },
      },
    );

    const formData = fetchImpl.mock.calls[0]![1].body as FormData;
    const operations = JSON.parse(formData.get("operations") as string);
    expect(operations.variables.sandbox).toBe(false);
    expect(operations.variables.signers).toHaveLength(2);
  });

  it("lança erro quando a API GraphQL devolve `errors`", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        respostaJson({ errors: [{ message: "token inválido" }] }),
      );

    await expect(
      criarDocumento(
        { token: "invalido", sandbox: true, fetchImpl },
        {
          nomeDocumento: "Contrato 125",
          arquivo: {
            nomeArquivo: "c.pdf",
            conteudo: new Uint8Array([1]),
            tipoConteudo: "application/pdf",
          },
          gestante: { nome: "Gestante", papel: "assinar" },
          kraamzorg: { nome: "Kraamzorg", papel: "assinar" },
        },
      ),
    ).rejects.toThrow(/token inválido/);
  });

  it("lança erro em resposta HTTP não ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({}, false, 500));

    await expect(
      criarDocumento(
        { token: "t", sandbox: true, fetchImpl },
        {
          nomeDocumento: "Contrato 126",
          arquivo: {
            nomeArquivo: "c.pdf",
            conteudo: new Uint8Array([1]),
            tipoConteudo: "application/pdf",
          },
          gestante: { nome: "Gestante", papel: "assinar" },
          kraamzorg: { nome: "Kraamzorg", papel: "assinar" },
        },
      ),
    ).rejects.toThrow(/500/);
  });
});

describe("buscarDocumento", () => {
  it("usa query JSON simples (sem multipart) e mapeia conclusão quando todos os signatários assinaram", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        data: {
          document: {
            id: "doc-1",
            name: "Contrato 123",
            created_at: "2026-09-25T10:00:00Z",
            signatures: [
              {
                public_id: "sig-gestante",
                name: "Gestante Teste",
                email: "gestante@exemplo.invalid",
                action: { name: "SIGN" },
                signed: { created_at: "2026-09-26T12:00:00Z" },
              },
              {
                public_id: "sig-kraamzorg",
                name: "Kraamzorg Brasil",
                email: "contrato@kraamzorg.invalid",
                action: { name: "SIGN" },
                signed: { created_at: "2026-09-26T12:05:00Z" },
              },
              {
                public_id: "sig-testemunha",
                name: "Parceiro Teste",
                email: null,
                action: { name: "WITNESS" },
                signed: null,
              },
            ],
          },
        },
      }),
    );

    const documento = await buscarDocumento(
      { token: "token-sandbox", sandbox: true, fetchImpl },
      "doc-1",
    );

    const [, requisicao] = fetchImpl.mock.calls[0]!;
    expect(requisicao.headers["Content-Type"]).toBe("application/json");
    expect(requisicao.body).not.toBeInstanceOf(FormData);
    const corpo = JSON.parse(requisicao.body as string);
    expect(corpo.variables).toEqual({ id: "doc-1" });

    // Testemunha sem assinatura não bloqueia a conclusão (só quem assina).
    expect(documento.concluido).toBe(true);
  });
});
