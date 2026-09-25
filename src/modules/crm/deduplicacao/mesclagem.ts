import "server-only";
import { exigirSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";
import { transicionarEstagio } from "../pipeline/dados";
import type { PedidoMesclagem } from "./tipos";

/**
 * Mesclagem (P17 item 2): move conversas, mensagens, tarefas e
 * oportunidades da família que sai para a que fica, marca a família que sai
 * como mesclada e grava auditoria. Os eventos não se movem (`evento_familia`
 * é append-only, PRD 6.10 regra 2): a linha do tempo junta os da família
 * mesclada por `mesclada_em_id`, o que é trabalho da ficha (P16), lendo o
 * vínculo que esta função grava.
 *
 * Sem desfazer: por isso a tela pede confirmação explícita (P17 item 2).
 * Se as duas famílias têm oportunidade aberta, a que não foi escolhida
 * passa para `perdido` (motivo `outro`, detalhe "mesclada em <id>") pela
 * mesma porta de sempre, `privado.transicionar`, antes de mover.
 *
 * O banco ainda não tem a função de mesclagem (0012 a 0014 são de outra
 * trilha): no Supabase, `rpcPendente` devolve `funcao_pendente` até ela
 * chegar. No modo demonstração, a loja em memória não tem a coluna
 * `mesclada_em_id` (é do tipo da fundação, fora desta pasta): o vínculo
 * fica num mapa próprio deste módulo, só para a tela de duplicatas não
 * sugerir de novo um par já resolvido nesta sessão do servidor.
 */
const mescladasDemo = new Map<string, string>(); // perdeId -> ficaId
const vinculosNovaGestacaoDemo = new Map<string, string>(); // maisRecenteId -> anteriorId

export function familiasJaMescladas(): Set<string> {
  return new Set(mescladasDemo.keys());
}

export function familiaFicaDemo(perdeId: string): string | undefined {
  return mescladasDemo.get(perdeId);
}

export function vinculoNovaGestacaoDemo(id: string): string | undefined {
  return vinculosNovaGestacaoDemo.get(id);
}

/** Só para testes: volta estes mapas auxiliares ao estado vazio, junto de
 * `reiniciarLoja` (src/lib/dados/demonstracao/loja.ts). */
export function reiniciarMesclagemDemoParaTestes(): void {
  mescladasDemo.clear();
  vinculosNovaGestacaoDemo.clear();
}

function oportunidadeAberta(o: {
  pipeline: 1 | 2;
  estagioP1: string | null;
  estagioP2: string | null;
}): boolean {
  if (o.pipeline === 1) return o.estagioP1 !== "perdido";
  return !["perdido", "cancelado", "distrato"].includes(o.estagioP2 ?? "");
}

export async function mesclarFamilias(pedido: PedidoMesclagem): Promise<void> {
  const sessao = await exigirSessao("/pipeline/duplicatas");
  if (
    !sessao.papeis.includes("comercial") &&
    !sessao.papeis.includes("coordenacao") &&
    !sessao.papeis.includes("diretoria")
  ) {
    throw new ErroRepositorio(
      "sem_permissao",
      "mesclagem exige comercial, coordenação ou diretoria",
    );
  }
  if (pedido.familiaFicaId === pedido.familiaPerdeId) {
    throw new ErroRepositorio(
      "recusado",
      "as duas famílias escolhidas são a mesma",
    );
  }

  if (modoDados() === "demonstracao") {
    return mesclarFamiliasDemonstracao(pedido);
  }
  return mesclarFamiliasSupabase(pedido);
}

async function mesclarFamiliasSupabase(pedido: PedidoMesclagem): Promise<void> {
  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "mesclar_familias", {
    familia_fica_id: pedido.familiaFicaId,
    familia_perde_id: pedido.familiaPerdeId,
    oportunidade_fica_id: pedido.oportunidadeFicaId ?? null,
  });
}

