// Simulador mínimo de execução de um fluxo gerado pelo build, só para os
// testes (P24, ampliado no P25). Executa o JSON do fluxo como o n8n faria no
// essencial: nós Code rodam o `jsCode` embutido de verdade, nós If, Switch,
// Set, Split Out, Loop Over Items e Wait avaliam as expressões `={{ ... }}`,
// e as chamadas externas (Postgres, HTTP, Redis, Execute Workflow, AI Agent)
// vão para funções falsas passadas pelo teste. Assim os cenários provam a
// ligação dos nós, não só as funções puras.
//
// Limites conhecidos, de propósito: só a saída `main` (sub-nós de IA não
// rodam; o teste do agente decide o que o agente devolve); `$('Nó').item`
// devolve o item de mesmo índice da última execução daquele nó (o n8n usa o
// rastreio de pares, que dá o mesmo resultado nos fluxos deste projeto,
// porque todo nó que lê `.item` de outro vem logo depois de um nó 1:1 dele);
// não há `$node`, `$items` nem `$env`. A importação real num n8n 2.40.6
// continua sendo a prova de formato (`n8n/referencia/validar.sh`).
//
// Falhas: o serviço falso lança um erro. Com `onError: continueRegularOutput`
// o item vira `{ error: { message } }` (erro por item, o caso comum); se o
// erro tiver `noInteiro = true`, o item de entrada passa adiante sem mudança,
// como o n8n faz quando o nó inteiro falha antes do laço de itens
// (`workflow-execute.js`, conexão recusada no Redis, por exemplo).

const TIPO = {
  gatilhoSubFluxo: 'n8n-nodes-base.executeWorkflowTrigger',
  webhook: 'n8n-nodes-base.webhook',
  agenda: 'n8n-nodes-base.scheduleTrigger',
  manual: 'n8n-nodes-base.manualTrigger',
  code: 'n8n-nodes-base.code',
  if: 'n8n-nodes-base.if',
  switch: 'n8n-nodes-base.switch',
  set: 'n8n-nodes-base.set',
  wait: 'n8n-nodes-base.wait',
  splitOut: 'n8n-nodes-base.splitOut',
  lote: 'n8n-nodes-base.splitInBatches',
  postgres: 'n8n-nodes-base.postgres',
  http: 'n8n-nodes-base.httpRequest',
  redis: 'n8n-nodes-base.redis',
  subFluxo: 'n8n-nodes-base.executeWorkflow',
  agente: '@n8n/n8n-nodes-langchain.agent',
  vectorStore: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
  nota: 'n8n-nodes-base.stickyNote',
};

const GATILHOS = new Set([TIPO.gatilhoSubFluxo, TIPO.webhook, TIPO.agenda, TIPO.manual]);
// [P26] O nó vectorStorePGVector em modo "insert" (fluxo 1, nó 8) fica na
// cadeia `main`, como uma chamada externa comum: os sub-nós de IA que ele
// também consome (ai_embedding, ai_document) não rodam no simulador, igual
// às ferramentas do agente (limite conhecido, ver cabeçalho). Em modo
// "retrieve-as-tool" (fluxo 3) o nó só é alcançado por conexão `ai_tool`,
// que o simulador nunca percorre, então entrar aqui não muda esse caminho.
const EXTERNOS = new Set([TIPO.postgres, TIPO.http, TIPO.redis, TIPO.subFluxo, TIPO.agente, TIPO.vectorStore]);

function copiar(valor) {
  return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
}

export function criarContexto() {
  return { execucoes: new Map(), ordem: [], lotes: new Map() };
}

function acessoAoNo(contexto, nome, indiceItem) {
  const execucoes = contexto.execucoes.get(nome) ?? [];
  const ultima = execucoes[execucoes.length - 1];
  const itens = ultima ?? [];
  return {
    get isExecuted() {
      return execucoes.length > 0;
    },
    get item() {
      if (!ultima) throw new Error(`$('${nome}').item: o nó ainda não rodou nesta execução`);
      return itens[indiceItem] ?? itens[0];
    },
    first() {
      if (!ultima) throw new Error(`$('${nome}').first(): o nó ainda não rodou nesta execução`);
      return itens[0];
    },
    all() {
      if (!ultima) throw new Error(`$('${nome}').all(): o nó ainda não rodou nesta execução`);
      return itens;
    },
  };
}

