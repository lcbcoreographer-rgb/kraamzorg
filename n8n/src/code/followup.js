// Entrada B do fluxo 3: follow-up agendado (PRD 19.4 nós 36 a 41, 11.11 itens
// 7 e 8). Funções puras, embutidas nos nós Code; os testes importam as
// mesmas.
//
// - `[SILENCIO]` é lido antes do validador (nó 39) e conta como "não saiu":
//   a execução volta uma vez na próxima janela e, na segunda vez, vira tarefa
//   do comercial (regra do banco em `registrar_followup`).
// - Mesmo validador das respostas, sem valor nenhum, sem apresentação e sem
//   texto entre colchetes.
// - Variação de texto (item 7): nunca a mesma mensagem proativa para duas
//   famílias no mesmo dia. Comparação no código, por hash e por semelhança
//   com os follow-ups do dia; esses textos nunca vão para o modelo.
//
// Contrato esperado do banco (P22): followups_devidos() -> {ok, itens:
// [{execucao_id, conversa_id, wa_jid, nome, texto_base, tempo_sem_resposta,
// data_hora, ultimas_mensagens: [{de, texto}]}], validador: {listas},
// enviados_hoje: [texto], limite_similaridade}. Já aplica freio,
// nao_contatar, pausa, handoff aberto, modo (nunca humano_comercial), lista
// de teste, conversa iniciada pela família, janela de envio, uma mensagem de
// conteúdo por dia e `agente_followup_horas`, e reserva a execução.

import { comMarca, resultadoDoBanco, textoLimpo } from './resultado-no.js';

const ROTULOS = { familia: 'Família', cliente: 'Família' };

export function formatarUltimasMensagens(mensagens) {
  const lista = Array.isArray(mensagens) ? mensagens.filter((m) => m && typeof m === 'object') : [];
  if (lista.length === 0) return '(sem mensagens)';
  return lista.map((m) => `${ROTULOS[m.de] ?? 'Isadora'}: ${textoLimpo(m.texto)}`).join('\n');
}

// Nó "Separar Follow-ups", depois do nó 37: um item por follow-up devido.
export function separarFollowups(resposta) {
  const resultado = resultadoDoBanco(resposta);
  if (!resultado || resultado.ok !== true || !Array.isArray(resultado.itens)) return [];
  const validador = resultado.validador && typeof resultado.validador === 'object' ? resultado.validador : {};
  const enviadosHoje = Array.isArray(resultado.enviados_hoje) ? resultado.enviados_hoje.filter((t) => typeof t === 'string') : [];
  const limite = Number(resultado.limite_similaridade);
  return resultado.itens
    .filter((item) => item && textoLimpo(item.execucao_id) && textoLimpo(item.conversa_id) && textoLimpo(item.wa_jid))
    .map((item) =>
      comMarca({
        execucao_id: textoLimpo(item.execucao_id),
        conversa_id: textoLimpo(item.conversa_id),
        wa_jid: textoLimpo(item.wa_jid),
        nome: textoLimpo(item.nome),
        texto_base: textoLimpo(item.texto_base),
        tempo_sem_resposta: textoLimpo(item.tempo_sem_resposta),
        data_hora: textoLimpo(item.data_hora),
        ultimas_mensagens_texto: formatarUltimasMensagens(item.ultimas_mensagens),
        listas: validador.listas ?? null,
        enviados_hoje: enviadosHoje,
        limite_similaridade: Number.isFinite(limite) && limite > 0 && limite <= 1 ? limite : null,
      }),
    );
}

// Nó "Fechar Follow-up": ponto único antes do nó 41, venha o item do envio,
// da reprovação ou da recusa do `pode_enviar`.
export function fecharFollowup(estado) {
  const saiu = estado.followup_aprovado === true && estado.pode_enviar === true && estado.envio_saiu === true;
  return comMarca({
    ...estado,
    followup_ok: saiu,
    texto_enviado: saiu ? estado.texto_followup : null,
  });
}
