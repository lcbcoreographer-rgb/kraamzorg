import "server-only";
import { criarMensageiro, type ResultadoEnvio } from "@/lib/messaging";
import { registrarEnvioTarefa } from "./registrar-envio";
import { criarVerificadorFreio } from "./verificador-freio";

export interface PedidoEnviarTarefa {
  tarefaId: string;
  familiaId: string | null;
  telefoneE164: string;
  texto: string;
}

/**
 * Junta os três passos do botão "Enviei" (P18 item 2): monta o link do
 * canal manual, checando o freio antes (`ResultadoEnvio.ok === false`
 * quando a família está em bloqueio_total, por exemplo — nenhum link sai
 * daqui nesse caso), e, só quando o link saiu, registra o envio
 * (`registrar-envio.ts`) e conclui a tarefa. A tela abre o link retornado
 * num novo separador; "Enviei" aqui já significa "confirmo que abri e
 * mandei pelo WhatsApp".
 */
export async function prepararEnvioTarefa(
  pedido: Pick<PedidoEnviarTarefa, "familiaId" | "telefoneE164" | "texto">,
): Promise<ResultadoEnvio> {
  const mensageiro = criarMensageiro("manual");
  return mensageiro.enviar(
    {
      familiaId: pedido.familiaId ?? undefined,
      categoria: "conteudo",
      destinatario: "familia",
      telefoneOuJid: pedido.telefoneE164,
      texto: pedido.texto,
    },
    criarVerificadorFreio(),
  );
}

export async function confirmarEnvioTarefa(pedido: PedidoEnviarTarefa): Promise<void> {
  await registrarEnvioTarefa({
    tarefaId: pedido.tarefaId,
    familiaId: pedido.familiaId,
    textoEnviado: pedido.texto,
  });
}