function fromAiAusente() {
  throw new Error('$fromAI só existe dentro de uma ferramenta do agente');
}

function avaliarExpressao(codigo, escopo) {
  const funcao = new Function('$json', '$', '$input', '$fromAI', `return (${codigo});`);
  return funcao(escopo.$json, escopo.$, escopo.$input, escopo.$fromAI ?? fromAiAusente);
}

// Avalia um valor de parâmetro do n8n: texto começando com "=" é expressão
// (inteira, `={{ x }}`, devolve o valor cru; misturada com texto, devolve
// texto). Objetos e listas são avaliados campo a campo.
export function avaliarParametro(valor, escopo) {
  if (Array.isArray(valor)) return valor.map((item) => avaliarParametro(item, escopo));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, avaliarParametro(item, escopo)]));
  }
  if (typeof valor !== 'string' || !valor.startsWith('=')) return valor;

  const corpo = valor.slice(1);
  const inteira = /^\{\{([\s\S]*)\}\}$/.exec(corpo.trim());
  if (inteira && !inteira[1].includes('{{')) {
    return avaliarExpressao(inteira[1], escopo);
  }
  return corpo.replace(/\{\{([\s\S]*?)\}\}/g, (_, codigo) => {
    const resultado = avaliarExpressao(codigo, escopo);
    if (resultado === null || resultado === undefined) return '';
    return typeof resultado === 'object' ? JSON.stringify(resultado) : String(resultado);
  });
}

function escopoDoItem(contexto, itens, indice) {
  const item = itens[indice];
  return {
    $json: item.json,
    $: (nome) => acessoAoNo(contexto, nome, indice),
    $input: { item, first: () => itens[0], all: () => itens },
  };
}

// Escopo para avaliar um parâmetro fora da execução normal (ferramentas do
// agente, que o simulador não roda): `$('Nó')` lê a execução simulada e
// `$fromAI` devolve o que o teste mandar.
export function escopoDeFerramenta(contexto, fromAi = () => undefined) {
  return {
    $json: {},
    $: (nome) => acessoAoNo(contexto, nome, 0),
    $input: {},
    $fromAI: fromAi,
  };
}

function rodarCode(no, itens, contexto) {
  const { jsCode, mode } = no.parameters;
  const funcao = new Function('$json', '$', '$input', jsCode);
  if (mode === 'runOnceForAllItems') {
    const escopo = escopoDoItem(contexto, itens, 0);
    const saida = funcao(undefined, escopo.$, escopo.$input);
    return (saida ?? []).map((item) => ({ json: copiar(item.json) }));
  }
  return itens.map((_, indice) => {
    const escopo = escopoDoItem(contexto, itens, indice);
    const saida = funcao(escopo.$json, escopo.$, escopo.$input);
    return { json: copiar(saida.json) };
  });
}

function condicaoVale(condicao, escopo) {
  const esquerda = avaliarParametro(condicao.leftValue, escopo);
  const direita = avaliarParametro(condicao.rightValue, escopo);
  const { type, operation } = condicao.operator;
  if (type === 'boolean') {
    if (typeof esquerda !== 'boolean') {
      throw new Error(`If com validação estrita recebeu ${typeof esquerda} em vez de booleano`);
    }
    if (operation === 'true') return esquerda === true;
    if (operation === 'false') return esquerda === false;
  }
  if (type === 'string' && typeof esquerda !== 'string') {
    throw new Error(`condição de texto com validação estrita recebeu ${typeof esquerda}`);
  }
  if (operation === 'equals') return esquerda === direita;
  if (operation === 'notEquals') return esquerda !== direita;
  throw new Error(`operador de If não suportado no simulador: ${type}/${operation}`);
}

