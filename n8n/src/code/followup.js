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

// Nó "Ler Janela do Follow-up", depois de `agente.janela_followup(execucao_id)`
// (P18b, PRD 4.1 D-08 e T-01). A Cloud API só aceita texto livre dentro da
// janela de `whatsapp_janela_horas` desde a última mensagem da família:
// - dentro: `dentro_janela` verdadeiro, segue o caminho de sempre (o modelo
//   de linguagem gera o texto, o validador confere);
// - fora, com modelo aprovado pela Meta: o texto é o do modelo, fixo, sem
//   modelo de linguagem e sem validador (já foi aprovado pela equipe e pela
//   Meta), e o envio vai pela Cloud API (`via_modelo`);
// - fora, sem modelo aprovado (ou qualquer falha ao perguntar ao banco):
//   nada sai. O follow-up fecha como "não saiu" e segue a regra do banco
//   (volta uma vez, depois vira tarefa do comercial). Texto livre nunca sai
//   fora da janela, nem como plano B.
export function lerJanelaFollowup(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const semEnvio = (motivo) =>
    comMarca({ ...estado, dentro_janela: false, via_modelo: false, followup_aprovado: false, followup_motivo: motivo });

  if (!resultado || resultado.ok !== true) return semEnvio('janela_indisponivel');
  if (resultado.dentro_janela === true) return comMarca({ ...estado, dentro_janela: true, via_modelo: false });

  const modelo = resultado.modelo && typeof resultado.modelo === 'object' ? resultado.modelo : null;
  const nome = textoLimpo(modelo?.nome);
  const idioma = textoLimpo(modelo?.idioma);
  const texto = textoLimpo(modelo?.texto);
  const parametros = Array.isArray(modelo?.parametros) ? modelo.parametros.map((p) => textoLimpo(p)) : null;
  if (!modelo || !nome || !idioma || !texto || !parametros) return semEnvio(textoLimpo(resultado.motivo) || 'sem_modelo_aprovado');
  if (parametros.some((p) => p === '')) return semEnvio('parametro_sem_valor');
  const telefone = textoLimpo(resultado.telefone).replace(/\D/g, '');
  if (telefone.length < 10) return semEnvio('sem_telefone');

  const template = { name: nome, language: { code: idioma } };
  if (parametros.length > 0) {
    template.components = [{ type: 'body', parameters: parametros.map((p) => ({ type: 'text', text: p })) }];
  }
  return comMarca({
    ...estado,
    dentro_janela: false,
    via_modelo: true,
    followup_aprovado: true,
    texto_followup: texto,
    modelo_nome: nome,
    corpo_cloud_api: { messaging_product: 'whatsapp', recipient_type: 'individual', to: telefone, type: 'template', template },
  });
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
