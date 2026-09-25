// Nós 28 e 29 do fluxo 3 (PRD 19.4 e 11.11): validação da resposta do
// agente, reescrita e `fallback_confirmar`. Funções puras,
// embutidas nos nós Code; os testes importam as mesmas.

import { validarResposta, violacoesEmTexto } from './validar-resposta.js';
import { temSilencio } from './marcas-sistema.js';
import { HANDOFF_MOTIVOS } from './motivos-handoff.js';
import { comMarca, conteudoOpenAi, jsonDoModelo, resultadoDoBanco, textoLimpo } from './resultado-no.js';

function contextoDeValidacao(estado) {
  const motivos = [estado.validador?.motivo_em_curso, ...(estado.motivos_transferidos ?? [])].filter(Boolean);
  return {
    ...(estado.validador ?? {}),
    motivo_em_curso: motivos,
    fechamento_venda: estado.fechamento_venda === true,
  };
}

// Nó 28 "Validar Resposta".
export function validarRespostaDoAgente(estado) {
  const resultado = validarResposta(estado.saida_modelo, contextoDeValidacao(estado));
  return comMarca({
    ...estado,
    resposta_aprovada: resultado.aprovada,
    texto_resposta: resultado.texto,
    violacoes: resultado.violacoes,
    violacoes_texto: violacoesEmTexto(resultado.violacoes),
    correcoes: resultado.correcoes,
    texto_para_reescrita: resultado.texto,
  });
}

// Nó 29 "Reescrever": lê a saída do modelo de reescrita e valida de novo.
// `[SEGURANCA]`, JSON inválido, falha da chamada ou nova violação: sai
// `fallback_confirmar` e o fluxo 2 com `validacao_resposta`.
export function lerReescrita(estado, respostaOpenAi) {
  const objeto = jsonDoModelo(conteudoOpenAi(respostaOpenAi));
  const texto = textoLimpo(objeto?.texto);
  const seguranca = /\[\s*SEGURANCA\s*\]/i.test(texto);
  const transferir = HANDOFF_MOTIVOS.includes(objeto?.transferir) && !['saude', 'perda'].includes(objeto.transferir)
    ? objeto.transferir
    : null;
  if (!objeto || !texto || seguranca || temSilencio(texto)) {
    return comMarca({
      ...estado,
      reescrita_aprovada: false,
      reescrita_motivo: !objeto ? 'reescrita_sem_json' : seguranca ? 'reescrita_seguranca' : 'reescrita_vazia',
      reescrita_transferir: null,
    });
  }
  const resultado = validarResposta(texto, contextoDeValidacao(estado));
  return comMarca({
    ...estado,
    reescrita_aprovada: resultado.aprovada,
    reescrita_motivo: resultado.aprovada ? null : 'violacao_persistiu',
    texto_resposta: resultado.aprovada ? resultado.texto : estado.texto_resposta,
    violacoes: resultado.aprovada ? estado.violacoes : [...(estado.violacoes ?? []), ...resultado.violacoes],
    reescrita_transferir: resultado.aprovada ? transferir : null,
    tem_transferencia_reescrita: resultado.aprovada && transferir !== null,
  });
}

// Depois de `agente.mensagem_sistema(conversa_id, 'fallback_confirmar')`.
export function lerFallback(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const texto = textoLimpo(resultado?.texto);
  return comMarca({ ...estado, texto_resposta: texto || null, fallback_ok: texto.length > 0 });
}
