/**
 * P28 · Ações do roteiro entre duas mensagens da família, iguais nos dois
 * executores: pausar a Isadora, envelhecer a conversa, "resolver" a
 * transferência no CRM e "Devolver à Isadora" e, [v4.3], o que a Edilaine e a
 * equipe fazem na agenda (ocupar um horário, mover ou apagar o evento,
 * registrar como foi a reunião, responder uma pergunta da Isadora). Só o
 * agendador (follow-up e Entrada B) muda de um executor para o outro (o local
 * roda o gatilho; o real espera o n8n), então fica de fora.
 */
import { instanteLocal, somarMinutos } from "./agenda";
import type { CalendarioDeTeste } from "./agenda";
import {
  gravarParametro,
  lerEstado,
  lerParametro,
  sqlChegarAVespera,
  sqlDevolverAIsadora,
  sqlEncerrarPendencias,
  sqlEnvelhecerConversa,
  sqlEventoDaConversa,
  sqlPassarTempo,
  sqlPausarIA,
  sqlRegistrarDesfecho,
  sqlResolverTransferencia,
  sqlResponderConsulta,
  sqlReuniaoJaAconteceu,
} from "./sql";
import type { Consulta } from "./sql";
import type { Acao } from "./tipos";

export type AcaoDeBanco = Exclude<
  Acao,
  { acao: "executarFollowup" } | { acao: "executarAgendador" }
>;

/** Contexto que as ações de agenda precisam além do banco. */
export interface ContextoDeAcao {
  calendario?: CalendarioDeTeste;
  /** Ids dos eventos que o teste pôs no calendário como se fossem de outra pessoa. */
  eventosAlheios?: string[];
}

