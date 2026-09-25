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
import {
  obterHorasPausaHumano,
  pausaMotivoDemonstracao,
  pausaMotivosReais,
} from "../repositorio";
import type {
  ClassificacaoNaoLead,
  ConversaComPausa,
  TransferenciaTela,
} from "../tipos";
import { CHAVE_MENSAGEM_NAO_LEAD, ROTULO_MOTIVO_HANDOFF } from "../tipos";

export interface ConversaDetalheTela {
  conversa: ConversaComPausa;
  mensagens: Mensagem[];
  transferenciaAberta: TransferenciaTela | null;
  ficha: FichaTela | null;
  /** `mensagem_modelo.formulario_contrato`, com o status para a tela avisar rascunho. */
  formularioContrato: { texto: string; aprovado: boolean } | null;
  comercialRespondeNoApp: boolean;
  /** `agente_pausa_humano_horas`; null quando o papel não lê `parametro`. */
  horasPausaHumano: number | null;
  /** Texto de encaminhamento de não lead (`mensagem_modelo.nao_lead_*`). */
  textoNaoLead: string | null;
}

async function obterConversaPorId(id: string) {
  if (modoDados() === "demonstracao") {
    const l = obterLoja();
    const conversa = l.conversas.find((c) => c.id === id);
    if (!conversa) return null;
    return {
      ...conversa,
      nomeFamilia:
        l.familias.find((f) => f.id === conversa.familiaId)?.nome ?? null,
      transferenciaAbertaId:
        l.transferencias.find(
          (t) =>
            t.conversaId === id &&
            (t.status === "aberto" || t.status === "assumido"),
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

  const [
    conversaBase,
    mensagens,
    transferencias,
    mensagemFormulario,
    parametroResposta,
    horasPausaHumano,
  ] = await Promise.all([
    obterConversaPorId(conversaId),
    agente.mensagensDaConversa(conversaId),
    agente.listarTransferencias({ status: ["aberto", "assumido"] }),
    configuracoes.obterMensagemModelo("formulario_contrato"),
    configuracoes.lerParametro("comercial_resposta_no_app"),
    obterHorasPausaHumano(),
  ]);

  if (!conversaBase) return null;

  const chaveNaoLead =
    conversaBase.classificacao in CHAVE_MENSAGEM_NAO_LEAD
      ? CHAVE_MENSAGEM_NAO_LEAD[
          conversaBase.classificacao as ClassificacaoNaoLead
        ]
      : null;
  const modeloNaoLead = chaveNaoLead
    ? await configuracoes.obterMensagemModelo(chaveNaoLead)
    : null;

  const transferenciaAberta =
    transferencias.find((t) => t.conversaId === conversaId) ?? null;

  const pausaMotivo =
    modoDados() === "demonstracao"
      ? pausaMotivoDemonstracao(conversaId)
      : ((await pausaMotivosReais([conversaId]))[conversaId] ?? null);

  const fichaFamilia = conversaBase.familiaId
    ? await obterFichaTela(conversaBase.familiaId)
    : null;

  const aberta = transferenciaAberta
    ? {
        ...transferenciaAberta,
        motivoRotulo: ROTULO_MOTIVO_HANDOFF[transferenciaAberta.motivo],
      }
    : null;

  return {
    conversa: paraConversaComPausa(
      { ...conversaBase, transferenciaAbertaId: aberta?.id ?? null },
      pausaMotivo,
      null,
      new Date(),
      aberta
        ? {
            motivo: aberta.motivo,
            motivoRotulo: aberta.motivoRotulo,
            prioridade: aberta.prioridade,
            status: aberta.status,
          }
        : null,
      fichaFamilia?.estadoSensivel ?? "normal",
    ),
    mensagens,
    transferenciaAberta: aberta,
    ficha: fichaFamilia,
    formularioContrato: mensagemFormulario
      ? {
          texto: mensagemFormulario.texto,
          aprovado: mensagemFormulario.status === "aprovado",
        }
      : null,
    // Hoje a RLS de `parametro` só deixa a diretoria ler; para o comercial
    // vem null e a tela fica no padrão seguro ("Abrir no WhatsApp"), o
    // mesmo do seed (pendência registrada no relatório da sessão).
    comercialRespondeNoApp: parametroResposta?.valor === true,
    horasPausaHumano,
    textoNaoLead: modeloNaoLead?.texto ?? null,
  };
}
