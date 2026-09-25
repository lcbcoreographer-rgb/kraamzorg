// Verificadores estruturais reutilizados por `n8n/build.test.mjs` (PRD 19.5 e
// P23 item 3). Cada função recebe um fluxo já montado (`{ id, name, nodes,
// connections, settings }`) e devolve `{ ok, problemas }`, com `problemas`
// uma lista de strings legíveis (vazia quando está tudo certo). Nenhuma
// função aqui fala com o disco: só olha a estrutura em memória, para poder
// ser testada tanto contra o JSON gerado de verdade quanto contra fixtures
// pequenas que provam que cada regra realmente pega violação.

function semProblemas() {
  return { ok: true, problemas: [] };
}

function comProblemas(problemas) {
  return { ok: problemas.length === 0, problemas };
}

export function nomesDeNoUnicos(fluxo) {
  const vistos = new Map();
  const duplicados = new Set();
  for (const no of fluxo.nodes ?? []) {
    vistos.set(no.name, (vistos.get(no.name) ?? 0) + 1);
    if (vistos.get(no.name) > 1) duplicados.add(no.name);
  }
  return comProblemas([...duplicados].map((nome) => `nó duplicado: "${nome}"`));
}

export function conexoesValidas(fluxo) {
  const nomes = new Set((fluxo.nodes ?? []).map((no) => no.name));
  const problemas = [];

  for (const [origem, porTipo] of Object.entries(fluxo.connections ?? {})) {
    if (!nomes.has(origem)) {
      problemas.push(`conexão sai de nó inexistente: "${origem}"`);
      continue;
    }
    for (const [tipoConexao, saidas] of Object.entries(porTipo)) {
      for (const saida of saidas ?? []) {
        for (const destino of saida ?? []) {
          if (!nomes.has(destino.node)) {
            problemas.push(`conexão "${origem}" (${tipoConexao}) aponta para nó inexistente: "${destino.node}"`);
          }
        }
      }
    }
  }

  return comProblemas(problemas);
}

export function temIdNaRaiz(fluxo) {
  if (typeof fluxo.id === 'string' && fluxo.id.length > 0) return semProblemas();
  return comProblemas(['fluxo sem "id" de nível raiz (import:workflow falha sem ele)']);
}

const TIPOS_FERRAMENTA = new Set([
  'n8n-nodes-base.postgresTool',
  '@n8n/n8n-nodes-langchain.toolWorkflow',
]);

export function todaFerramentaTemDescricao(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (TIPOS_FERRAMENTA.has(no.type)) {
      const descricao = no.parameters?.toolDescription ?? no.parameters?.description;
      if (typeof descricao !== 'string' || descricao.trim().length === 0) {
        problemas.push(`ferramenta sem descrição: "${no.name}"`);
      }
    }
    if (
      no.type === '@n8n/n8n-nodes-langchain.vectorStorePGVector' &&
      no.parameters?.mode === 'retrieve-as-tool'
    ) {
      const descricao = no.parameters?.toolDescription;
      if (typeof descricao !== 'string' || descricao.trim().length === 0) {
        problemas.push(`vector store como ferramenta sem toolDescription: "${no.name}"`);
      }
    }
  }
  return comProblemas(problemas);
}

const TIPOS_POSTGRES = new Set(['n8n-nodes-base.postgres', 'n8n-nodes-base.postgresTool']);