function grupoVale(grupo, escopo) {
  const valores = grupo.conditions.map((condicao) => condicaoVale(condicao, escopo));
  return grupo.combinator === 'or' ? valores.some(Boolean) : valores.every(Boolean);
}

function rodarIf(no, itens, contexto) {
  const verdadeiros = [];
  const falsos = [];
  itens.forEach((item, indice) => {
    const escopo = escopoDoItem(contexto, itens, indice);
    (grupoVale(no.parameters.conditions, escopo) ? verdadeiros : falsos).push(item);
  });
  return [verdadeiros, falsos];
}

function rodarSwitch(no, itens, contexto) {
  const regras = no.parameters.rules?.values ?? [];
  const saidas = regras.map(() => []);
  itens.forEach((item, indice) => {
    const escopo = escopoDoItem(contexto, itens, indice);
    const regra = regras.findIndex((r) => grupoVale(r.conditions, escopo));
    if (regra >= 0) saidas[regra].push(item);
    else if (no.parameters.options?.fallbackOutput !== 'none') {
      throw new Error(`switch "${no.name}": fallback diferente de none não suportado no simulador`);
    }
  });
  return saidas;
}

function rodarSet(no, itens, contexto) {
  return itens.map((item, indice) => {
    const escopo = escopoDoItem(contexto, itens, indice);
    const base = no.parameters.includeOtherFields ? copiar(item.json) : {};
    for (const atribuicao of no.parameters.assignments.assignments) {
      base[atribuicao.name] = avaliarParametro(atribuicao.value, escopo);
    }
    return { json: base };
  });
}

function rodarSplitOut(no, itens) {
  const campo = no.parameters.fieldToSplitOut;
  const saida = [];
  for (const item of itens) {
    const lista = item.json[campo];
    for (const elemento of Array.isArray(lista) ? lista : []) {
      saida.push({ json: copiar(elemento && typeof elemento === 'object' ? elemento : { [campo]: elemento }) });
    }
  }
  return saida;
}

// Loop Over Items v3: saída 0 "done", saída 1 "loop" (armadilha 13).
function rodarLote(no, itens, contexto) {
  const tamanho = Number(no.parameters.batchSize) || 1;
  let estado = contexto.lotes.get(no.name);
  if (!estado) {
    estado = { restantes: [...itens], processados: [] };
    contexto.lotes.set(no.name, estado);
  } else {
    estado.processados.push(...itens);
  }
  if (estado.restantes.length > 0) {
    return [[], estado.restantes.splice(0, tamanho)];
  }
  contexto.lotes.delete(no.name);
  return [estado.processados, []];
}

// Chamada externa: `servicos[nomeDoNó](parametrosAvaliados, item, ctx)`
// devolve o objeto de resposta (ou uma lista de linhas, no Postgres) ou lança
// erro. `ctx.marcarExecutado(nome, itens)` registra a execução de um sub-nó
// (ferramenta do agente), para `$('nome').isExecuted`.
function rodarExterno(no, itens, contexto, servicos) {
  const servico = servicos[no.name];
  if (typeof servico !== 'function') {
    throw new Error(`simulador: nenhum serviço falso para o nó externo "${no.name}"`);
  }
  const ctx = {
    marcarExecutado(nome, itensDoNo = [{ json: {} }]) {
      const execucoes = contexto.execucoes.get(nome) ?? [];
      execucoes.push(itensDoNo);
      contexto.execucoes.set(nome, execucoes);
    },
    contexto,
  };
  const saida = [];
  itens.forEach((item, indice) => {
    const escopo = escopoDoItem(contexto, itens, indice);
    const parametros = avaliarParametro(no.parameters, escopo);
    try {
      const resposta = servico(parametros, item.json, ctx);
      if (no.type === TIPO.redis && parametros.operation === 'get') {
        saida.push({ json: { [parametros.propertyName]: copiar(resposta ?? null) } });
      } else if (no.type === TIPO.redis) {
        saida.push({ json: copiar(item.json) });
      } else if (Array.isArray(resposta)) {
        if (resposta.length === 0 && no.alwaysOutputData) saida.push({ json: {} });
        for (const linha of resposta) saida.push({ json: copiar(linha) });
      } else {
        saida.push({ json: copiar(resposta ?? {}) });
      }
    } catch (erro) {
      if (no.onError !== 'continueRegularOutput') throw erro;
      if (erro.noInteiro === true) saida.push({ json: copiar(item.json) });
      else saida.push({ json: { error: { message: erro.message } } });
    }
  });
  return [saida];
}

