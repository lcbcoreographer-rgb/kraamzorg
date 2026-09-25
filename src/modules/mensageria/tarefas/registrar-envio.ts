import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";

export interface PedidoRegistrarEnvio {
  tarefaId: string;
  familiaId: string | null;
  textoEnviado: string;
}

/**
 * "Enviei" (P18 item 2, PRD 23.2): grava `mensagem` com `enviado_por =
 * humano` e conclui a tarefa.
 *
 * Supabase: `mensagem` não tem INSERT para `authenticated` de propósito
 * (0007_permissoes.sql: "o texto passa por privado.mascarar_documentos
 * antes de gravar, então o registro do 'enviei' é função (P18)"). Por isso
 * a escrita é uma função só, `api.registrar_envio_tarefa(tarefa_id, texto)`,
 * que precisa: conferir que a tarefa é de quem chama e está aberta;
 * reconsultar `privado.pode_enviar_mensagem(familia, categoria, 'manual')`;
 * mascarar o texto com `privado.mascarar_documentos`; gravar a mensagem
 * (`direcao = 'saida'`, `enviado_por = 'humano'`) na conversa da família;
 * concluir a tarefa; e deixar a régua ou a cadência seguir (P20). Tudo numa
 * transação: nunca mensagem gravada com tarefa aberta, nem o contrário.
 * A função ainda não existe (0012 a 0014 são de outra trilha): até lá,
 * `rpcPendente` lança `funcao_pendente` e nada muda no banco.
 *
 * Demonstração: grava na loja em memória da fundação (sem editar aquele
 * arquivo) e conclui pelo repositório, que confere a permissão. Família sem
 * conversa registrada não tem onde gravar a mensagem; a tarefa é concluída
 * mesmo assim.
 */
export async function registrarEnvioTarefa(
  pedido: PedidoRegistrarEnvio,
): Promise<void> {
  if (modoDados() !== "demonstracao") {
    const cliente = await criarClienteServidor();
    await rpcPendente(cliente, "registrar_envio_tarefa", {
      tarefa_id: pedido.tarefaId,
      texto: pedido.textoEnviado,
    });
    return;
  }

  // Conclui primeiro: se a tarefa não for de quem pediu, o repositório
  // recusa antes de qualquer mensagem entrar na loja.
  const { tarefas } = await obterRepositorios();
  await tarefas.concluirTarefa(pedido.tarefaId);
  if (pedido.familiaId) {
    await registrarNaDemonstracao(pedido.familiaId, pedido.textoEnviado);
  }
}

async function registrarNaDemonstracao(
  familiaId: string,
  textoEnviado: string,
): Promise<void> {
  const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
  const loja = obterLoja();
  const conversa = loja.conversas.find((c) => c.familiaId === familiaId);
  if (!conversa) return; // Sem conversa: nada para gravar (ver acima).

  loja.mensagens.push({
    id: crypto.randomUUID(),
    conversaId: conversa.id,
    direcao: "saida",
    enviadoPor: "humano",
    tipo: "texto",
    conteudo: textoEnviado,
    enviadaEm: new Date().toISOString(),
  });
}