/** Roda a ação e devolve a frase que aparece na transcrição do relatório. */
export async function executarAcaoDeBanco(
  consulta: Consulta,
  acao: AcaoDeBanco,
  telefoneE164: string,
  contexto: ContextoDeAcao = {},
): Promise<string> {
  const estado = await lerEstado(consulta, telefoneE164);
  // Ações só do calendário e da agenda da Edilaine valem antes da primeira mensagem.
  const semConversa = [
    "ocuparDia",
    "liberarAgenda",
    "calendarioForaDoAr",
    "falharCriacaoDoEvento",
    "edilaineAbreFaixa",
  ].includes(acao.acao);
  const conversaId = estado.conversa?.id ?? "";
  if (!conversaId && !semConversa)
    throw new Error(`A ação ${acao.acao} precisa de uma conversa já aberta`);
  const calendario = () => {
    if (!contexto.calendario)
      throw new Error(`A ação ${acao.acao} precisa do calendário de teste`);
    return contexto.calendario;
  };
  switch (acao.acao) {
    case "pausarIA":
      await consulta.linhas(sqlPausarIA(conversaId));
      return "[roteiro pausa a Isadora nesta conversa]";
    case "envelhecerConversa":
      await consulta.linhas(sqlEnvelhecerConversa(conversaId, acao.horas));
      return `[roteiro envelhece a conversa em ${acao.horas} h]`;
    case "resolverNoCRM": {
      const aberta = [...estado.transferencias]
        .reverse()
        .find((h) => h.status === "aberto" || h.status === "assumido");
      if (!aberta)
        throw new Error("resolverNoCRM: não há transferência aberta");
      await consulta.linhas(sqlResolverTransferencia(aberta.id));
      return '[a equipe marca a transferência como "resolvida" no CRM]';
    }
    case "devolverAIsadora":
      await consulta.linhas(sqlDevolverAIsadora(conversaId));
      return '[a equipe toca em "Devolver à Isadora"]';

    // --- [v4.3] Agenda -----------------------------------------------------------------
    case "passarTempo":
      for (const comando of sqlPassarTempo(conversaId, acao.horas))
        await consulta.linhas(comando);
      return `[o relógio da conversa anda ${acao.horas} h: as opções de horário oferecidas vencem e o silêncio da família cresce]`;
    case "ocuparOpcao": {
      // A agenda oferece em ordem de horário: a opção 1 é a mais cedo das que estão de pé.
      const opcao = estado.opcoes
        .filter((o) => o.escolhida_em === null && o.descartada_em === null)
        .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[
        acao.opcao - 1
      ];
      if (!opcao)
        throw new Error(`ocuparOpcao: não há a opção ${acao.opcao} oferecida`);
      await calendario().ocupar(opcao.inicio, opcao.fim);
      return `[a Edilaine ocupa no calendário o horário da opção ${acao.opcao}]`;
    }
    case "ocuparDia": {
      const inicio = instanteLocal(acao.diasDaquiA, acao.hora);
      await calendario().ocupar(inicio, somarMinutos(inicio, 30));
      return `[a Edilaine ocupa no calendário ${acao.diasDaquiA === 1 ? "amanhã" : `daqui a ${acao.diasDaquiA} dias`} às ${acao.hora}]`;
    }
    case "liberarAgenda":
      await calendario().liberarTudo();
      return "[a Edilaine libera os horários que tinha ocupado]";
    case "eventoDeOutraPessoa": {
      const sessao = estado.sessoes.find((s) => s.status === "agendada");
      if (!sessao?.agendada_para)
        throw new Error("eventoDeOutraPessoa: não há reunião marcada");
      const inicio = new Date(
        Date.parse(sessao.agendada_para) + 3_600_000,
      ).toISOString();
      const id = await calendario().criarEventoAlheio(
        inicio,
        somarMinutos(inicio, 30),
      );
      contexto.eventosAlheios?.push(id);
      return "[alguém cria um evento pessoal no calendário, no mesmo dia da reunião]";
    }
    case "moverEventoPelaEdilaine": {
      const [linha] = await consulta.linhas(sqlEventoDaConversa(conversaId));
      const sessao = estado.sessoes.find((s) => s.status === "agendada");
      const eventoId = String(linha?.["evento_id"] ?? "");
      if (!eventoId || !sessao?.agendada_para)
        throw new Error("moverEventoPelaEdilaine: não há evento da Isadora");
      const inicio = new Date(
        Date.parse(sessao.agendada_para) + acao.horas * 3_600_000,
      ).toISOString();
      await calendario().moverEvento(
        eventoId,
        inicio,
        somarMinutos(inicio, 30),
      );
      return `[a Edilaine move o evento ${acao.horas} h no Google Calendar]`;
    }
    case "moverEventoPara": {
      const [linha] = await consulta.linhas(sqlEventoDaConversa(conversaId));
      const eventoId = String(linha?.["evento_id"] ?? "");
      if (!eventoId)
        throw new Error("moverEventoPara: não há evento da Isadora");
      const inicio = instanteLocal(acao.diasDaquiA, acao.hora);
      await calendario().moverEvento(
        eventoId,
        inicio,
        somarMinutos(inicio, 30),
      );
      return `[a Edilaine muda o evento para ${acao.diasDaquiA === 1 ? "amanhã" : `daqui a ${acao.diasDaquiA} dias`} às ${acao.hora} no Google Calendar]`;
    }
    case "apagarEventoPelaEdilaine": {
      const [linha] = await consulta.linhas(sqlEventoDaConversa(conversaId));
      const eventoId = String(linha?.["evento_id"] ?? "");
      if (!eventoId)
        throw new Error("apagarEventoPelaEdilaine: não há evento da Isadora");
      await calendario().apagarEvento(eventoId);
      return "[a Edilaine apaga o evento no Google Calendar]";
    }
    case "calendarioForaDoAr":
      await calendario().foraDoAr(acao.valor);
      return acao.valor
        ? "[o Google Calendar fica fora do ar]"
        : "[o Google Calendar volta]";
    case "falharCriacaoDoEvento":
      await calendario().falharProxima("criar", "Service Unavailable", 503);
      return "[a próxima criação de evento no Google Calendar vai falhar]";
    case "chegarAVespera":
      await consulta.linhas(sqlChegarAVespera(conversaId));
      return "[chega a véspera da reunião: o lembrete fica devido]";
    case "registrarDesfecho": {
      const sessao = estado.sessoes.find((s) => s.status === "agendada");
      if (!sessao) throw new Error("registrarDesfecho: não há reunião marcada");
      await consulta.linhas(sqlReuniaoJaAconteceu(conversaId));
      await consulta.linhas(
        sqlRegistrarDesfecho(sessao.id, acao.desfecho, acao.resultado ?? null),
      );
      return acao.desfecho === "realizada"
        ? "[a Edilaine registra no CRM: reunião realizada]"
        : "[a Edilaine registra no CRM: a família não compareceu]";
    }
    case "equipeResponde": {
      const aberta = [...estado.consultas]
        .reverse()
        .find((c) => c.status === "aberta");
      if (!aberta)
        throw new Error("equipeResponde: não há consulta aberta da Isadora");
      await consulta.linhas(
        sqlResponderConsulta(aberta.id, acao.resposta ?? null),
      );
      return "[a equipe responde à Isadora em Perguntas da Isadora]";
    }
    case "edilaineAbreFaixa": {
      const faixas = ((await lerParametro(consulta, "agenda_faixas")) ??
        {}) as Record<string, string[][]>;
      await gravarParametro(consulta, "agenda_faixas", {
        ...faixas,
        [acao.dia]: [...(faixas[acao.dia] ?? []), [acao.de, acao.ate]],
      });
      return `[a Edilaine abre uma faixa de horário: ${acao.dia} das ${acao.de} às ${acao.ate}]`;
    }
  }
}

/** Fecha o que o caso deixou pendente na conversa (consulta aberta, lembrete agendado). */
export async function encerrarPendencias(
  consulta: Consulta,
  conversaId: string | null | undefined,
): Promise<void> {
  if (!conversaId) return;
  for (const comando of sqlEncerrarPendencias(conversaId))
    await consulta.linhas(comando);
}
