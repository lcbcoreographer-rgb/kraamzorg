import { describe, expect, it, vi } from "vitest";
import { criarMensageiroManual } from "./manual";
import type { PedidoEnvio, VerificadorFreio } from "./tipos";

const pedidoBase: PedidoEnvio = {
  familiaId: "familia-1",
  categoria: "conteudo",
  destinatario: "familia",
  telefoneOuJid: "+5511999998888",
  texto: "Oi, Carla! Como vocês estão?",
};

describe("criarMensageiroManual", () => {
  it("devolve o link do wa.me quando o freio deixa passar", async () => {
    const verificar: VerificadorFreio = vi.fn(async () => ({
      pode: true,
      motivo: "",
    }));
    const resultado = await criarMensageiroManual().enviar(pedidoBase, verificar);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("esperava sucesso");
    expect(resultado.canal).toBe("manual");
    expect(resultado.modo).toBe("link");
    expect(resultado.link).toContain("https://wa.me/5511999998888?text=");
    expect(verificar).toHaveBeenCalledWith({
      familiaId: "familia-1",
      categoria: "conteudo",
    });
  });

  it("não gera link quando o freio recusa (família em bloqueio_total)", async () => {
    const verificar: VerificadorFreio = vi.fn(async () => ({
      pode: false,
      motivo: "Essa família está com o freio acionado. Nada sai por aqui.",
    }));
    const resultado = await criarMensageiroManual().enviar(pedidoBase, verificar);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("esperava recusa");
    expect(resultado.motivo).toMatch(/freio acionado/);
  });

  it("recusa telefone que não vira link válido, mesmo com o freio liberado", async () => {
    const verificar: VerificadorFreio = vi.fn(async () => ({
      pode: true,
      motivo: "",
    }));
    const resultado = await criarMensageiroManual().enviar(
      { ...pedidoBase, telefoneOuJid: "123" },
      verificar,
    );
    expect(resultado.ok).toBe(false);
  });

  it("recusa envio para grupo interno (canal manual é só para a família)", async () => {
    const verificar: VerificadorFreio = vi.fn(async () => ({
      pode: true,
      motivo: "",
    }));
    const resultado = await criarMensageiroManual().enviar(
      { ...pedidoBase, destinatario: "equipe", categoria: "interna" },
      verificar,
    );
    expect(resultado.ok).toBe(false);
    expect(verificar).not.toHaveBeenCalled();
  });
});
