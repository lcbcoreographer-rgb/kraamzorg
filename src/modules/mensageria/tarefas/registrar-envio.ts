import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";

export interface PedidoRegistrarEnvio {
  tarefaId: string;
  familiaId: string | null;
  textoEnviado: string;
}

/**
 * "Enviei" (P18 item 2, PRD 23.2): grava `mensagem` com `enviado_por =
 * humano` e conclui a tarefa. A régua (`regua_faixa`) e as cadências
 * avançam sozinhas a partir da próxima vez que a automação de nutrição
 * (P20, motor de automações, ainda não construído) rodar e vir esta
 * tarefa concluída; este módulo não é dono da máquina de estado da régua,
 * só do registro de que uma pessoa mandou a mensagem.
 *
 * Sem `familia_id` (tarefa interna, como "Justificar o freio") isto nunca
 * é chamado: essas tarefas usam só `concluirTarefa`, direto pela tela.
 *
 * Não existe ainda uma função `api.*` para isto (0012 a 0014 são de outra
 * trilha) nem uma coluna que ligue `tarefa` a `conversa`: a mensagem é
 * gravada na conversa já existente da família (resolvida por
 * `familia_id`, como o resto do app resolve conversa por família). Uma
 * família sem conversa registrada ainda (por exemplo, um lead cadastrado
 * na mão, sem nunca ter escrito) não tem onde gravar a mensagem; a tarefa
 * ainda assim é concluída, e fica pendência para quando existir
 * `api.registrar_envio_tarefa` (RPC dedicada) or uma automação garanta a
 * conversa antes de criar a tarefa.
 */
export async function registrarEnvioTarefa(pedido: PedidoRegistrarEnvio): Promise<void> {
  if (pedido.familiaId) {
    if (modoDados() === "demonstracao") {
      await registrarNaDemonstracao(pedido.familiaId, pedido.textoEnviado);
    } else {
      await registrarNoSupabase(pedido.familiaId, pedido.textoEnviado);
    }
  }

  const { tarefas } = await obterRepositorios();
  await tarefas.concluirTarefa(pedido.tarefaId);
}

async function registrarNaDemonstracao(
  familiaId: string,
  textoEnviado: string,
): Promise<void> {
  const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
  const loja = obterLoja();
  const conversa = loja.conversas.find((c) => c.familiaId === familiaId);
  if (!conversa) return; // Sem conversa: nada para gravar (ver docstring acima).

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

async function registrarNoSupabase(familiaId: string, textoEnviado: string): Promise<void> {
  const cliente = await criarClienteServidor();

  const conversa = await cliente
    .from("conversa")
    .select("id")
    .eq("familia_id", familiaId)
    .limit(1)
    .maybeSingle();
  if (conversa.error) {
    throw new ErroRepositorio(
      "indisponivel",
      `registrar envio: localizar conversa (${conversa.error.message})`,
    );
  }
  if (!conversa.data) return; // Sem conversa: nada para gravar (ver docstring acima).

  const insercao = await cliente.from("mensagem").insert({
    conversa_id: conversa.data.id,
    direcao: "saida",
    enviado_por: "humano",
    tipo: "texto",
    conteudo: textoEnviado,
  });
  if (insercao.error) {
    throw new ErroRepositorio(
      "indisponivel",
      `registrar envio: gravar mensagem (${insercao.error.message})`,
    );
  }
}
