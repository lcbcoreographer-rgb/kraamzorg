import "server-only";
import { ErroRepositorio } from "../erros";
import type { AgenteRepositorio } from "../repositorios";
import type {
  FiltroConversas,
  FiltroTransferencias,
  ResumoConversa,
  Transferencia,
} from "../tipos";
import { exigir, type ContextoSupabase } from "./comum";

/** Classificações de conversa que são da Isadora (as demais são "não lead", PRD 7.1). */
const CLASSIFICACOES_LEAD = ["lead", "cliente", "nao_classificado"] as const;

export function criarAgenteSupabase({
  cliente,
  usuarioId,
}: ContextoSupabase): AgenteRepositorio {
  return {
    async listarConversas(filtro: FiltroConversas = {}) {
      const agora = new Date().toISOString();
      let consulta = cliente
        .from("conversa")
        .select(
          "id, familia_id, nome_whatsapp, nome_contato_salvo, telefone_e164, classificacao, agente_pausado_ate, agente_encerrado_em, agente_encerrado_motivo, ultima_entrada_em, ultima_saida_em, familia:familia_id ( nome_exibicao )",
        )
        .order("ultima_entrada_em", { ascending: false, nullsFirst: false })
        .limit(filtro.limite ?? 100);

      if (filtro.familiaId)
        consulta = consulta.eq("familia_id", filtro.familiaId);

      switch (filtro.situacao) {
        case "isadora":
          consulta = consulta
            .in("classificacao", [...CLASSIFICACOES_LEAD])
            .is("agente_encerrado_em", null)
            .or(`agente_pausado_ate.is.null,agente_pausado_ate.lt.${agora}`);
          break;
        case "equipe":
          consulta = consulta.not("agente_encerrado_em", "is", null);
          break;
        case "pausada":
          consulta = consulta.gt("agente_pausado_ate", agora);
          break;
        case "nao_lead":
          consulta = consulta.not(
            "classificacao",
            "in",
            `(${CLASSIFICACOES_LEAD.join(",")})`,
          );
          break;
      }

      const linhas = exigir(await consulta, "conversas");
      const ids = linhas.map((c) => c.id);
      const abertas = ids.length
        ? exigir(
            await cliente
              .from("handoff")
              .select("id, conversa_id")
              .in("conversa_id", ids)
              .in("status", ["aberto", "assumido"]),
            "transferências abertas",
          )
        : [];
      const porConversa = new Map(abertas.map((h) => [h.conversa_id, h.id]));

      return linhas.map((c): ResumoConversa => ({
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
        transferenciaAbertaId: porConversa.get(c.id) ?? null,
      }));
    },

    async mensagensDaConversa(conversaId) {
      const linhas = exigir(
        await cliente
          .from("mensagem")
          .select("id, direcao, enviado_por, tipo, conteudo, enviada_em")
          .eq("conversa_id", conversaId)
          .order("enviada_em"),
        "mensagens",
      );
      return linhas.map((m) => ({
        id: m.id,
        direcao: m.direcao,
        enviadoPor: m.enviado_por,
        tipo: m.tipo,
        conteudo: m.conteudo,
        enviadaEm: m.enviada_em,
      }));
    },

    async listarTransferencias(filtro: FiltroTransferencias = {}) {
      let consulta = cliente
        .from("handoff")
        .select(
          "id, conversa_id, familia_id, motivo, destino, prioridade, resumo, status, sla_vence_em, notificacao_ok, assumido_por, assumido_em, criado_em, familia:familia_id ( nome_exibicao )",
        )
        .order("prioridade", { ascending: false })
        .order("sla_vence_em", { ascending: true, nullsFirst: false });
      if (filtro.status?.length)
        consulta = consulta.in("status", filtro.status);
      if (filtro.destino) consulta = consulta.eq("destino", filtro.destino);

      return exigir(await consulta, "transferências").map(
        (h): Transferencia => ({
          id: h.id,
          conversaId: h.conversa_id,
          familiaId: h.familia_id,
          nomeFamilia: h.familia?.nome_exibicao ?? null,
          motivo: h.motivo,
          destino: h.destino,
          prioridade: h.prioridade,
          resumo: h.resumo,
          status: h.status,
          slaVenceEm: h.sla_vence_em,
          notificacaoOk: h.notificacao_ok,
          assumidoPor: h.assumido_por,
          assumidoEm: h.assumido_em,
          criadoEm: h.criado_em,
        }),
      );
    },

    async assumirTransferencia(transferenciaId) {
      if (!usuarioId)
        throw new ErroRepositorio("sem_permissao", "assumir sem sessão");
      const linhas = exigir(
        await cliente
          .from("handoff")
          .update({
            status: "assumido",
            assumido_por: usuarioId,
            assumido_em: new Date().toISOString(),
          })
          .eq("id", transferenciaId)
          .eq("status", "aberto")
          .select("id"),
        "assumir transferência",
      );
      if (linhas.length === 0) {
        throw new ErroRepositorio(
          "recusado",
          "a transferência já foi assumida ou resolvida",
        );
      }
    },
  };
}