async function mesclarFamiliasDemonstracao(
  pedido: PedidoMesclagem,
): Promise<void> {
  const { obterLoja } = await import("@/lib/dados/demonstracao/loja");
  const loja = obterLoja();
  const fica = loja.familias.find((f) => f.id === pedido.familiaFicaId);
  const perde = loja.familias.find((f) => f.id === pedido.familiaPerdeId);
  if (!fica || !perde) {
    throw new ErroRepositorio(
      "nao_encontrado",
      "demonstração: família da mesclagem",
    );
  }

  const oportunidadeFica = loja.oportunidades.find(
    (o) => o.familiaId === pedido.familiaFicaId,
  );
  const oportunidadePerde = loja.oportunidades.find(
    (o) => o.familiaId === pedido.familiaPerdeId,
  );
  const duasAbertas =
    oportunidadeFica &&
    oportunidadePerde &&
    oportunidadeAberta(oportunidadeFica) &&
    oportunidadeAberta(oportunidadePerde);

  if (duasAbertas) {
    const ficaEscolhida = pedido.oportunidadeFicaId ?? oportunidadeFica.id;
    const perdedora =
      ficaEscolhida === oportunidadeFica.id
        ? oportunidadePerde
        : oportunidadeFica;
    perdedora.motivoPerda = "outro";
    await transicionarEstagio({
      oportunidadeId: perdedora.id,
      pipeline: perdedora.pipeline,
      para: "perdido",
      motivo: `Outro: mesclada em ${pedido.familiaFicaId}`,
    });
  }

  // Move pessoas, conversas e tarefas para a família que fica.
  for (const pessoa of loja.pessoas) {
    if (pessoa.familiaId === pedido.familiaPerdeId)
      pessoa.familiaId = pedido.familiaFicaId;
  }
  for (const conversa of loja.conversas) {
    if (conversa.familiaId === pedido.familiaPerdeId)
      conversa.familiaId = pedido.familiaFicaId;
  }
  for (const tarefa of loja.tarefas) {
    if (tarefa.familiaId === pedido.familiaPerdeId)
      tarefa.familiaId = pedido.familiaFicaId;
  }

  // Move a oportunidade que não foi perdida na etapa acima (ou a única que
  // existir) para a família que fica. Uma família só tem uma aberta (PRD
  // 6.10 regra 14), então depois da mesclagem a que ficou tem no máximo uma.
  for (const oportunidade of loja.oportunidades) {
    if (oportunidade.familiaId === pedido.familiaPerdeId) {
      oportunidade.familiaId = pedido.familiaFicaId;
    }
  }

  perde.naoContatar = true;
  mescladasDemo.set(pedido.familiaPerdeId, pedido.familiaFicaId);

  loja.eventos.push({
    id: loja.proximoEvento++,
    familiaId: pedido.familiaFicaId,
    tipo: "mesclagem",
    titulo: `Família mesclada: ${perde.nome}`,
    restrito: false,
    criadoEm: new Date().toISOString(),
    dados: { familia_perde_id: pedido.familiaPerdeId },
  });
}

/** Vínculo de nova gestação (P17 item 1, PRD 6.10 regra 12): mesmo telefone,
 * DPP muito distante. Liga por `familia_anterior_id`, nunca mescla.
 *
 * O banco já tem `privado.vincular_nova_gestacao` (migration 0010, com as
 * checagens de ciclo, família já mesclada, vínculo existente e ordem das
 * datas), mas `privado` nunca é exposto pelo PostgREST (PRD 5.2) e ainda não
 * existe o wrapper `api.*` (0012 a 0014, outra trilha). `familia.familia_anterior_id`
 * tem grant de UPDATE direto para comercial e diretoria (0007_permissoes.sql),
 * mas escrever nela direto pulando todas as checagens da função devolveria
 * "sim, salvei" sem a validação: deixaria passar um autovínculo, um ciclo
 * entre gestações ou uma família já mesclada como "anterior" que o banco
 * recusaria, e não gravaria o evento `nova_gestacao` que a ficha (P16) lê.
 * Por isso o caminho do Supabase usa `rpcPendente`, como
 * `mesclarFamiliasSupabase`: até o wrapper existir, esta ação devolve
 * `funcao_pendente`, igual à mesclagem. */
export async function vincularNovaGestacao(
  familiaRecenteId: string,
  familiaAnteriorId: string,
): Promise<void> {
  const sessao = await exigirSessao("/pipeline/duplicatas");
  if (
    !sessao.papeis.includes("comercial") &&
    !sessao.papeis.includes("diretoria")
  ) {
    throw new ErroRepositorio(
      "sem_permissao",
      "vínculo de nova gestação exige comercial ou diretoria (PRD 13; privado.vincular_nova_gestacao)",
    );
  }
  if (familiaRecenteId === familiaAnteriorId) {
    throw new ErroRepositorio(
      "recusado",
      "vínculo de nova gestação: informe duas famílias diferentes",
    );
  }

  if (modoDados() === "demonstracao") {
    vinculosNovaGestacaoDemo.set(familiaRecenteId, familiaAnteriorId);
    return;
  }

  const cliente = await criarClienteServidor();
  await rpcPendente(cliente, "vincular_nova_gestacao", {
    familia_id: familiaRecenteId,
    familia_anterior_id: familiaAnteriorId,
  });
}
