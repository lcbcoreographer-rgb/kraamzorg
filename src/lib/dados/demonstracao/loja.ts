import type { Json } from "@/lib/db/types";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  CartaoOportunidade,
  EventoLinhaDoTempo,
  Mensagem,
  MensagemModelo,
  Parametro,
  ResumoConversa,
  Tarefa,
  Transferencia,
} from "../tipos";
import {
  CONVERSAS,
  EVENTOS,
  FAMILIAS,
  ID_COMERCIAL,
  MENSAGENS,
  MENSAGENS_MODELO,
  OPORTUNIDADES,
  PARAMETROS,
  PESSOAS,
  TAREFAS,
  TRANSFERENCIAS,
  USUARIOS,
  type FamiliaDemonstracao,
  type OportunidadeDemonstracao,
  type PessoaDemonstracao,
  type UsuarioDemonstracao,
} from "./fixtures";

/**
 * Banco em memória do modo demonstração. Nasce das fixtures na primeira
 * leitura e vive enquanto o processo do servidor viver (fica em globalThis
 * para sobreviver à recarga de módulo do `next dev`). Tudo que a tela grava
 * na demonstração muda só esta cópia.
 */
export interface LojaDemonstracao {
  criadaEm: number;
  usuarios: UsuarioDemonstracao[];
  familias: FamiliaDemonstracao[];
  oportunidades: OportunidadeDemonstracao[];
  pessoas: PessoaDemonstracao[];
  conversas: (Omit<ResumoConversa, "nomeFamilia" | "transferenciaAbertaId">)[];
  mensagens: (Mensagem & { conversaId: string })[];
  transferencias: Omit<Transferencia, "nomeFamilia">[];
  tarefas: Omit<Tarefa, "nomeFamilia" | "payload">[];
  eventos: (EventoLinhaDoTempo & { familiaId: string })[];
  parametros: Parametro[];
  mensagensModelo: MensagemModelo[];
  /** Quando as sessões de cada usuário foram revogadas pela diretoria. */
  sessoesRevogadasEm: Record<string, number>;
  /** Freio acionado por quem e quando, para o "Desfazer" (PRD 8.3). */
  freios: Record<string, { por: string; em: number; de: FamiliaDemonstracao["estadoSensivel"] }>;
  proximoEvento: number;
}

const CHAVE_GLOBAL = "__kraamzorgLojaDemonstracao";

function isoDaqui(agora: number, minutos: number): string {
  return new Date(agora + minutos * 60_000).toISOString();
}

