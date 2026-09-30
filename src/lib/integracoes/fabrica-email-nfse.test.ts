// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { definirFalhaProvedorDemo } from "@/lib/dados/demonstracao/nota";
import {
  caixaDeSaidaEmailDemo,
  ErroIntegracaoNaoConfigurada,
  limparCaixaDeSaidaEmailDemo,
  obterEmail,
  obterEmissorNfse,
} from "./fabrica";
import { AssuntoComDadoPessoalError } from "./email/guarda";

const ENV = [
  "KZ_DADOS",
  "NEXT_PUBLIC_APP_ENV",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NFSE_PROVEDOR_BASE_URL",
  "NFSE_PROVEDOR_API_KEY",
] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const chave of ENV) original[chave] = process.env[chave];
  limparCaixaDeSaidaEmailDemo();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const chave of ENV) {
    if (original[chave] === undefined) delete process.env[chave];
    else process.env[chave] = original[chave];
  }
});

function demonstracao() {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
}

function real() {
  delete process.env.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
}

const PDF = new TextEncoder().encode("%PDF-1.7");

describe("e-mail transacional", () => {
  it("demonstração: guarda na caixa de saída local, sem rede, e aplica a mesma guarda de assunto e anexo", async () => {
    demonstracao();
    const rede = vi.fn();
    vi.stubGlobal("fetch", rede);
    const email = obterEmail();
    expect(email.ambienteDeTeste).toBe(true);
    const r = await email.enviar({
      para: ["medico@exemplo.invalid"],
      assunto: "Evolução de enfermagem · Kraamzorg Brasil",
      corpoHtml: "<p>Olá</p>",
      anexos: [
        {
          nomeArquivo: "d0000000-0000-4000-8000-000000000001.pdf",
          conteudo: PDF,
          tipoConteudo: "application/pdf",
        },
      ],
      nomesProibidosNoAssunto: ["Marina Teste"],
    });
    expect(r.id).toMatch(/^demo-/);
    expect(rede).not.toHaveBeenCalled();
    expect(caixaDeSaidaEmailDemo()).toEqual([
      expect.objectContaining({
        para: ["medico@exemplo.invalid"],
        assunto: "Evolução de enfermagem · Kraamzorg Brasil",
        anexos: [expect.objectContaining({ bytes: PDF.byteLength })],
      }),
    ]);

    await expect(
      email.enviar({
        para: ["m@exemplo.invalid"],
        assunto: "Evolução de Marina",
        corpoHtml: "<p>x</p>",
        nomesProibidosNoAssunto: ["Marina Teste"],
      }),
    ).rejects.toBeInstanceOf(AssuntoComDadoPessoalError);
    await expect(
      email.enviar({
        para: ["m@exemplo.invalid"],
        assunto: "Evolução",
        corpoHtml: "<p>x</p>",
        anexos: [
          {
            nomeArquivo: "evolucao-marina-teste.pdf",
            conteudo: PDF,
            tipoConteudo: "application/pdf",
          },
        ],
        nomesProibidosNoAssunto: ["Marina Teste"],
      }),
    ).rejects.toBeInstanceOf(AssuntoComDadoPessoalError);
    expect(caixaDeSaidaEmailDemo()).toHaveLength(1);
  });

  it("fora da demonstração sem credencial: não configurado, nada sai", () => {
    real();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    expect(() => obterEmail()).toThrow(ErroIntegracaoNaoConfigurada);
    process.env.RESEND_API_KEY = "chave-de-teste";
    expect(() => obterEmail()).toThrow(ErroIntegracaoNaoConfigurada);
  });

  it("com credencial: envia pelo Resend com o remetente do ambiente e o anexo em base64", async () => {
    real();
    process.env.RESEND_API_KEY = "chave-de-teste";
    process.env.RESEND_FROM_EMAIL = "avisos@exemplo.invalid";
    const corpos: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      corpos.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
    });
    const email = obterEmail();
    expect(email.ambienteDeTeste).toBe(false);
    const r = await email.enviar({
      para: ["m@exemplo.invalid"],
      assunto: "Evolução de enfermagem",
      corpoHtml: "<p>x</p>",
      anexos: [
        {
          nomeArquivo: "d0000000-0000-4000-8000-000000000001.pdf",
          conteudo: PDF,
          tipoConteudo: "application/pdf",
        },
      ],
      nomesProibidosNoAssunto: [],
    });
    expect(r).toEqual({ id: "re_1" });
    expect(corpos[0]).toMatchObject({
      from: "avisos@exemplo.invalid",
      to: ["m@exemplo.invalid"],
      subject: "Evolução de enfermagem",
      attachments: [
        expect.objectContaining({
          content: Buffer.from(PDF).toString("base64"),
        }),
      ],
    });
  });
});

describe("emissor de NFS-e", () => {
  const entrada = {
    cobrancaId: "c0000000-0000-4000-8000-000000000001",
    valorCentavos: 420000,
    codigoServico: "05266",
    descricaoServico: "Cuidado domiciliar pós-parto",
    tomador: { nome: "Carla Teste", cpfCnpj: "52998224725" },
  };

  it("demonstração: emite de mentira, com uma falha combinada que vale uma vez", async () => {
    demonstracao();
    const emissor = obterEmissorNfse();
    expect(emissor.ambienteDeTeste).toBe(true);
    const ok = await emissor.emitir(entrada);
    expect(ok).toMatchObject({
      estado: "emitida",
      numero: expect.stringMatching(/^D[0-9A-F]{8}$/),
    });
    definirFalhaProvedorDemo(true);
    const falha = await emissor.emitir(entrada);
    expect(falha.estado).toBe("erro");
    expect(falha.erro).toMatch(/O provedor recusou a nota/);
    expect((await emissor.emitir(entrada)).estado).toBe("emitida");
    expect(
      (await emissor.cancelar("ref", "cancelamento de teste")).estado,
    ).toBe("cancelada");
  });

  it("fora da demonstração sem provedor configurado: não configurado", () => {
    real();
    delete process.env.NFSE_PROVEDOR_BASE_URL;
    delete process.env.NFSE_PROVEDOR_API_KEY;
    expect(() => obterEmissorNfse()).toThrow(ErroIntegracaoNaoConfigurada);
    process.env.NFSE_PROVEDOR_BASE_URL = "https://nfse.provedor.exemplo";
    expect(() => obterEmissorNfse()).toThrow(ErroIntegracaoNaoConfigurada);
  });

  it("com provedor: chama a API com a chave e o id da cobrança como idempotência", async () => {
    real();
    process.env.NFSE_PROVEDOR_BASE_URL = "https://nfse.provedor.exemplo/";
    process.env.NFSE_PROVEDOR_API_KEY = "chave-de-teste";
    const chamadas: { url: string; cabecalhos: Record<string, string> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      chamadas.push({
        url,
        cabecalhos: init?.headers as Record<string, string>,
      });
      return new Response(
        JSON.stringify({
          status: "emitida",
          provider_ref: "ref-1",
          numero: "10",
        }),
        { status: 200 },
      );
    });
    const emissor = obterEmissorNfse();
    expect(emissor.ambienteDeTeste).toBe(false);
    const r = await emissor.emitir(entrada);
    expect(r).toMatchObject({
      estado: "emitida",
      numero: "10",
      providerRef: "ref-1",
    });
    expect(chamadas[0]?.url).toBe("https://nfse.provedor.exemplo/dps");
    expect(chamadas[0]?.cabecalhos).toMatchObject({
      Authorization: "Bearer chave-de-teste",
      "Idempotency-Key": entrada.cobrancaId,
    });
  });
});
