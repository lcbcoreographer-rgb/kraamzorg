// Decisão do nó "Agrupar Mensagens" (fluxo 3, nó 14, padrão Drop): só a
// execução da última mensagem segue, com todas as mensagens do buffer juntas;
// as execuções mais antigas da mesma janela não respondem (PRD 19.4, nó 14).
// Falha do Redis segue sem agrupar, cada mensagem sozinha, nunca para o fluxo
// (PRD 19.4, nó 14, e 11.3).
//
// Função pura: recebe o estado do buffer já lido do Redis depois da espera de
// `agente_debounce_segundos`, não fala com o Redis. O nó Code do n8n só monta
// esse objeto a partir do redis get/wait e chama esta função.
//
// [P25] O buffer mora num hash do Redis (`kz:buf:{conversa_id}`, um campo por
// mensagem), porque o nó Redis 1 só põe TTL em `set`, nunca em `push`: o
// `set` de hash grava o campo (HSET, atômico) e renova o TTL de 5 minutos. A
// ordem vem do carimbo de tempo da mensagem. Cada entrada leva, além do
// texto, as marcas de mídia e de áudio não transcrito, para o nó 21 e o nó 24
// verem o grupo inteiro. Se a entrada desta execução não está no buffer (outra
// execução já apagou a chave), ela segue sozinha: nenhuma mensagem se perde.

function juntarTextos(lista) {
  return lista
    .map((mensagem) => (mensagem?.texto ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function marcas(lista) {
  const midias = lista.filter((mensagem) => mensagem?.midia === true);
  return {
    midia: midias.length > 0,
    tiposMidia: [...new Set(midias.map((mensagem) => mensagem.tipo).filter(Boolean))],
    audioNaoTranscrito: lista.some((mensagem) => mensagem?.audio_nao_transcrito === true),
  };
}

export function agrupamento({ buffer, idExecucaoAtual, textoAtual, falhaRedis = false, entradaAtual = null }) {
  const textoAvulsoNormalizado = (textoAtual ?? '').trim();
  const sozinha = entradaAtual ? [entradaAtual] : [];

  const seguirSozinha = () => ({
    deveResponder: true,
    texto: textoAvulsoNormalizado,
    agrupado: false,
    quantidade: textoAvulsoNormalizado ? 1 : 0,
    ...marcas(sozinha),
  });

  if (falhaRedis || !Array.isArray(buffer) || buffer.length === 0) {
    return seguirSozinha();
  }

  const presente = buffer.some((mensagem) => mensagem?.id === idExecucaoAtual);
  if (!presente && entradaAtual) {
    return seguirSozinha();
  }

  const ultima = buffer[buffer.length - 1];
  const deveResponder = ultima != null && ultima.id === idExecucaoAtual;

  return {
    deveResponder,
    texto: juntarTextos(buffer),
    agrupado: buffer.length > 1,
    quantidade: buffer.length,
    ...marcas(buffer),
  };
}

// Converte o valor lido do hash do Redis (`{ campo: "json da entrada" }`) na
// lista ordenada que `agrupamento` espera. Nulo quando o valor não é hash
// (falha de leitura).
export function lerBufferRedis(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const lista = [];
  for (const [campo, bruto] of Object.entries(valor)) {
    let entrada = bruto;
    if (typeof bruto === 'string') {
      try {
        entrada = JSON.parse(bruto);
      } catch {
        entrada = null;
      }
    }
    if (entrada && typeof entrada === 'object') {
      lista.push({ ...entrada, id: entrada.id ?? campo });
    }
  }
  return lista.sort((a, b) => {
    const porCarimbo = (Number(a.carimbo) || 0) - (Number(b.carimbo) || 0);
    if (porCarimbo !== 0) return porCarimbo;
    return String(a.id).localeCompare(String(b.id));
  });
}
