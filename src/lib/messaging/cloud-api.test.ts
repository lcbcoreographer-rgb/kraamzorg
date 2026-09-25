import { describe, expect, it, vi } from "vitest";
import { criarMensageiroCloudApi } from "./cloud-api";
import { ErroMensageiro } from "./erros";
import type { PedidoEnvio, VerificadorFreio } from "./tipos";

describe("criarMensageiroCloudApi", () => {
  it("lança ErroMensageiro('nao_implementado'): fica só preparado até o P18b", () => {
    const pedido: PedidoEnvio = {
      familiaId: "familia-1",
      categoria: "conteudo",
      destinatario: "familia",
      telefoneOuJid: "+5511999998888",
      texto: "Oi",
    };
    const verificar: VerificadorFreio = vi.fn(async () => ({
      pode: true,
      motivo: "",
    }));

    expect(() => criarMensageiroCloudApi().enviar(pedido, verificar)).toThrow(
      ErroMensageiro,
    );
    try {
      criarMensageiroCloudApi().enviar(pedido, verificar);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroMensageiro);
      expect((erro as ErroMensageiro).codigo).toBe("nao_implementado");
    }
  });

  it("declara o canal certo", () => {
    expect(criarMensageiroCloudApi().canal).toBe("cloud_api");
  });
});
