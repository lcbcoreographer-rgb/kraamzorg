import "server-only";
import {
  criarMensageiro,
  type CategoriaAutomacao,
  type ResultadoEnvio,
} from "@/lib/messaging";
import { criarVerificadorFreio } from "./verificador-freio";

export interface PedidoPrepararEnvio {
  familiaId: string | null;
  telefoneE164: string;
  texto: string;
  categoria: CategoriaAutomacao;
}

/**
 * Passa o pedido pelo canal manual (P18 item 2), que checa o freio antes
 * de montar o link (`ResultadoEnvio.ok === false` quando a família está em
 * bloqueio_total, por exemplo: nenhum link sai daqui nesse caso). Quem
 * chama já leu família, telefone e categoria da tarefa no servidor
 * (`obterTarefaAberta`); só o texto vem da pessoa.
 */
export async function prepararEnvioTarefa(
  pedido: PedidoPrepararEnvio,
): Promise<ResultadoEnvio> {
  const mensageiro = criarMensageiro("manual");
  return mensageiro.enviar(
    {
      familiaId: pedido.familiaId ?? undefined,
      categoria: pedido.categoria,
      destinatario: "familia",
      telefoneOuJid: pedido.telefoneE164,
      texto: pedido.texto,
    },
    criarVerificadorFreio(),
  );
}