export function criarLoja(agora = Date.now()): LojaDemonstracao {
  const clonar = <T>(valor: T): T => structuredClone(valor);
  return {
    criadaEm: agora,
    usuarios: clonar(USUARIOS),
    familias: clonar(FAMILIAS),
    oportunidades: clonar(OPORTUNIDADES),
    pessoas: clonar(PESSOAS),
    conversas: CONVERSAS.map((c) => {
      const mensagensDaConversa = MENSAGENS.filter((m) => m.conversaId === c.id);
      const ultima = (direcao: "entrada" | "saida") => {
        const menor = Math.min(
          ...mensagensDaConversa.filter((m) => m.direcao === direcao).map((m) => m.haMinutos),
        );
        return Number.isFinite(menor) ? isoDaqui(agora, -menor) : null;
      };
      return {
        id: c.id,
        familiaId: c.familiaId,
        nomeContato: c.nomeWhatsapp,
        telefoneE164: c.telefoneE164,
        classificacao: c.classificacao,
        agentePausadoAte: c.pausaMinutos === null ? null : isoDaqui(agora, c.pausaMinutos),
        agenteEncerradoEm: c.encerradoMotivo ? isoDaqui(agora, -5 * 24 * 60) : null,
        agenteEncerradoMotivo: c.encerradoMotivo,
        ultimaEntradaEm: ultima("entrada"),
        ultimaSaidaEm: ultima("saida"),
      };
    }),
    mensagens: MENSAGENS.map((m, i) => ({
      id: `msg-${i + 1}`,
      conversaId: m.conversaId,
      direcao: m.direcao,
      enviadoPor: m.enviadoPor,
      tipo: "texto",
      conteudo: m.conteudo,
      enviadaEm: isoDaqui(agora, -m.haMinutos),
    })),
    transferencias: TRANSFERENCIAS.map((t) => ({
      id: t.id,
      conversaId: t.conversaId,
      familiaId: t.familiaId,
      motivo: t.motivo,
      destino: t.destino,
      prioridade: t.prioridade,
      resumo: t.resumo,
      status: t.status,
      slaVenceEm: isoDaqui(agora, t.slaMinutos),
      notificacaoOk: true,
      assumidoPor: t.assumidoPorComercial ? ID_COMERCIAL : null,
      assumidoEm: t.assumidoPorComercial ? isoDaqui(agora, -120) : null,
      criadoEm: isoDaqui(agora, -180),
    })),
    tarefas: TAREFAS.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      titulo: t.titulo,
      prioridade: t.prioridade,
      status: t.status,
      venceEm: t.venceMinutos === null ? null : isoDaqui(agora, t.venceMinutos),
      familiaId: t.familiaId,
      responsavelId: t.responsavelId,
      papelResponsavel: t.papelResponsavel,
      criadoEm: isoDaqui(agora, -60),
    })),
    eventos: EVENTOS.map((e, i) => ({
      id: i + 1,
      familiaId: e.familiaId,
      tipo: e.tipo,
      titulo: e.titulo,
      restrito: e.restrito,
      criadoEm: isoDaqui(agora, -e.haMinutos),
      dados: {} as Json,
    })),
    parametros: PARAMETROS.map((p) => ({
      chave: p.chave,
      valor: p.valor,
      descricao: p.descricao,
      atualizadoEm: isoDaqui(agora, -7 * 24 * 60),
    })),
    mensagensModelo: MENSAGENS_MODELO.map((m) => ({
      ...m,
      aprovadoEm: m.status === "aprovado" ? isoDaqui(agora, -7 * 24 * 60) : null,
    })),
    sessoesRevogadasEm: {},
    freios: {},
    proximoEvento: EVENTOS.length + 1,
  };
}

/** A loja do processo. Lança erro fora de desenvolvimento (modo.ts). */
export function obterLoja(): LojaDemonstracao {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<string, LojaDemonstracao | undefined>;
  global[CHAVE_GLOBAL] ??= criarLoja();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta a loja ao estado das fixtures. */
export function reiniciarLoja(agora?: number): LojaDemonstracao {
  const global = globalThis as unknown as Record<string, LojaDemonstracao | undefined>;
  global[CHAVE_GLOBAL] = criarLoja(agora);
  return global[CHAVE_GLOBAL];
}

export function cartaoDemonstracao(
  loja: LojaDemonstracao,
  oportunidade: OportunidadeDemonstracao,
): CartaoOportunidade {
  const familia = loja.familias.find((f) => f.id === oportunidade.familiaId);
  if (!familia) throw new Error(`família ausente na demonstração: ${oportunidade.familiaId}`);
  return {
    oportunidadeId: oportunidade.id,
    familiaId: familia.id,
    nomeFamilia: familia.nome,
    pipeline: oportunidade.pipeline,
    estagioP1: oportunidade.estagioP1,
    estagioP2: oportunidade.estagioP2,
    classificacao: oportunidade.classificacao,
    score: oportunidade.score,
    responsavelId: oportunidade.responsavelId,
    dpp: familia.dpp,
    dataNascimento: familia.dataNascimento,
    cidade: familia.cidade.nome,
    uf: familia.cidade.uf,
    bairro: familia.bairro,
    estadoSensivel: familia.estadoSensivel,
    proximoContatoEm: oportunidade.proximoContatoEm,
    pdfEnviadoEm: oportunidade.pdfEnviadoEm,
    motivoPerda: oportunidade.motivoPerda,
    atualizadoEm: new Date(loja.criadaEm).toISOString(),
    transferenciaAberta: loja.transferencias.some(
      (t) => t.familiaId === familia.id && (t.status === "aberto" || t.status === "assumido"),
    ),
  };
}