export function erroNoInteiro(mensagem) {
  const erro = new Error(mensagem);
  erro.noInteiro = true;
  return erro;
}

export function simularFluxo(fluxo, { entrada, entradas, servicos = {}, maxPassos = 3000, gatilho = null }) {
  const porNome = new Map(fluxo.nodes.map((no) => [no.name, no]));
  const noGatilho = gatilho
    ? porNome.get(gatilho)
    : fluxo.nodes.find((no) => no.type === TIPO.gatilhoSubFluxo);
  if (!noGatilho) throw new Error(`simulador: gatilho não encontrado (${gatilho ?? 'executeWorkflowTrigger'})`);

  const itensIniciais = (entradas ?? [entrada]).map((json) => ({ json: copiar(json ?? {}) }));
  const contexto = criarContexto();
  const pilha = [{ nome: noGatilho.name, itens: itensIniciais }];
  let ultimaSaida = null;
  let passos = 0;

  while (pilha.length > 0) {
    passos += 1;
    if (passos > maxPassos) throw new Error('simulador: passos demais (laço sem fim?)');
    const { nome, itens } = pilha.pop();
    const no = porNome.get(nome);
    if (!no) throw new Error(`simulador: conexão para nó inexistente "${nome}"`);

    let saidas;
    if (GATILHOS.has(no.type) || no.type === TIPO.wait) saidas = [itens];
    else if (no.type === TIPO.code) saidas = [rodarCode(no, itens, contexto)];
    else if (no.type === TIPO.if) saidas = rodarIf(no, itens, contexto);
    else if (no.type === TIPO.switch) saidas = rodarSwitch(no, itens, contexto);
    else if (no.type === TIPO.set) saidas = [rodarSet(no, itens, contexto)];
    else if (no.type === TIPO.splitOut) saidas = [rodarSplitOut(no, itens)];
    else if (no.type === TIPO.lote) saidas = rodarLote(no, itens, contexto);
    else if (EXTERNOS.has(no.type)) saidas = rodarExterno(no, itens, contexto, servicos);
    else throw new Error(`simulador: tipo de nó não suportado "${no.type}"`);

    const itensDoNo = saidas.flat();
    const execucoes = contexto.execucoes.get(nome) ?? [];
    execucoes.push(no.type === TIPO.if || no.type === TIPO.switch || no.type === TIPO.lote ? itensDoNo : saidas[0]);
    contexto.execucoes.set(nome, execucoes);
    contexto.ordem.push(nome);
    ultimaSaida = itensDoNo;

    const conexoes = fluxo.connections[nome]?.main ?? [];
    // Empilha em ordem reversa para rodar a saída 0 antes da 1 (ordem v1).
    for (let indiceSaida = conexoes.length - 1; indiceSaida >= 0; indiceSaida -= 1) {
      const itensDaSaida = saidas[indiceSaida] ?? [];
      if (itensDaSaida.length === 0) continue;
      for (const destino of [...(conexoes[indiceSaida] ?? [])].reverse()) {
        pilha.push({ nome: destino.node, itens: itensDaSaida });
      }
    }
  }

  return {
    saida: ultimaSaida?.map((item) => item.json) ?? [],
    ordem: contexto.ordem,
    contexto,
    rodou: (nome) => contexto.ordem.includes(nome),
    vezes: (nome) => contexto.ordem.filter((n) => n === nome).length,
    saidaDe: (nome) => {
      const execucoes = contexto.execucoes.get(nome) ?? [];
      return (execucoes[execucoes.length - 1] ?? []).map((item) => item.json);
    },
  };
}
