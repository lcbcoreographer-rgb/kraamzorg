// Leitura do resultado de um nó externo (Postgres, HTTP, Redis, Execute
// Workflow, AI Agent) no fluxo 3 (P25). Função pura, embutida nos nós Code
// junto com quem a importa.
//
// Duas formas de falha, as duas com `onError: continueRegularOutput`:
// - erro por item: o nó devolve `{ error: ... }` (Postgres, HTTP, agente);
// - erro no nó inteiro (conexão recusada antes do laço de itens, credencial
//   ausente): o n8n repassa o item de ENTRADA sem mudança
//   (`workflow-execute.js`, `continuesOnError`). Por isso todo estado do
//   fluxo 3 leva a marca `_kz_estado`: se a "resposta" tem a marca, é o
//   próprio estado voltando, e a chamada falhou.

export const MARCA_ESTADO = '_kz_estado';

export function comMarca(estado) {
  return { ...estado, [MARCA_ESTADO]: true };
}

export function textoLimpo(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

// Resultado de `select agente.f(...) as resultado`: o driver entrega jsonb
// como objeto; um texto JSON também é aceito.
export function lerJsonb(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const objeto = JSON.parse(valor);
      return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function falhouChamada(resposta) {
  if (!resposta || typeof resposta !== 'object' || Array.isArray(resposta)) return true;
  if (resposta.error !== undefined) return true;
  return resposta[MARCA_ESTADO] === true;
}

export function descreverErro(resposta) {
  if (!resposta || typeof resposta !== 'object') return 'sem resposta';
  if (resposta[MARCA_ESTADO] === true) return 'falha no nó inteiro (item repassado sem resposta)';
  const erro = resposta.error;
  if (typeof erro === 'string') return erro;
  if (erro && typeof erro.message === 'string') return erro.message;
  if (typeof resposta.message === 'string') return resposta.message;
  return 'falha sem detalhe';
}

// `resultado` de uma função do schema `agente`, ou nulo quando a chamada
// falhou ou o banco devolveu algo que não é objeto.
export function resultadoDoBanco(resposta) {
  if (falhouChamada(resposta)) return null;
  return lerJsonb(resposta.resultado);
}

// Conteúdo devolvido pela API de chat da OpenAI, ou nulo em falha.
export function conteudoOpenAi(resposta) {
  if (falhouChamada(resposta)) return null;
  const conteudo = resposta?.choices?.[0]?.message?.content;
  return typeof conteudo === 'string' ? conteudo : null;
}

// Objeto JSON dentro do conteúdo do modelo, ou nulo.
export function jsonDoModelo(conteudo) {
  if (typeof conteudo !== 'string') return null;
  try {
    const objeto = JSON.parse(conteudo);
    return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto : null;
  } catch {
    return null;
  }
}
