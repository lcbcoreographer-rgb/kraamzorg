// Decisão do nó "Agrupar Mensagens" (fluxo 3, nó 14, padrão Drop): só a
// execução da última mensagem segue, com todas as mensagens do buffer juntas;
// as execuções mais antigas da mesma janela não respondem (PRD 19.4, nó 14).
// Falha do Redis segue sem agrupar, cada mensagem sozinha, nunca para o fluxo
// (PRD 19.4, nó 14, e 11.3).
//
// Função pura: recebe o estado do buffer já lido do Redis depois da espera de
// `agente_debounce_segundos`, não fala com o Redis. O nó Code do n8n só monta
// esse objeto a partir do redis get/wait e chama esta função.

export function agrupamento({ buffer, idExecucaoAtual, textoAtual, falhaRedis = false }) {
  const textoAvulsoNormalizado = (textoAtual ?? '').trim();

  if (falhaRedis || !Array.isArray(buffer) || buffer.length === 0) {
    return {
      deveResponder: true,
      texto: textoAvulsoNormalizado,
      agrupado: false,
      quantidade: textoAvulsoNormalizado ? 1 : 0,
    };
  }

  const ultima = buffer[buffer.length - 1];
  const deveResponder = ultima != null && ultima.id === idExecucaoAtual;
  const texto = buffer
    .map((mensagem) => (mensagem?.texto ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    deveResponder,
    texto,
    agrupado: buffer.length > 1,
    quantidade: buffer.length,
  };
}
