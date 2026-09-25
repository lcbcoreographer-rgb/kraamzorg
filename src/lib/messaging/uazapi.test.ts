import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarMensageiroUazapi, type ConfigUazapi } from "./uazapi";
import type { PedidoEnvio, VerificadorFreio } from "./tipos";

const pedidoFamilia: PedidoEnvio = {
  familiaId: "familia-1",
  categoria: "conteudo",
  destinatario: "familia",
  telefoneOuJid: "5511999998888",
  texto: "Oi!",
};

const pedidoGrupo: PedidoEnvio = {
  categoria: "interna",
  destinatario: "equipe",
  telefoneOuJid: "12036@g.us",
  texto: "🚨 SAÚDE",
};

function config(fetchImpl: typeof fetch): ConfigUazapi {
  return { baseUrl: "https://uazapi.exemplo.com", token: "token-teste", fetchImpl };
}

describe("criarMensageiroUazapi", () => {
  let verificar: VerificadorFreio;

  beforeEach(() => {
    verificar = vi.fn(async () => ({ pode: true, motivo: "" }));
  });

  it("sem configuração, devolve falha sem tentar a rede", async () => {
    const buscar = vi.fn();
    const resultado = await criarMensageiroUazapi(null).enviar(pedidoFamilia, verificar);
    expect(resultado.ok).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("checa o freio antes de enviar para a família", async () => {
    verificar = vi.fn(async () => ({
      pode: false,
      motivo: "Essa família ainda não escreveu para a Kraamzorg.",
    }));
    const buscar = vi.fn();
    const resultado = await criarMensageiroUazapi(config(buscar)).enviar(
      pedidoFamilia,
      verificar,
    );
    expect(resultado.ok).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("envia para a família com a URL, o cabeçalho e o track_source certos", async () => {
    const buscar = vi.fn(async () =>
      new Response(JSON.stringify({ id: "abc123" }), { status: 200 }),
    );
    const resultado = await criarMensageiroUazapi(config(buscar)).enviar(
      pedidoFamilia,
      verificar,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("esperava sucesso");
    expect(resultado.modo).toBe("enviado");
    expect(resultado.idExterno).toBe("abc123");
    expect(verificar).toHaveBeenCalledOnce();

    expect(buscar).toHaveBeenCalledOnce();
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://uazapi.exemplo.com/send/text");
    expect((init.headers as Record<string, string>).token).toBe("token-teste");
    const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(corpo.track_source).toBe("kraamzorg-app");
    expect(corpo.number).toBe("5511999998888");
  });

  it("grupo interno nunca checa o freio, mesmo em bloqueio_total", async () => {
    verificar = vi.fn(async () => ({ pode: false, motivo: "não importa aqui" }));
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    const resultado = await criarMensageiroUazapi(config(buscar)).enviar(
      pedidoGrupo,
      verificar,
    );
    expect(resultado.ok).toBe(true);
    expect(verificar).not.toHaveBeenCalled();
    expect(buscar).toHaveBeenCalledOnce();
  });

  it("HTTP de erro vira resultado sem sucesso, com o status na mensagem", async () => {
    const buscar = vi.fn(async () => new Response("erro", { status: 500 }));
    const resultado = await criarMensageiroUazapi(config(buscar)).enviar(
      pedidoFamilia,
      verificar,
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("esperava falha");
    expect(resultado.motivo).toMatch(/500/);
  });

  it("falha de rede vira resultado sem sucesso, sem lançar", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("rede fora do ar");
    });
    const resultado = await criarMensageiroUazapi(config(buscar)).enviar(
      pedidoFamilia,
      verificar,
    );
    expect(resultado.ok).toBe(false);
  });
});
