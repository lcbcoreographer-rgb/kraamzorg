import { montarLinkWhatsApp } from "./link-whatsapp";
import type { Mensageiro, PedidoEnvio, ResultadoEnvio, VerificadorFreio } from "./tipos";

/**
 * Canal `manual` (PRD 4.1 D-08, item 1 do P18): o padrão para falar com a
 * família. Não chama nenhuma API; monta o link `wa.me` com o texto
 * pré-preenchido e devolve para a tela abrir. Quem envia de verdade é a
 * pessoa, tocando "Enviar" dentro do próprio WhatsApp — por isso o freio é
 * checado aqui (antes do link existir), não depois.
 *
 * Grupo interno (destinatario "equipe") não usa o canal manual: aviso à
 * equipe é sempre automático, pela UAZAPI (P18 item 1).
 */
export function criarMensageiroManual(): Mensageiro {
  return {
    canal: "manual",

    async enviar(
      pedido: PedidoEnvio,
      verificar: VerificadorFreio,
    ): Promise<ResultadoEnvio> {
      if (pedido.destinatario !== "familia") {
        return {
          ok: false,
          motivo: "O canal manual só vale para mensagem à família.",
        };
      }

      const verificacao = await verificar({
        familiaId: pedido.familiaId,
        categoria: pedido.categoria,
      });
      if (!verificacao.pode) {
        return { ok: false, motivo: verificacao.motivo };
      }

      const link = montarLinkWhatsApp(pedido.telefoneOuJid, pedido.texto);
      if (!link) {
        return {
          ok: false,
          motivo:
            "Esse telefone não parece um número de WhatsApp válido. Confira o cadastro da família.",
        };
      }

      return { ok: true, canal: "manual", modo: "link", texto: pedido.texto, link };
    },
  };
}