// PRD 19.1 e armadilha 1 de versoes-nos.json: os parâmetros do Postgres vão
// como expressão que devolve lista (`options.queryReplacement`), nunca como
// string separada por vírgula, porque o split por vírgula (typeVersion < 2.5)
// quebra qualquer valor de conteúdo que tenha vírgula.
export function postgresComParametrosEmLista(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (!TIPOS_POSTGRES.has(no.type)) continue;
    const query = no.parameters?.query;
    if (typeof query !== 'string' || !query.includes('$1')) continue; // sem parâmetro posicional, nada a checar aqui
    const queryReplacement = no.parameters?.options?.queryReplacement;
    const ehExpressaoDeLista = typeof queryReplacement === 'string' && /^=\s*\{\{\s*\[/.test(queryReplacement);
    if (!ehExpressaoDeLista) {
      problemas.push(
        `nó Postgres "${no.name}" usa parâmetro posicional mas "options.queryReplacement" não é uma expressão que devolve lista`,
      );
    }
  }
  return comProblemas(problemas);
}

// PRD 19.5 (v4.2): o campo `query` de todo nó Postgres/postgresTool é
// literal, começa por "select agente." ou "select * from agente.", não
// contém "{{" nem "$fromAI" — que só pode aparecer em `queryReplacement`.
export function queryPostgresLiteralESegura(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (!TIPOS_POSTGRES.has(no.type)) continue;
    const query = no.parameters?.query;
    if (typeof query !== 'string') {
      problemas.push(`nó Postgres "${no.name}" sem campo "query" literal`);
      continue;
    }
    if (query.startsWith('=')) {
      problemas.push(`nó Postgres "${no.name}": "query" não pode ser expressão (começa com "=")`);
    }
    if (!(query.startsWith('select agente.') || query.startsWith('select * from agente.'))) {
      problemas.push(`nó Postgres "${no.name}": "query" não começa com "select agente." nem "select * from agente."`);
    }
    if (query.includes('{{')) {
      problemas.push(`nó Postgres "${no.name}": "query" contém "{{" (texto concatenado, proibido)`);
    }
    if (query.includes('$fromAI')) {
      problemas.push(`nó Postgres "${no.name}": "query" contém "$fromAI" (só pode aparecer em queryReplacement)`);
    }
  }
  return comProblemas(problemas);
}

// PRD 11.10 e 19.1 (v4.2): o conversa_id de toda chamada vem do nó
// "Registrar Msg Família"/"Registrar Msg Humana", nunca de $fromAI; o jid
// (ou wa_jid) só serve para enviar e também nunca vem do modelo.
export function nenhumFromAiEmConversaIdOuJid(fluxo) {
  const problemas = [];
  const regexProibido = /\$fromAI\(\s*['"](conversa_id|jid|wa_jid)['"]/g;
  const textoFluxo = JSON.stringify(fluxo);
  for (const match of textoFluxo.matchAll(regexProibido)) {
    problemas.push(`$fromAI preenchendo campo proibido: ${match[0]}`);
  }
  return comProblemas(problemas);
}

// PRD 11.10 (v4.2): PGVector sempre com tableName = 'documentos' e Postgres
// Chat Memory sempre com tableName = 'chat_memoria', sem espaço nem variação
// (o build.test.mjs de 19.5 confere isso porque um tableName errado cria
// tabela nova em silêncio, sem RLS).
export function tableNamesCorretos(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (no.type === '@n8n/n8n-nodes-langchain.vectorStorePGVector') {
      if (no.parameters?.tableName !== 'documentos') {
        problemas.push(`PGVector "${no.name}": tableName deveria ser "documentos", veio "${no.parameters?.tableName}"`);
      }
    }
    if (no.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') {
      if (no.parameters?.tableName !== 'chat_memoria') {
        problemas.push(
          `Postgres Chat Memory "${no.name}": tableName deveria ser "chat_memoria", veio "${no.parameters?.tableName}"`,
        );
      }
    }
  }
  return comProblemas(problemas);
}

// PRD 19.5 (v4.2) e armadilha 9 de versoes-nos.json: contextWindowLength
// (padrão do nó: 5) e topK (padrão do nó: 4) precisam estar declarados com
// os valores do capítulo 11.9/19.4 (30 e 5).
export function contextWindowETopKDeclarados(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (no.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') {
      if (no.parameters?.contextWindowLength !== 30) {
        problemas.push(`Postgres Chat Memory "${no.name}": contextWindowLength deveria ser 30`);
      }
    }
    if (
      no.type === '@n8n/n8n-nodes-langchain.vectorStorePGVector' &&
      no.parameters?.mode === 'retrieve-as-tool'
    ) {
      if (no.parameters?.topK !== 5) {
        problemas.push(`PGVector como ferramenta "${no.name}": topK deveria ser 5`);
      }
    }
  }
  return comProblemas(problemas);
}

const CHAVES_PROIBIDAS_DENTRO_DE_PARAMETERS = ['onError', 'alwaysOutputData', 'retryOnFail', 'maxTries', 'continueOnFail'];

// n8n/referencia/README.md, armadilha 12: onError, alwaysOutputData,
// retryOnFail, maxTries e continueOnFail são chaves do nó, nunca de
// `parameters`.
export function onErrorForaDeParameters(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    for (const chave of CHAVES_PROIBIDAS_DENTRO_DE_PARAMETERS) {
      if (no.parameters && Object.prototype.hasOwnProperty.call(no.parameters, chave)) {
        problemas.push(`nó "${no.name}": "${chave}" está dentro de parameters, deveria estar no nível do nó`);
      }
    }
  }
  return comProblemas(problemas);
}

