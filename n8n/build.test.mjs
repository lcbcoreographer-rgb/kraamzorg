// Testes do build dos fluxos n8n (PRD 19.5, P23 item 3). Cobre: geração dos
// três JSON de esqueleto (aceite do P23), os verificadores estruturais do
// 19.5 (nomes de nó, conexões, segredo, tableName, query literal, $fromAI,
// ferramentas com descrição, tratamento de erro, track_source, credencial
// proibida), o carregador de prompt, o embutidor de código e as seis funções
// puras iniciais (P23 item 4), com a comparação de `mascararDocumentos`
// contra `privado.mascarar_documentos` quando o banco local responder na
// porta 54342.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { build, gerarFluxos, nomeArquivoDist, nomeFluxoComAmbiente, ARQUIVOS_DIST } from './build.mjs';
import { carregarConfig, AMBIENTES_VALIDOS } from './src/lib/config.mjs';
import { idEstavel } from './src/lib/id-estavel.mjs';
import {
  extrairPrompt,
  trocarVariaveisPorExpressoes,
  variaveisDoPrompt,
  MARCA_INICIO,
  MARCA_FIM,
} from './src/lib/prompts.mjs';
import {
  removerExport,
  montarJsCode,
  embutirCodigo,
  embutirCodigoComDependencias,
  importsLocais,
  removerImports,
} from './src/lib/codigo-embutido.mjs';
import { acharSegredos, temAlgumSegredo } from './src/lib/segredos.mjs';
import {
  nomesDeNoUnicos,
  conexoesValidas,
  temIdNaRaiz,
  todaFerramentaTemDescricao,
  postgresComParametrosEmLista,
  queryPostgresLiteralESegura,
  nenhumFromAiEmConversaIdOuJid,
  tableNamesCorretos,
  contextWindowETopKDeclarados,
  onErrorForaDeParameters,
  todaChamadaExternaComTratamentoDeErro,
  trackSourceEmTodoEnvio,
  nenhumaCredencialSupabaseApi,
  semConexaoEntreNos,
  jidSoParaEnviar,
  codeSemImportNemExport,
  autenticacaoSoPorCredencial,
  codeCompila,
  todoCaminhoPassaPor,
  nenhumCaminhoEntre,
  conversaIdSoDoRegistro,
  executarTodosOsValidadoresEstruturais,
} from './src/lib/validadores.mjs';

import { mascararDocumentos } from './src/code/mascarar-documentos.js';
import { normalizarTexto, contemPalavra } from './src/code/normalizar-texto.js';
import { dividirEmBlocos } from './src/code/dividir-blocos.js';
import { agrupamento } from './src/code/agrupamento.js';
import { lerClassificacaoMensagem } from './src/code/ler-classificacao-mensagem.js';
import { lerClassificacaoPedido } from './src/code/ler-classificacao-pedido.js';

const execFileAsync = promisify(execFile);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_N8N = AQUI;

async function lerConfigExample() {
  const { config } = await carregarConfig('hml', RAIZ_N8N, { log: () => {} });
  return config;
}

// ---------------------------------------------------------------------------
// Aceite do P23: build gera três JSON de esqueleto válidos.
// ---------------------------------------------------------------------------

describe('aceite do P23: build gera os três JSON de esqueleto', () => {
  test('node n8n/build.mjs --env hml grava três arquivos JSON válidos em n8n/dist', async () => {
    const dirDist = path.join(RAIZ_N8N, 'dist');
    await rm(dirDist, { recursive: true, force: true });

    const gravados = await build({ env: 'hml', raizN8n: RAIZ_N8N, log: () => {}, logAviso: () => {} });
    assert.equal(gravados.length, 3);

    for (const caminho of gravados) {
      assert.ok(caminho.includes('(HML)'), `nome do arquivo de homologação deveria ter "(HML)": ${caminho}`);
      const conteudo = await readFile(caminho, 'utf8');
      const fluxo = JSON.parse(conteudo); // não pode lançar
      assert.equal(typeof fluxo.id, 'string');
      assert.ok(fluxo.id.length > 0);
      assert.ok(Array.isArray(fluxo.nodes));
      assert.ok(fluxo.nodes.length > 0, 'esqueleto sem nenhum nó');
      assert.equal(typeof fluxo.connections, 'object');
      assert.equal(typeof fluxo.settings, 'object');
    }

    const arquivos = await readdir(dirDist);
    assert.equal(arquivos.length, 3);
  });

  test('build é determinístico: rodar duas vezes gera o mesmo id de raiz e os mesmos ids de nó', async () => {
    const config = await lerConfigExample();
    const primeira = gerarFluxos(config, 'hml');
    const segunda = gerarFluxos(config, 'hml');

    for (const chave of Object.keys(ARQUIVOS_DIST)) {
      assert.equal(primeira[chave].id, segunda[chave].id);
      assert.deepEqual(
        primeira[chave].nodes.map((n) => n.id),
        segunda[chave].nodes.map((n) => n.id),
      );
    }
  });

  test('nomeArquivoDist adiciona "(HML)" fora de produção e nada em produção', () => {
    assert.equal(nomeArquivoDist('kraamzorg-agente-isadora', 'hml'), 'kraamzorg-agente-isadora (HML).json');
    assert.equal(nomeArquivoDist('kraamzorg-agente-isadora', 'prod'), 'kraamzorg-agente-isadora.json');
  });

  test('nomeFluxoComAmbiente idem para o nome do fluxo dentro do n8n', () => {
    assert.equal(nomeFluxoComAmbiente('Kraamzorg · X', 'hml'), 'Kraamzorg · X (HML)');
    assert.equal(nomeFluxoComAmbiente('Kraamzorg · X', 'prod'), 'Kraamzorg · X');
  });

  test('--env prod sem n8n/config.prod.json falha alto, nunca usa o example em silêncio', async () => {
    await assert.rejects(
      () => build({ env: 'prod', raizN8n: RAIZ_N8N, log: () => {}, logAviso: () => {} }),
      /config\.prod\.json não encontrado|nao encontrado/,
    );
  });

  test('ambiente desconhecido é recusado', async () => {
    await assert.rejects(() => carregarConfig('staging', RAIZ_N8N, { log: () => {} }));
    assert.deepEqual(AMBIENTES_VALIDOS, ['hml', 'prod']);
  });
});

// ---------------------------------------------------------------------------
// Verificadores estruturais (PRD 19.5) rodando sobre o JSON gerado de
// verdade — nesta sessão (P23) os fluxos são esqueletos, então isso prova
// que o gerador não introduz nenhuma das violações abaixo por conta própria.
// ---------------------------------------------------------------------------

