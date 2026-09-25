import { describe, expect, it, vi } from "vitest";
import { enviarEmail } from "./cliente";
import { AssuntoComDadoPessoalError } from "./guarda";

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => corpo } as Response;
}

// Assunto de teste; em produção o texto vem de `mensagem_modelo`.
const ASSUNTO_TESTE = "Evolução de enfermagem";

describe("enviarEmail", () => {
  it("envia quando o assunto não tem dado pessoal", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaJson({ id: "email-1" }));

    const resultado = await enviarEmail(
      { apiKey: "chave", fetchImpl },
      {
        de: "contato@kraamzorg.example",
        para: ["obstetra@exemplo.invalid"],
        assunto: ASSUNTO_TESTE,
        corpoHtml: "<p>Olá, Dr. Exemplo. Segue em anexo...</p>",
        nomesProibidosNoAssunto: ["Maria da Silva", "Bebê Maria"],
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, requisicao] = fetchImpl.mock.calls[0]!;
    expect(endpoint).toBe("https://api.resend.com/emails");
    const corpo = JSON.parse(requisicao.body as string);
    expect(corpo.subject).toBe(ASSUNTO_TESTE);
    expect(corpo.subject).not.toMatch(/Maria/i);
    expect(resultado.id).toBe("email-1");
  });

  it("recusa o envio se o assunto tiver nome de paciente e nunca chama a rede", async () => {
    const fetchImpl = vi.fn();

    await expect(
      enviarEmail(
        { apiKey: "chave", fetchImpl },
        {
          de: "contato@kraamzorg.example",
          para: ["obstetra@exemplo.invalid"],
          assunto: "Evolução de Maria da Silva",
          corpoHtml: "<p>Texto</p>",
          nomesProibidosNoAssunto: ["Maria da Silva"],
        },
      ),
    ).rejects.toThrow(AssuntoComDadoPessoalError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa só o primeiro nome no assunto e nunca chama a rede", async () => {
    const fetchImpl = vi.fn();

    await expect(
      enviarEmail(
        { apiKey: "chave", fetchImpl },
        {
          de: "contato@kraamzorg.example",
          para: ["obstetra@exemplo.invalid"],
          assunto: "Alta de Maria",
          corpoHtml: "<p>Texto</p>",
          nomesProibidosNoAssunto: ["Maria da Silva"],
        },
      ),
    ).rejects.toThrow(AssuntoComDadoPessoalError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa anexo com nome de paciente no nome do arquivo e nunca chama a rede", async () => {
    const fetchImpl = vi.fn();

    await expect(
      enviarEmail(
        { apiKey: "chave", fetchImpl },
        {
          de: "contato@kraamzorg.example",
          para: ["obstetra@exemplo.invalid"],
          assunto: ASSUNTO_TESTE,
          corpoHtml: "<p>Texto</p>",
          nomesProibidosNoAssunto: ["Maria da Silva"],
          anexos: [
            {
              nomeArquivo: "evolucao-maria-da-silva.pdf",
              conteudo: new Uint8Array([1]),
              tipoConteudo: "application/pdf",
            },
          ],
        },
      ),
    ).rejects.toThrow(AssuntoComDadoPessoalError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("codifica anexo em base64 com o tipo de conteúdo", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaJson({ id: "email-2" }));

    await enviarEmail(
      { apiKey: "chave", fetchImpl },
      {
        de: "contato@kraamzorg.example",
        para: ["pediatra@exemplo.invalid"],
        assunto: ASSUNTO_TESTE,
        corpoHtml: "<p>Texto</p>",
        nomesProibidosNoAssunto: ["Maria da Silva"],
        anexos: [
          {
            nomeArquivo: "evolucao.pdf",
            conteudo: new Uint8Array([37, 80, 68, 70]),
            tipoConteudo: "application/pdf",
          },
        ],
      },
    );

    const corpo = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(corpo.attachments).toHaveLength(1);
    expect(corpo.attachments[0].filename).toBe("evolucao.pdf");
    expect(corpo.attachments[0].content_type).toBe("application/pdf");
    expect(Buffer.from(corpo.attachments[0].content, "base64")).toEqual(
      Buffer.from([37, 80, 68, 70]),
    );
  });

  it("lança erro em resposta HTTP não ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({}, false, 422));

    await expect(
      enviarEmail(
        { apiKey: "chave", fetchImpl },
        {
          de: "contato@kraamzorg.example",
          para: ["a@exemplo.invalid"],
          assunto: "Assunto qualquer",
          corpoHtml: "<p>x</p>",
          nomesProibidosNoAssunto: [],
        },
      ),
    ).rejects.toThrow(/422/);
  });
});