const VALORES_ON_ERROR_VALIDOS = new Set(['continueRegularOutput', 'continueErrorOutput', 'stopWorkflow']);

// PRD 19.1: "chamadas externas com onError: continueRegularOutput ou
// continueErrorOutput e checagem explícita do retorno". Aqui confere só a
// parte estrutural (onError presente e com valor válido); a checagem do
// retorno é lógica de nó Code/If, fora do que uma varredura de JSON prova.
export function todaChamadaExternaComTratamentoDeErro(fluxo) {
  const problemas = [];
  const tiposDeChamadaExterna = new Set(['n8n-nodes-base.httpRequest', 'n8n-nodes-base.postgres', 'n8n-nodes-base.redis']);
  for (const no of fluxo.nodes ?? []) {
    if (!tiposDeChamadaExterna.has(no.type)) continue;
    if (!VALORES_ON_ERROR_VALIDOS.has(no.onError)) {
      problemas.push(`chamada externa "${no.name}" sem "onError" válido no nível do nó`);
    }
  }
  return comProblemas(problemas);
}

// PRD 19.1: "Todo envio do agente leva track_source: 'kraamzorg-agente', que
// é como o fluxo reconhece o próprio eco".
export function trackSourceEmTodoEnvio(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    if (no.type !== 'n8n-nodes-base.httpRequest') continue;
    const url = no.parameters?.url ?? '';
    const ehEnvioUazapi = typeof url === 'string' && /\/send\/(text|media)\b/.test(url);
    if (!ehEnvioUazapi) continue;
    const corpo = JSON.stringify(no.parameters?.jsonBody ?? no.parameters?.bodyParameters ?? '');
    if (!corpo.includes('track_source')) {
      problemas.push(`envio UAZAPI "${no.name}" sem "track_source" no corpo`);
    }
  }
  return comProblemas(problemas);
}

export function nenhumaCredencialSupabaseApi(fluxo) {
  const problemas = [];
  for (const no of fluxo.nodes ?? []) {
    const credenciais = no.credentials ?? {};
    if (Object.prototype.hasOwnProperty.call(credenciais, 'supabaseApi')) {
      problemas.push(`nó "${no.name}" usa credencial do tipo supabaseApi, proibido (D-14, 11.10)`);
    }
  }
  return comProblemas(problemas);
}

// PRD 19.4: depois do "Caminho de Alerta" (nó 20) a execução termina em
// todos os modos; nenhuma conexão liga esse ramo ao nó "Agente Isadora"
// (nó 26). Genérico: recebe os nomes exatos dos dois nós para não depender
// da posição no array.
export function semConexaoEntreNos(fluxo, nomeOrigem, nomeDestinoProibido) {
  const saidas = fluxo.connections?.[nomeOrigem] ?? {};
  for (const porTipo of Object.values(saidas)) {
    for (const saida of porTipo ?? []) {
      for (const destino of saida ?? []) {
        if (destino.node === nomeDestinoProibido) {
          return comProblemas([`conexão proibida: "${nomeOrigem}" -> "${nomeDestinoProibido}"`]);
        }
      }
    }
  }
  return semProblemas();
}

export function executarTodosOsValidadoresEstruturais(fluxo) {
  const resultados = {
    nomesDeNoUnicos: nomesDeNoUnicos(fluxo),
    conexoesValidas: conexoesValidas(fluxo),
    temIdNaRaiz: temIdNaRaiz(fluxo),
    todaFerramentaTemDescricao: todaFerramentaTemDescricao(fluxo),
    postgresComParametrosEmLista: postgresComParametrosEmLista(fluxo),
    queryPostgresLiteralESegura: queryPostgresLiteralESegura(fluxo),
    nenhumFromAiEmConversaIdOuJid: nenhumFromAiEmConversaIdOuJid(fluxo),
    tableNamesCorretos: tableNamesCorretos(fluxo),
    contextWindowETopKDeclarados: contextWindowETopKDeclarados(fluxo),
    onErrorForaDeParameters: onErrorForaDeParameters(fluxo),
    todaChamadaExternaComTratamentoDeErro: todaChamadaExternaComTratamentoDeErro(fluxo),
    trackSourceEmTodoEnvio: trackSourceEmTodoEnvio(fluxo),
    nenhumaCredencialSupabaseApi: nenhumaCredencialSupabaseApi(fluxo),
  };
  const problemas = Object.entries(resultados).flatMap(([nome, resultado]) =>
    resultado.problemas.map((problema) => `[${nome}] ${problema}`),
  );
  return comProblemas(problemas);
}
