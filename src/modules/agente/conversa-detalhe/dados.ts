import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { traduzirErroBanco } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { obterLoja } from "@/lib/dados/demonstracao/loja";
import type { Mensagem } from "@/lib/dados/tipos";
import { obterFichaTela } from "@/modules/crm/ficha/dados";
import type { FichaTela } from "@/modules/crm/ficha/tipos";
import { paraConversaComPausa } from "../formatacao";
import { pausaMotivoDemonstracao, pausaMotivosReais } from "../repositorio";
import type { ConversaComPausa, TransferenciaTela } from "../tipos";
import { ROTULO_MOTIVO_HANDOFF } from "../tipos";

export interface ConversaDetalheTela {
  conversa: ConversaComPausa;
  mensagens: Mensagem[];
  transferenciaAberta: TransferenciaTela | null;
  ficha: FichaTela | null;
  textoFormularioContrato: string | null;
  comercialRespondeNoApp: boolean;
}

async function obterConversaPorId(id: string) {
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === id);
    if (!conversa) return null;
    return {
      ...conversa,
      nomeFamilia: l.familias.find((f) => f.id === conversa.familiaId)?.nome ?? null,
      transferenciaAbertaId:
        l.transferencias.find(
          (t) => t.conversaId === id && (t.status === "aberto" || t.status === "assumido"),
        )?.id ?? null,
    };
  }

  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("conversa")
    .select(
      "id, familia_id, nome_whatsapp, nome_contato_salvo, telefone_e164, classificacao, agente_pausado_ate, agente_encerrado_em, agente_encerrado_motivo, ultima_entrada_em, ultima_saida_em, familia:familia_id ( nome_exibicao )",
    )
    .eq("id", id)
    .maybeSingle();
  if (resposta.error) throw traduzirErroBanco(resposta.error, "conversa");
  if (!resposta.data) return null;
  const c = resposta.data;
  return {
    id: c.id,
    familiaId: c.familia_id,
    nomeFamilia: c.familia?.nome_exibicao ?? null,
    nomeContato: c.nome_contato_salvo ?? c.nome_whatsapp,
    telefoneE164: c.telefone_e164,
    classificacao: c.classificacao,
    agentePausadoAte: c.agente_pausado_ate,
    agenteEncerradoEm: c.agente_encerrado_em,
    agenteEncerradoMotivo: c.agente_encerrado_motivo,
    ultimaEntradaEm: c.ultima_entrada_em,
    ultimaSaidaEm: c.ultima_saida_em,
    transferenciaAbertaId: null as string | null,
  };
}

/**
 * Tela da conversa (P27 item 1, protótipo `comercial-conversa.html`, C2):
 * mensagens com quem enviou, painel de resumo da família (reaproveita
 * `FichaRepositorio.obterFicha`, dono P16) e a transferência aberta, se
 * houver.
 */
export async function obterConversaTela(
  conversaId: string,
): Promise<ConversaDetalheTela | null> {
  const { agente, configuracoes } = await obterRepositorios();

  const [conversaBase, mensagens, transferencias, mensagemFormulario, parametroResposta] =
    await Promise.all([
      obterConversaPorId(conversaId),
      agente.mensagensDaConversa(conversaId),
      agente.listarTransferencias({ status: ["aberto", "assumido"] }),
      configuracoes.obterMensagemModelo("formulario_contrato"),
      configuracoes.lerParametro("comercial_resposta_no_app"),
    ]);

  if (!conversaBase) return null;

  const transferenciaAberta = transferencias.find((t) => t.conversaId === conversaId) ?? null;

  const pausaMotivo =
    modoDados() === "demonstracao"
      ? pausaMotivoDemonstracao(conversaId)
      : ((await pausaMotivosReais([conversaId]))[conversaId] ?? null);

  const fichaFamilia = conversaBase.familiaId ? await obterFichaTela(conversaBase.familiaId) : null;

  return {
    conversa: paraConversaComPausa(conversaBase, pausaMotivo, null),
    mensagens,
    transferenciaAberta: transferenciaAberta
      ? { ...transferenciaAberta, motivoRotulo: ROTULO_MOTIVO_HANDOFF[transferenciaAberta.motivo] }
      : null,
    ficha: fichaFamilia,
    textoFormularioContrato: mensagemFormulario?.texto ?? null,
    comercialRespondeNoApp: parametroResposta?.valor === true,
  };
}