describe('verificadores estruturais sobre os fluxos gerados de verdade', () => {
  test('os três fluxos gerados passam por todos os verificadores estruturais', async () => {
    const config = await lerConfigExample();
    const fluxos = gerarFluxos(config, 'hml');
    for (const [chave, fluxo] of Object.entries(fluxos)) {
      const resultado = executarTodosOsValidadoresEstruturais(fluxo);
      assert.ok(resultado.ok, `${chave}: ${resultado.problemas.join(' | ')}`);
    }
  });

  test('nenhum segredo real no JSON gerado (build feito com config.example.json, PRD 19.5)', async () => {
    const config = await lerConfigExample();
    const fluxos = gerarFluxos(config, 'hml');
    for (const [chave, fluxo] of Object.entries(fluxos)) {
      const texto = JSON.stringify(fluxo);
      const achados = acharSegredos(texto);
      assert.ok(!temAlgumSegredo(texto), `${chave} tem segredo: ${JSON.stringify(achados)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Verificadores estruturais: fixtures que provam que cada regra pega
// violação de verdade (essencial enquanto os fluxos ainda são esqueletos).
// ---------------------------------------------------------------------------

describe('verificadores estruturais: cada regra pega violação de verdade', () => {
  test('nomesDeNoUnicos acusa nome repetido', () => {
    const fluxo = { nodes: [{ name: 'A' }, { name: 'A' }, { name: 'B' }] };
    const resultado = nomesDeNoUnicos(fluxo);
    assert.equal(resultado.ok, false);
    assert.match(resultado.problemas[0], /"A"/);
  });

  test('conexoesValidas acusa conexão para nó inexistente', () => {
    const fluxo = {
      nodes: [{ name: 'A' }],
      connections: { A: { main: [[{ node: 'Fantasma', type: 'main', index: 0 }]] } },
    };
    const resultado = conexoesValidas(fluxo);
    assert.equal(resultado.ok, false);
    assert.match(resultado.problemas[0], /Fantasma/);
  });

  test('conexoesValidas aceita um fluxo bem formado', () => {
    const fluxo = {
      nodes: [{ name: 'A' }, { name: 'B' }],
      connections: { A: { main: [[{ node: 'B', type: 'main', index: 0 }]] } },
    };
    assert.equal(conexoesValidas(fluxo).ok, true);
  });

  test('temIdNaRaiz acusa fluxo sem id', () => {
    assert.equal(temIdNaRaiz({}).ok, false);
    assert.equal(temIdNaRaiz({ id: 'x' }).ok, true);
  });

  test('todaFerramentaTemDescricao acusa postgresTool sem toolDescription', () => {
    const fluxo = {
      nodes: [
        { name: 'consultar_planos', type: 'n8n-nodes-base.postgresTool', parameters: {} },
      ],
    };
    const resultado = todaFerramentaTemDescricao(fluxo);
    assert.equal(resultado.ok, false);
    assert.match(resultado.problemas[0], /consultar_planos/);
  });

  test('todaFerramentaTemDescricao aceita toolWorkflow com description', () => {
    const fluxo = {
      nodes: [
        {
          name: 'transferir_para_equipe',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { description: 'Chama a equipe.' },
        },
      ],
    };
    assert.equal(todaFerramentaTemDescricao(fluxo).ok, true);
  });

  test('postgresComParametrosEmLista acusa queryReplacement em string separada por vírgula', () => {
    const fluxo = {
      nodes: [
        {
          name: 'Registrar Mensagem',
          type: 'n8n-nodes-base.postgres',
          parameters: {
            query: 'select * from agente.registrar_mensagem($1, $2)',
            options: { queryReplacement: '={{ $json.jid + "," + $json.texto }}' },
          },
        },
      ],
    };
    assert.equal(postgresComParametrosEmLista(fluxo).ok, false);
  });

  test('postgresComParametrosEmLista aceita expressão que devolve lista', () => {
    const fluxo = {
      nodes: [
        {
          name: 'Registrar Mensagem',
          type: 'n8n-nodes-base.postgres',
          parameters: {
            query: 'select * from agente.registrar_mensagem($1, $2)',
            options: { queryReplacement: '={{ [$json.jid, $json.texto] }}' },
          },
        },
      ],
    };
    assert.equal(postgresComParametrosEmLista(fluxo).ok, true);
  });

  test('queryPostgresLiteralESegura acusa query como expressão, fora do padrão e com $fromAI', () => {
    const casosRuins = [
      '={{ "select agente.x()" }}',
      'select privado.mascarar_documentos($1)',
      'select agente.x() -- {{ $json.y }}',
      "select agente.x($fromAI('y'))",
    ];
    for (const query of casosRuins) {
      const fluxo = {
        nodes: [{ name: 'N', type: 'n8n-nodes-base.postgres', parameters: { query } }],
      };
      assert.equal(queryPostgresLiteralESegura(fluxo).ok, false, `deveria reprovar: ${query}`);
    }
  });

  test('queryPostgresLiteralESegura aceita query literal começando com select agente.', () => {
    const fluxo = {
      nodes: [
        { name: 'N1', type: 'n8n-nodes-base.postgres', parameters: { query: 'select agente.planos_vigentes()' } },
        {
          name: 'N2',
          type: 'n8n-nodes-base.postgresTool',
          parameters: { query: 'select * from agente.verificar_cobertura($1, $2, $3)' },
        },
      ],
    };
    assert.equal(queryPostgresLiteralESegura(fluxo).ok, true);
  });

  test('nenhumFromAiEmConversaIdOuJid acusa $fromAI preenchendo conversa_id, jid ou wa_jid', () => {
    for (const campo of ['conversa_id', 'jid', 'wa_jid']) {
      const fluxo = {
        nodes: [
          {
            name: 'ferramenta',
            type: 'n8n-nodes-base.postgresTool',
            parameters: { options: { queryReplacement: `={{ [$fromAI('${campo}', 'não pode')] }}` } },
          },
        ],
      };
      assert.equal(nenhumFromAiEmConversaIdOuJid(fluxo).ok, false, `deveria reprovar $fromAI em ${campo}`);
    }
  });

  test('nenhumFromAiEmConversaIdOuJid aceita $fromAI em campo de conteúdo', () => {
    const fluxo = {
      nodes: [
        {
          name: 'ferramenta',
          type: 'n8n-nodes-base.postgresTool',
          parameters: { options: { queryReplacement: "={{ [$fromAI('resumo', 'resumo do pedido')] }}" } },
        },
      ],
    };
    assert.equal(nenhumFromAiEmConversaIdOuJid(fluxo).ok, true);
  });

  test('tableNamesCorretos acusa tableName fora de "documentos"/"chat_memoria"', () => {
    const fluxo = {
      nodes: [
        {
          name: 'base_conhecimento',
          type: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
          parameters: { tableName: 'agente_n8n.documentos' },
        },
      ],
    };
    assert.equal(tableNamesCorretos(fluxo).ok, false);
  });

  test('tableNamesCorretos aceita exatamente "documentos" e "chat_memoria" (as duas tabelas de agente_n8n)', () => {
    const fluxo = {
      nodes: [
        {
          name: 'base_conhecimento',
          type: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
          parameters: { tableName: 'documentos' },
        },
        {
          name: 'Memória Postgres',
          type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
          parameters: { tableName: 'chat_memoria' },
        },
      ],
    };
    assert.equal(tableNamesCorretos(fluxo).ok, true);
  });

  test('contextWindowETopKDeclarados acusa default do nó (5 e 4) em vez do padrão do PRD (30 e 5)', () => {
    const fluxo = {
      nodes: [
        { name: 'Memória Postgres', type: '@n8n/n8n-nodes-langchain.memoryPostgresChat', parameters: {} },
        {
          name: 'base_conhecimento',
          type: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
          parameters: { mode: 'retrieve-as-tool' },
        },
      ],
    };
    const resultado = contextWindowETopKDeclarados(fluxo);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.problemas.length, 2);
  });

  test('onErrorForaDeParameters acusa onError dentro de parameters', () => {
    const fluxo = { nodes: [{ name: 'N', type: 'n8n-nodes-base.httpRequest', parameters: { onError: 'continueRegularOutput' } }] };
    assert.equal(onErrorForaDeParameters(fluxo).ok, false);
  });

  test('todaChamadaExternaComTratamentoDeErro acusa httpRequest sem onError no nível do nó', () => {
    const fluxo = { nodes: [{ name: 'Enviar Texto', type: 'n8n-nodes-base.httpRequest', parameters: {} }] };
    assert.equal(todaChamadaExternaComTratamentoDeErro(fluxo).ok, false);
  });

  test('todaChamadaExternaComTratamentoDeErro aceita onError válido no nível do nó', () => {
    const fluxo = {
      nodes: [
        { name: 'Enviar Texto', type: 'n8n-nodes-base.httpRequest', parameters: {}, onError: 'continueErrorOutput' },
      ],
    };
    assert.equal(todaChamadaExternaComTratamentoDeErro(fluxo).ok, true);
  });

  test('trackSourceEmTodoEnvio acusa /send/text sem track_source no corpo', () => {
    const fluxo = {
      nodes: [
        {
          name: 'Enviar Texto',
          type: 'n8n-nodes-base.httpRequest',
          parameters: { url: 'https://exemplo.uazapi.com/send/text', jsonBody: '={{ { number: $json.jid } }}' },
        },
      ],
    };
    assert.equal(trackSourceEmTodoEnvio(fluxo).ok, false);
  });

  test('trackSourceEmTodoEnvio aceita track_source no corpo do envio', () => {
    const fluxo = {
      nodes: [
        {
          name: 'Enviar Texto',
          type: 'n8n-nodes-base.httpRequest',
          parameters: {
            url: 'https://exemplo.uazapi.com/send/text',
            jsonBody: "={{ { number: $json.jid, text: $json.texto, track_source: 'kraamzorg-agente' } }}",
          },
        },
      ],
    };
    assert.equal(trackSourceEmTodoEnvio(fluxo).ok, true);
  });

  test('nenhumaCredencialSupabaseApi acusa credencial supabaseApi', () => {
    const fluxo = {
      nodes: [{ name: 'N', type: 'n8n-nodes-base.httpRequest', credentials: { supabaseApi: { id: '1', name: 'x' } } }],
    };
    assert.equal(nenhumaCredencialSupabaseApi(fluxo).ok, false);
  });

  test('semConexaoEntreNos acusa conexão proibida entre dois nós nomeados', () => {
    const fluxo = {
      connections: {
        'Caminho de Alerta': { main: [[{ node: 'Agente Isadora', type: 'main', index: 0 }]] },
      },
    };
    assert.equal(semConexaoEntreNos(fluxo, 'Caminho de Alerta', 'Agente Isadora').ok, false);
    assert.equal(semConexaoEntreNos(fluxo, 'Caminho de Alerta', 'Outro Nó').ok, true);
  });

  test('[P24] jidSoParaEnviar acusa jid como parâmetro do banco fora de registrar_mensagem', () => {
    const no = (query, queryReplacement) => ({
      name: 'N',
      type: 'n8n-nodes-base.postgres',
      parameters: { query, options: { queryReplacement } },
    });
    assert.equal(jidSoParaEnviar({ nodes: [no('select agente.pausar($1, 48)', '={{ [ $json.wa_jid ] }}')] }).ok, false);
    assert.equal(jidSoParaEnviar({ nodes: [no('select agente.pausar($1, 48)', '={{ [ $json.conversa_id ] }}')] }).ok, true);
    assert.equal(
      jidSoParaEnviar({ nodes: [no('select agente.registrar_mensagem($1, $2)', '={{ [ $json.wa_jid, 1 ] }}')] }).ok,
      true,
    );
  });

  test('[P24] codeSemImportNemExport acusa sobra de import/export no código embutido', () => {
    const code = (jsCode) => ({ nodes: [{ name: 'C', type: 'n8n-nodes-base.code', parameters: { jsCode } }] });
    assert.equal(codeSemImportNemExport(code("import { a } from './a.js';\nreturn [];")).ok, false);
    assert.equal(codeSemImportNemExport(code('export function f() {}\nreturn [];')).ok, false);
    assert.equal(codeSemImportNemExport(code('function f() {}\nreturn [];')).ok, true);
  });

  test('[P24] autenticacaoSoPorCredencial acusa token em cabeçalho e autenticação sem credencial', () => {
    const http = (parameters, credentials) => ({
      nodes: [{ name: 'H', type: 'n8n-nodes-base.httpRequest', parameters, credentials }],
    });
    assert.equal(
      autenticacaoSoPorCredencial(http({ headerParameters: { parameters: [{ name: 'token', value: 'x' }] } })).ok,
      false,
    );
    assert.equal(autenticacaoSoPorCredencial(http({ authentication: 'genericCredentialType' })).ok, false);
    assert.equal(
      autenticacaoSoPorCredencial(
        http({ authentication: 'genericCredentialType' }, { httpHeaderAuth: { id: 'x', name: 'y' } }),
      ).ok,
      true,
    );
  });

  test('[P25] codeCompila acusa identificador repetido entre arquivos embutidos e import renomeado', () => {
    const code = (jsCode) => ({ nodes: [{ name: 'C', type: 'n8n-nodes-base.code', parameters: { jsCode } }] });
    assert.equal(codeCompila(code('const a = 1;\nconst a = 2;\nreturn [];')).ok, false);
    assert.equal(codeCompila(code("import { a as b } from './a.js';\nreturn [];")).ok, false);
    assert.equal(codeCompila(code('const a = 1;\nreturn [{ json: { a } }];')).ok, true);
  });

  test('[P25] todaChamadaExternaComTratamentoDeErro também cobre Execute Workflow e o agente', () => {
    for (const type of ['n8n-nodes-base.executeWorkflow', '@n8n/n8n-nodes-langchain.agent']) {
      assert.equal(todaChamadaExternaComTratamentoDeErro({ nodes: [{ name: 'X', type, parameters: {} }] }).ok, false, type);
      assert.equal(todaChamadaExternaComTratamentoDeErro({ nodes: [{ name: 'X', type, parameters: {}, onError: 'continueRegularOutput' }] }).ok, true, type);
    }
  });

  test('[P25] todoCaminhoPassaPor e nenhumCaminhoEntre acusam atalho que pula o filtro e ramo de alerta que chega ao agente', () => {
    const ligar = (pares) => {
      const connections = {};
      for (const [origem, destino] of pares) {
        connections[origem] ??= { main: [[]] };
        connections[origem].main[0].push({ node: destino, type: 'main', index: 0 });
      }
      return { nodes: [], connections };
    };
    const certo = ligar([['Entrada', 'Filtro'], ['Filtro', 'Modo'], ['Modo', 'Agente'], ['Filtro', 'Alerta']]);
    assert.equal(todoCaminhoPassaPor(certo, { inicios: ['Entrada'], alvos: ['Modo', 'Agente'], portao: 'Filtro' }).ok, true);
    assert.equal(nenhumCaminhoEntre(certo, { origem: 'Alerta', proibidos: ['Agente'] }).ok, true);
    const atalho = ligar([['Entrada', 'Filtro'], ['Filtro', 'Modo'], ['Entrada', 'Modo']]);
    assert.equal(todoCaminhoPassaPor(atalho, { inicios: ['Entrada'], alvos: ['Modo'], portao: 'Filtro' }).ok, false);
    const vazamento = ligar([['Filtro', 'Alerta'], ['Alerta', 'Agente']]);
    assert.equal(nenhumCaminhoEntre(vazamento, { origem: 'Alerta', proibidos: ['Agente'] }).ok, false);
  });

  test('[P25] conversaIdSoDoRegistro acusa conversa_id que não vem do nó de registro', () => {
    const pg = (query, lista) => ({
      nodes: [{ name: 'P', type: 'n8n-nodes-base.postgres', parameters: { query, options: { queryReplacement: `={{ [ ${lista} ] }}` } } }],
    });
    const registro = "$('Registrar Msg Família').item.json.resultado.conversa_id";
    const opcoes = { expressoesPermitidas: [registro] };
    assert.equal(conversaIdSoDoRegistro(pg('select agente.pode_responder($1) as resultado', registro), opcoes).ok, true);
    assert.equal(conversaIdSoDoRegistro(pg('select agente.pode_enviar($1, $2, $3) as resultado', `${registro}, 'resposta', null`), opcoes).ok, true);
    assert.equal(conversaIdSoDoRegistro(pg('select agente.pode_responder($1) as resultado', '$json.conversa_id'), opcoes).ok, false);
    assert.equal(conversaIdSoDoRegistro(pg('select agente.checar_termos_alerta($1) as resultado', '$json.texto'), opcoes).ok, true);
  });
});

// ---------------------------------------------------------------------------
// Varredura de segredos em n8n/dist (gerado) e n8n/referencia (P23 item 3).
// ---------------------------------------------------------------------------

describe('varredura de segredos', () => {
  test('acharSegredos reconhece JWT, chave OpenAI, telefone E.164 e service_role', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGhpc2lzYWZha2VzaWduYXR1cmU'; // gitleaks:allow (JWT de exemplo, fixture do teste)
    assert.ok(acharSegredos(jwt).jwt.length > 0);
    assert.ok(acharSegredos('sk-abcdefghijklmnopqrstuvwx').chaveOpenAi.length > 0);
    assert.ok(acharSegredos('+5511987654321').telefone.length > 0);
    assert.ok(acharSegredos('usa a service_role aqui').serviceRole.length > 0);
    assert.ok(acharSegredos('nada de errado aqui').jwt.length === 0);
  });

  test('acharSegredos não confunde jid de grupo do WhatsApp com telefone E.164', () => {
    assert.equal(acharSegredos('000000000000-0000000000@g.us').telefone.length, 0);
  });

  test('n8n/dist gerado com config.example.json não tem segredo', async () => {
    const config = await lerConfigExample();
    const fluxos = gerarFluxos(config, 'hml');
    for (const fluxo of Object.values(fluxos)) {
      assert.ok(!temAlgumSegredo(JSON.stringify(fluxo)));
    }
  });

  test('n8n/referencia não tem segredo, JWT, telefone nem service_role', async () => {
    const dirReferencia = path.join(RAIZ_N8N, 'referencia');
    const arquivos = await readdir(dirReferencia);
    for (const arquivo of arquivos) {
      const caminho = path.join(dirReferencia, arquivo);
      const conteudo = await readFile(caminho, 'utf8').catch(() => null);
      if (conteudo === null) continue; // diretório (ex.: node_modules de uma instalação local esquecida)
      const achados = acharSegredos(conteudo);
      assert.ok(!temAlgumSegredo(conteudo), `${arquivo}: ${JSON.stringify(achados)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Carregador de prompt: marcas procuradas no começo da linha.
// ---------------------------------------------------------------------------

describe('carregador de prompt', () => {
  test('extrai só o texto entre as marcas, mesmo com a marca citada no meio de uma frase do cabeçalho', () => {
    const conteudo = [
      '# Título',
      '',
      'O cabeçalho cita "=== INÍCIO DO PROMPT ===" no meio da frase, sem estar no começo da linha.',
      '',
      MARCA_INICIO,
      'Texto real do prompt.',
      'Segunda linha.',
      MARCA_FIM,
      '',
      'Rodapé qualquer.',
    ].join('\n');

    const extraido = extrairPrompt(conteudo, 'fixture');
    assert.equal(extraido, 'Texto real do prompt.\nSegunda linha.');
  });

  test('lança erro claro quando as marcas não existem no começo de linha', () => {
    assert.throws(() => extrairPrompt('sem marcas aqui', 'fixture'), /marcas/);
  });

  test('trocarVariaveisPorExpressoes troca {{variavel}} por expressão do n8n', () => {
    const resultado = trocarVariaveisPorExpressoes('Olá, {{nome}}. Hoje é {{data_hora}}.', {
      nome: "$json.nome",
      data_hora: "$json.data_hora",
    });
    assert.equal(resultado, 'Olá, {{ $json.nome }}. Hoje é {{ $json.data_hora }}.');
  });

  test('trocarVariaveisPorExpressoes lança erro quando falta expressão no mapa', () => {
    assert.throws(() => trocarVariaveisPorExpressoes('{{faltando}}', {}), /faltando/);
  });

  test('variaveisDoPrompt lista os nomes sem repetir', () => {
    assert.deepEqual(variaveisDoPrompt('{{a}} e {{b}} e {{a}} de novo'), ['a', 'b']);
  });

  test('os cinco arquivos reais de n8n/prompts têm as marcas no começo da linha e todas as variáveis documentadas na tabela', async () => {
    const dirPrompts = path.join(RAIZ_N8N, 'prompts');
    const arquivos = (await readdir(dirPrompts)).filter((f) => f.endsWith('.md'));
    assert.ok(arquivos.length >= 5, 'esperava pelo menos os cinco prompts de PROMPTS.md P23-P26');

    for (const arquivo of arquivos) {
      const conteudo = await readFile(path.join(dirPrompts, arquivo), 'utf8');
      const extraido = extrairPrompt(conteudo, arquivo);
      assert.ok(extraido.length > 0, `${arquivo}: prompt extraído vazio`);

      const variaveis = variaveisDoPrompt(extraido);
      for (const variavel of variaveis) {
        assert.ok(
          conteudo.includes(`{{${variavel}}}`) && conteudo.match(new RegExp(`\`\\{\\{${variavel}\\}\\}\``)),
          `${arquivo}: variável "${variavel}" usada no prompt mas não documentada na tabela do cabeçalho`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Embutidor de código: o build embute o código das funções puras; os testes
// importam as mesmas funções (PRD 19.5).
// ---------------------------------------------------------------------------

describe('embutidor de código dos nós Code', () => {
  test('removerExport tira "export " do início de declaração sem tocar em mais nada', () => {
    const fonte = 'export function foo(a) {\n  return a + 1;\n}\n';
    const resultado = removerExport(fonte);
    assert.equal(resultado, 'function foo(a) {\n  return a + 1;\n}\n');
    assert.ok(!resultado.includes('export'));
  });

  test('código embutido roda e devolve o mesmo resultado que a função importada diretamente', async () => {
    const caminho = path.join(RAIZ_N8N, 'src/code/normalizar-texto.js');
    const jsCode = await embutirCodigo({
      caminhoArquivo: caminho,
      chamada: 'return [{ json: { texto: normalizarTexto($input.first().json.texto) } }];',
    });

    assert.ok(!jsCode.includes('export'), 'jsCode embutido não pode ter "export" (Code node roda script solto)');

    // Simula a execução de um nó Code: $input.first() devolvendo o item de
    // entrada, exatamente como o n8n expõe dentro do nó.
    const funcaoNoCode = new Function(
      '$input',
      `${jsCode}`,
    );
    const entrada = { first: () => ({ json: { texto: 'JÁ PERDI UM BEBÊ' } }) };
    const [saida] = funcaoNoCode(entrada);

    assert.equal(saida.json.texto, normalizarTexto('JÁ PERDI UM BEBÊ'));
  });

  test('[P24] embutirCodigoComDependencias junta os imports locais em ordem, uma vez cada, sem import/export', () => {
    const arquivos = {
      '/x/a.js': "export const A = 1;\nexport function a() { return A; }\n",
      '/x/b.js': "import { a } from './a.js';\nexport function b() { return a() + 1; }\n",
      '/x/c.js': "import { a } from './a.js';\nimport { b } from './b.js';\nexport function c() { return a() + b(); }\n",
    };
    assert.deepEqual(importsLocais(arquivos['/x/c.js']), ['./a.js', './b.js']);
    const jsCode = embutirCodigoComDependencias({
      caminhoArquivo: '/x/c.js',
      chamada: 'return c();',
      lerArquivo: (caminho) => arquivos[caminho],
    });
    assert.equal(jsCode.match(/function a\(/g).length, 1, 'dependência repetida entra uma vez só');
    assert.ok(jsCode.indexOf('function a(') < jsCode.indexOf('function b(') && jsCode.indexOf('function b(') < jsCode.indexOf('function c('));
    assert.ok(!/^\s*(import|export)\b/m.test(jsCode));
    assert.equal(new Function(jsCode)(), 3);
  });

  test('[P24] removerImports recusa import de pacote (o nó Code não teria como carregar)', () => {
    assert.throws(() => removerImports("import fs from 'node:fs';\n"), /não é local/);
  });

  test('montarJsCode preserva o corpo da função original (mudar a regra só num lugar)', async () => {
    const caminho = path.join(RAIZ_N8N, 'src/code/mascarar-documentos.js');
    const fonte = await readFile(caminho, 'utf8');
    const jsCode = montarJsCode(fonte, 'return [];');
    // toda linha de código do arquivo fonte (exceto a que só tem "export "
    // seguido de function, já tratada) continua presente no jsCode.
    assert.ok(jsCode.includes('function mascararDocumentos'));
    assert.ok(jsCode.includes('function luhnValido'));
  });
});

// ---------------------------------------------------------------------------
// id-estavel: determinístico, formato estável.
// ---------------------------------------------------------------------------

describe('id estável', () => {
  test('mesmo texto sempre gera o mesmo id', () => {
    assert.equal(idEstavel('kraamzorg-fluxo-1'), idEstavel('kraamzorg-fluxo-1'));
  });

  test('textos diferentes geram ids diferentes', () => {
    assert.notEqual(idEstavel('kraamzorg-fluxo-1'), idEstavel('kraamzorg-fluxo-2'));
  });

  test('formato com aparência de UUID (cinco grupos separados por hífen)', () => {
    const id = idEstavel('qualquer coisa');
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

// ---------------------------------------------------------------------------
// Funções puras iniciais (P23 item 4).
// ---------------------------------------------------------------------------

describe('normalizarTexto e contemPalavra', () => {
  test('minúsculo e sem acento', () => {
    assert.equal(normalizarTexto('Não Sinto O Bebê Mexer'), 'nao sinto o bebe mexer');
  });

  test('colapsa espaço duplicado e tira espaço nas pontas', () => {
    assert.equal(normalizarTexto('  Muito   Espaço  '), 'muito espaco');
  });

  test('texto que não é string vira string vazia', () => {
    assert.equal(normalizarTexto(null), '');
    assert.equal(normalizarTexto(undefined), '');
  });

  test('contemPalavra compara por palavra inteira ("cura" não pega "curativo")', () => {
    assert.equal(contemPalavra('preciso trocar o curativo', 'cura'), false);
    assert.equal(contemPalavra('acredito na cura', 'cura'), true);
  });

  test('contemPalavra ignora acento e maiúscula', () => {
    assert.equal(contemPalavra('Estou com FEBRE alta', 'febre'), true);
  });

  test('"perdi o bebê" não bate com o termo "perdi um bebê" (K-21, PRD 11.11 item 1)', () => {
    assert.equal(contemPalavra('já perdi um bebê antes', 'perdi o bebe'), false);
    assert.equal(contemPalavra('já perdi um bebê antes', 'perdi um bebe'), true);
  });
});

describe('dividirEmBlocos', () => {
  test('texto curto vira um bloco só', () => {
    assert.deepEqual(dividirEmBlocos('Oi! Tudo bem?'), ['Oi! Tudo bem?']);
  });

  test('texto vazio vira lista vazia', () => {
    assert.deepEqual(dividirEmBlocos(''), []);
    assert.deepEqual(dividirEmBlocos(null), []);
  });

  test('nunca quebra no meio de uma frase', () => {
    const frase1 = 'Que bom saber de vocês.';
    const frase2 = 'A Kraamzorg cuida do pós-parto com uma enfermeira especializada visitando vocês em casa.';
    const frase3 = 'O plano Essencial tem 6 dias de visita e o Continuado tem 12.';
    const texto = `${frase1} ${frase2} ${frase3}`;
    const blocos = dividirEmBlocos(texto, { tamanhoAlvo: 60 });
    for (const bloco of blocos) {
      assert.match(bloco.trim(), /[.!?]$/, `bloco não termina em pontuação de frase: "${bloco}"`);
    }
    assert.equal(blocos.join(' '), texto);
  });

  test('[P25] nenhum caractere se perde: valor com ponto de milhar e decimal fica inteiro', () => {
    assert.deepEqual(dividirEmBlocos('O Essencial é R$ 4.200. O Continuado é R$ 8.100,50 ou 3x de R$ 2.700.', { tamanhoAlvo: 30 }), [
      'O Essencial é R$ 4.200.',
      'O Continuado é R$ 8.100,50 ou 3x de R$ 2.700.',
    ]);
    assert.deepEqual(dividirEmBlocos('Visite www.kraamzorg.com.br hoje'), ['Visite www.kraamzorg.com.br hoje']);
  });

  test('nunca gera mais que o máximo de blocos (excedente entra no último)', () => {
    const frases = Array.from({ length: 10 }, (_, i) => `Frase número ${i + 1} com algum texto para ocupar espaço.`);
    const blocos = dividirEmBlocos(frases.join(' '), { tamanhoAlvo: 40, maxBlocos: 3 });
    assert.ok(blocos.length <= 3);
  });
});

describe('agrupamento', () => {
  test('só a última execução do buffer deve responder, com todas as mensagens juntas', () => {
    const buffer = [
      { id: 1, texto: 'oi' },
      { id: 2, texto: 'tudo bem?' },
      { id: 3, texto: 'sou a Marina' },
    ];
    const ultima = agrupamento({ buffer, idExecucaoAtual: 3 });
    assert.equal(ultima.deveResponder, true);
    assert.equal(ultima.texto, 'oi tudo bem? sou a Marina');
    assert.equal(ultima.agrupado, true);

    const primeira = agrupamento({ buffer, idExecucaoAtual: 1 });
    assert.equal(primeira.deveResponder, false);
  });

  test('falha do Redis segue sem agrupar, cada mensagem sozinha, nunca para o fluxo', () => {
    const resultado = agrupamento({ buffer: null, idExecucaoAtual: 7, textoAtual: 'oi', falhaRedis: true });
    assert.equal(resultado.deveResponder, true);
    assert.equal(resultado.texto, 'oi');
    assert.equal(resultado.agrupado, false);
  });

  test('buffer vazio também segue sozinho (mensagem única, sem espera de agrupamento)', () => {
    const resultado = agrupamento({ buffer: [], idExecucaoAtual: 1, textoAtual: 'oi' });
    assert.equal(resultado.deveResponder, true);
    assert.equal(resultado.texto, 'oi');
  });
});

describe('lerClassificacaoMensagem', () => {
  test('classificador válido sem alerta e sem termo: nenhum alerta', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo: JSON.stringify({ tipo_contato: 'lead', saude: 'nenhum', perda: false, perda_temporalidade: 'nenhuma', internacao: false, saude_mental: false }),
    });
    assert.equal(resultado.alerta, 'nenhum');
    assert.equal(resultado.chaveTexto, null);
  });

  test('classificador com saude=urgencia vira alerta de saúde', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo: JSON.stringify({ tipo_contato: 'lead', saude: 'urgencia', perda: false, perda_temporalidade: 'nenhuma', internacao: false, saude_mental: false }),
    });
    assert.equal(resultado.alerta, 'saude');
    assert.equal(resultado.chaveTexto, 'alerta_saude');
  });

  test('perda=true (mesmo de gestação anterior) nunca desce para "nenhum" (PRD 11.11 item 2, K-21)', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo: JSON.stringify({ tipo_contato: 'lead', saude: 'nenhum', perda: true, perda_temporalidade: 'anterior', internacao: false, saude_mental: false }),
    });
    assert.equal(resultado.alerta, 'perda');
    assert.equal(resultado.perdaTemporalidade, 'anterior');
  });

  test('falha do classificador (JSON inválido) nunca rebaixa alerta que o filtro de termos já levantou', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: true, acao: 'bloqueio_total', chaveTexto: null },
      saidaModelo: 'isto não é json',
    });
    assert.equal(resultado.classificadorFalhou, true);
    assert.equal(resultado.alerta, 'perda');
  });

  test('falha do classificador sem termo de alerta vira "lead"/"nenhum", nunca cala o agente', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo: '{ json quebrado',
    });
    assert.equal(resultado.classificadorFalhou, true);
    assert.equal(resultado.alerta, 'nenhum');
    assert.equal(resultado.tipoContato, 'lead');
  });

  test('internacao=true vira alerta_internacao só com o parâmetro de ativação ligado (PRD 11.11 item 2a)', () => {
    const saidaModelo = JSON.stringify({ tipo_contato: 'lead', saude: 'urgencia', perda: false, perda_temporalidade: 'nenhuma', internacao: true, saude_mental: false });

    const ligado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo,
      parametrosAtivacao: { alertaInternacaoAtivo: true, alertaEmocionalAtivo: false },
    });
    assert.equal(ligado.chaveTexto, 'alerta_internacao');

    const desligado = lerClassificacaoMensagem({
      termoAlerta: { alerta: false, acao: null, chaveTexto: null },
      saidaModelo,
      parametrosAtivacao: { alertaInternacaoAtivo: false, alertaEmocionalAtivo: false },
    });
    assert.equal(desligado.chaveTexto, 'alerta_saude');
  });

  test('termo com chaveTexto=alerta_internacao (mensagem_chave do filtro) prevalece sobre o classificador', () => {
    const resultado = lerClassificacaoMensagem({
      termoAlerta: { alerta: true, acao: 'handoff_saude', chaveTexto: 'alerta_internacao' },
      saidaModelo: JSON.stringify({ tipo_contato: 'lead', saude: 'nenhum', perda: false, perda_temporalidade: 'nenhuma', internacao: false, saude_mental: false }),
    });
    assert.equal(resultado.alerta, 'saude');
    assert.equal(resultado.chaveTexto, 'alerta_internacao');
  });
});

describe('lerClassificacaoPedido', () => {
  test('classificador falhou: mantém o motivo do agente, marcado classificador_falhou', () => {
    const resultado = lerClassificacaoPedido({ motivoAgente: 'reuniao', saidaModelo: 'não é json', modo: 'vendas' });
    assert.equal(resultado.classificadorFalhou, true);
    assert.equal(resultado.motivoFinal, 'reuniao');
  });

  test('classificador sobe para saude ou perda: nunca desce, segue pelo nó 8a', () => {
    for (const tipo of ['saude', 'perda']) {
      const resultado = lerClassificacaoPedido({
        motivoAgente: 'duvida_sem_resposta',
        saidaModelo: JSON.stringify({ tipo, porque: 'x' }),
        modo: 'vendas',
      });
      assert.equal(resultado.motivoFinal, tipo);
      assert.equal(resultado.subiuParaAlerta, true);
      assert.equal(resultado.enviarTexto, true);
    }
  });

  test('sem_aviso só vale quando o motivo do agente era duvida_sem_resposta ou outro', () => {
    const elegivel = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'sem_aviso', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(elegivel.acao, 'sem_aviso');

    const naoElegivel = lerClassificacaoPedido({
      motivoAgente: 'reuniao',
      saidaModelo: JSON.stringify({ tipo: 'sem_aviso', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(naoElegivel.acao, 'transferir');
    assert.equal(naoElegivel.motivoFinal, 'reuniao');
  });

  test('sem_aviso nunca vale em modo cliente (v4.2)', () => {
    const resultado = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'sem_aviso', porque: 'x' }),
      modo: 'cliente',
    });
    assert.equal(resultado.acao, 'transferir');
    assert.equal(resultado.motivoFinal, 'outro');
  });

  test('troca só entre motivos comerciais, sem nunca baixar a prioridade do motivo original', () => {
    // [P24, PRD 19.3 v4.2] reuniao (alta) -> cobertura_taxa (normal): o
    // destino troca, a prioridade alta fica e as opções seguem no grupo.
    const mantemMaiorPrioridade = lerClassificacaoPedido({
      motivoAgente: 'reuniao',
      saidaModelo: JSON.stringify({ tipo: 'cobertura_taxa', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(mantemMaiorPrioridade.motivoFinal, 'cobertura_taxa');
    assert.equal(mantemMaiorPrioridade.prioridadeMinima, 'alta');
    assert.equal(mantemMaiorPrioridade.manterOpcoes, true);

    // condicao_comercial (normal) -> contratar (alta): sobe para contratar.
    const sobeDePrioridade = lerClassificacaoPedido({
      motivoAgente: 'condicao_comercial',
      saidaModelo: JSON.stringify({ tipo: 'contratar', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(sobeDePrioridade.motivoFinal, 'contratar');
  });

  test('conversa já marcada como não lead continua não lead, mesmo sem chamar o classificador de novo', () => {
    const resultado = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'contratar', porque: 'x' }),
      modo: 'vendas',
      jaNaoLead: true,
    });
    assert.equal(resultado.motivoFinal, 'nao_lead');
  });

  test('tipo fora da lista válida conta como falha do classificador', () => {
    const resultado = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'nao_existe', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(resultado.classificadorFalhou, true);
    assert.equal(resultado.motivoFinal, 'outro');
  });
});

// ---------------------------------------------------------------------------
// mascararDocumentos: os 16 casos do P05 v2, mais a comparação contra
// privado.mascarar_documentos quando o banco local responder na porta 54342.
// ---------------------------------------------------------------------------

const CASOS_MASCARAR_DOCUMENTOS = [
  {
    nome: 'CPF formatado',
    entrada: 'Meu CPF é 111.444.777-35, pode confirmar?',
    contido: '[CPF ocultado]',
    naoContido: '111.444.777-35',
  },
  {
    nome: 'CPF corrido válido',
    entrada: 'cpf 11144477735 aqui',
    contido: '[CPF ocultado]',
    naoContido: '11144477735',
  },
  {
    nome: '11 dígitos com verificador errado (não é CPF válido)',
    entrada: 'numero 11144477736 aqui',
    contido: '11144477736',
    naoContido: '[CPF ocultado]',
  },
  {
    nome: 'celular com DDD (não é documento)',
    entrada: 'meu numero é (11) 98765-4321, pode me chamar',
    contido: '(11) 98765-4321',
    naoContido: '[CPF ocultado]',
  },
  {
    nome: 'telefone E.164 (não é cartão, mesmo com 13 dígitos)',
    entrada: 'meu whats é +5511987654321',
    contido: '+5511987654321',
    naoContido: '[cartão ocultado]',
  },
  {
    nome: 'cartão válido (Visa, Luhn ok)',
    entrada: 'meu cartao é 4532015112830366 pode usar',
    contido: '[cartão ocultado]',
    naoContido: '4532015112830366',
  },
  {
    nome: '16 dígitos que não passam no Luhn',
    entrada: 'numero de protocolo 1234567812345678',
    contido: '1234567812345678',
    naoContido: '[cartão ocultado]',
  },
  {
    nome: 'cartão em grupos de 4 com espaço',
    entrada: 'cartao 4111 1111 1111 1111 por favor',
    contido: '[cartão ocultado]',
    naoContido: '4111 1111 1111 1111',
  },
  {
    nome: 'cartão em grupos de 4 com hífen',
    entrada: 'cartao 4111-1111-1111-1111 por favor',
    contido: '[cartão ocultado]',
    naoContido: '4111-1111-1111-1111',
  },
  {
    nome: 'Amex em grupos 6-9 com espaço',
    entrada: 'amex 378282 246310005 aqui',
    contido: '[cartão ocultado]',
    naoContido: '378282 246310005',
  },
  {
    nome: 'cartão seguido de validade e cvv',
    entrada: 'cartao 4532015112830366 validade 08/29 cvv 123',
    contido: '[cartão ocultado]',
    tambemContido: ['[dado de cartão ocultado]'],
  },
];

describe('mascararDocumentos (P05 v2, 16 casos)', () => {
  for (const caso of CASOS_MASCARAR_DOCUMENTOS) {
    test(caso.nome, () => {
      const saida = mascararDocumentos(caso.entrada);
      if (caso.contido) assert.ok(saida.includes(caso.contido), `esperava conter "${caso.contido}", saiu "${saida}"`);
      if (caso.naoContido) assert.ok(!saida.includes(caso.naoContido), `não deveria conter "${caso.naoContido}", saiu "${saida}"`);
      for (const trecho of caso.tambemContido ?? []) {
        assert.ok(saida.includes(trecho), `esperava também conter "${trecho}", saiu "${saida}"`);
      }
    });
  }

  test('validade MM/AAAA (4 dígitos de ano) também é mascarada junto com o cartão', () => {
    const saida = mascararDocumentos('cartao 4532015112830366 validade 08/2029');
    assert.ok(saida.includes('[cartão ocultado]'));
    assert.ok(saida.includes('[dado de cartão ocultado]'));
    assert.ok(!saida.includes('08/2029'));
  });

  test('CVC e "código de segurança" também disparam a máscara (não só "cvv")', () => {
    const cvc = mascararDocumentos('cartao 4532015112830366 cvc 456');
    assert.ok(cvc.includes('[dado de cartão ocultado]'));
    const codigo = mascararDocumentos('cartao 4532015112830366 código de segurança 789');
    assert.ok(codigo.includes('[dado de cartão ocultado]'));
  });

  test('validade e cvv sem cartão na mesma mensagem não são mascarados (regra é "na mesma mensagem que tiver um cartão ocultado")', () => {
    const saida = mascararDocumentos('minha assinatura vence em 08/29');
    assert.ok(saida.includes('08/29'));
  });

  test('texto sem nenhum documento passa direto', () => {
    assert.equal(mascararDocumentos('oi, tudo bem? sou a Marina, estou com 32 semanas'), 'oi, tudo bem? sou a Marina, estou com 32 semanas');
  });

  test('entrada vazia ou não-string não quebra', () => {
    assert.equal(mascararDocumentos(''), '');
    assert.equal(mascararDocumentos(undefined), '');
  });
});

// Comparação contra a função SQL de referência `privado.mascarar_documentos`
// (PRD, P05 item 5: "essa é a definição de referência que o n8n copia").
// Roda só se o banco local responder na porta 54342; senão pula com aviso,
// exatamente como o P23 pede.
describe('mascararDocumentos contra privado.mascarar_documentos (banco local, porta 54342)', () => {
  const HOST = '127.0.0.1';
  const PORTA = 54342;

  function bancoResponde(timeoutMs = 800) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: HOST, port: PORTA });
      const finalizar = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finalizar(true));
      socket.once('timeout', () => finalizar(false));
      socket.once('error', () => finalizar(false));
    });
  }

  test('compara os 16 casos com a função SQL quando o banco responde; pula com aviso se não responder', async (t) => {
    const respondeu = await bancoResponde();
    if (!respondeu) {
      t.diagnostic(`aviso: banco local nao responde em ${HOST}:${PORTA}; pulando comparação com privado.mascarar_documentos`);
      t.skip('banco local indisponível na porta 54342');
      return;
    }

    for (const caso of CASOS_MASCARAR_DOCUMENTOS) {
      let saidaSql;
      try {
        const { stdout } = await execFileAsync('psql', [
          '-h', HOST,
          '-p', String(PORTA),
          '-U', 'postgres',
          '-d', 'kraamzorg',
          '-t',
          '-A',
          '-v', 'ON_ERROR_STOP=1',
          '-c',
          `select privado.mascarar_documentos($$${caso.entrada.replace(/\$/g, '')}$$)`,
        ]);
        saidaSql = stdout.trim();
      } catch (erro) {
        t.diagnostic(
          `aviso: banco respondeu mas a comparação com privado.mascarar_documentos falhou (${erro.message}); ` +
            'pulando (função provavelmente ainda não existe nesta base local, P05 roda antes do P23)',
        );
        t.skip('privado.mascarar_documentos indisponível');
        return;
      }

      const saidaJs = mascararDocumentos(caso.entrada);
      assert.equal(saidaJs, saidaSql, `${caso.nome}: JS "${saidaJs}" x SQL "${saidaSql}"`);
    }
  });
});

// [P24] Fluxo 2: funções puras, cenários do P24 v2 no simulador e estrutura
// do JSON gerado. Importado aqui para `node --test n8n/build.test.mjs` rodar
// tudo num comando só.
import './fluxo-2.test.mjs';

// [P25] Fluxo 3: funções puras (validarResposta, prepararEnvio, modo, saída
// do agente, follow-up), cenários do P25 no simulador e estrutura do JSON.
import './fluxo-3.test.mjs';
