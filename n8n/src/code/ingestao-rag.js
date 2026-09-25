// Fluxo 1: Ingestão RAG (PRD 19.2, P26). Funções puras dos nós Code: gera o
// lote, monta os documentos a indexar e confere o resultado da indexação
// antes da troca atômica (promover ou descartar o lote). O build embute
// este arquivo nos nós Code; os testes importam as mesmas funções.
//
// - Nó 4 "Novo Lote": gera `lote_id` (uuid) sem nenhuma chamada externa.
//   `gerarId` é injetável para o teste ser determinístico. O sandbox do nó
//   Code do n8n 2.40.6 (task runner) não expõe `crypto`: `uuidV4` usa
//   `crypto.randomUUID()` quando existe e, senão, monta um uuid v4 com
//   `Math.random()`, suficiente para identificar o lote (não é segredo).
// - Nó 6 "Montar Documentos": anexa `lote_id` a cada linha de
//   `agente.base_para_indexar()` e devolve exatamente os campos que o Data
//   Loader (nó 8a) espera (`tipo`, `fonte_id`, `titulo`, `pagina_pdf`,
//   `lote_id`, `texto`), descarta linha vazia ou sem os campos mínimos e
//   duplicata por `tipo` + `fonte_id`; marca `tem_documento = false` num
//   item único quando não sobra nada, para o nó 7 ("Tem Documento?") ter o
//   que ler (PRD 19.2: "marca _vazio se não houver nada").
// - "Ler Indexação" / "Indexação OK?": o nó 8 (vectorStorePGVector) segue o
//   mesmo padrão do resto do projeto (`onError: continueRegularOutput` e
//   checagem explícita do retorno, em vez do segundo output do n8n, PRD
//   19.1); esta checagem decide entre promover o lote (nó 9) e descartá-lo
//   (nó 11), e carrega a contagem de documentos que o nó 10 registra.
// - "Ler Promoção" / "Promoção OK?": o nó 9 também é conferido; sem `ok` do
//   banco o lote novo é descartado e a execução registra `falhou`, em vez de
//   registrar `ok` com a troca por fazer.
// - "Nada a Indexar": estado terminal do nó 7 quando não há documento
//   aprovado; a base anterior continua valendo, porque nada é tocado.

function textoOuVazio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function uuidV4(aleatorio = Math.random) {
  const cripto = globalThis.crypto;
  if (aleatorio === Math.random && cripto && typeof cripto.randomUUID === 'function') return cripto.randomUUID();
  const bytes = [];
  for (let i = 0; i < 16; i += 1) bytes.push(Math.floor(aleatorio() * 256) & 0xff);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function novoLote(gerarId = () => uuidV4()) {
  return { lote_id: gerarId() };
}

function chaveDocumento(linha) {
  return `${textoOuVazio(linha?.tipo)}:${textoOuVazio(linha?.fonte_id)}`;
}

// Nó 6. `linhas` são as linhas de `select * from agente.base_para_indexar()`
// (uma por documento: item aprovado da base de conhecimento, um documento
// por plano vigente sem valor, um documento por praça com as localidades
// atendidas). Cada linha precisa de `tipo`, `fonte_id` e `texto`; `titulo` e
// `pagina_pdf` podem faltar (só os documentos de plano têm página do PDF).
export function montarDocumentos(loteId, linhas) {
  const lote = textoOuVazio(loteId);
  const vistos = new Set();
  const documentos = [];

  for (const linha of Array.isArray(linhas) ? linhas : []) {
    if (!linha || typeof linha !== 'object' || linha.error) continue;
    const tipo = textoOuVazio(linha.tipo);
    const fonteId = textoOuVazio(linha.fonte_id);
    const texto = textoOuVazio(linha.texto);
    if (!tipo || !fonteId || !texto) continue;
    const chave = chaveDocumento(linha);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    documentos.push({
      tipo,
      fonte_id: fonteId,
      titulo: textoOuVazio(linha.titulo),
      texto,
      pagina_pdf: linha.pagina_pdf ?? null,
      lote_id: lote,
      tem_documento: true,
    });
  }

  if (documentos.length === 0) {
    return [{ lote_id: lote, tem_documento: false }];
  }
  return documentos;
}

// "Ler Indexação": junta a saída do nó 8 num só item de estado para o nó
// "Indexação OK?" decidir. Só conta como indexado o que o n8n devolve de
// verdade quando a inserção dá certo: um item por documento gravado, no
// formato `{ pageContent, metadata }`, com o `lote_id` deste lote na
// metadata. Qualquer outra coisa é falha:
// - `{ error }`: erro por item;
// - o item de ENTRADA repassado sem mudança (tem `texto`, não tem
//   `pageContent`): é o que o n8n 2.40.6 faz com `onError:
//   continueRegularOutput` quando o nó inteiro falha, e o insert do
//   vectorStorePGVector falha sempre inteiro (sem laço com try por item), por
//   exemplo com a OpenAI fora do ar no segundo lote de embeddings. Contar
//   esse caso como sucesso promoveria um lote parcial e apagaria a base
//   anterior, justamente o que o nó 11 do 19.2 existe para evitar.
function documentoIndexado(item, lote) {
  if (!item || typeof item !== 'object' || item.error !== undefined) return false;
  if (typeof item.pageContent !== 'string' || item.pageContent.trim() === '') return false;
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  return metadata !== null && textoOuVazio(metadata.lote_id) === lote;
}

function mensagemDeErro(item) {
  if (!item || typeof item !== 'object') return 'sem resposta do PGVector';
  if (typeof item.error === 'string') return item.error;
  if (item.error && typeof item.error.message === 'string') return item.error.message;
  if (item.error !== undefined) return 'falha sem detalhe';
  return 'o PGVector não confirmou a gravação (nó inteiro falhou ou devolveu documento de outro lote)';
}

export function conferirIndexacao(itens, loteId) {
  const lote = textoOuVazio(loteId);
  const lista = Array.isArray(itens) ? itens : [];
  const primeiroRuim = lista.find((item) => !documentoIndexado(item, lote));
  const indexado = lote !== '' && lista.length > 0 && primeiroRuim === undefined;
  return {
    lote_id: lote,
    indexado,
    total_documentos: lista.length,
    erro: indexado ? null : lista.length === 0 ? 'o PGVector não devolveu nenhum documento' : mensagemDeErro(primeiroRuim),
  };
}

// "Ler Promoção", depois do nó 9. `agente.promover_lote` só vale com `ok`
// verdadeiro no `resultado`; erro por item, item repassado (nó inteiro
// falhou) ou `ok` falso é falha, e o lote novo é descartado (a função roda
// numa transação só, então a base anterior continua inteira).
export function conferirPromocao(estadoIndexacao, resposta) {
  const estado = estadoIndexacao && typeof estadoIndexacao === 'object' ? estadoIndexacao : {};
  let resultado = null;
  if (resposta && typeof resposta === 'object' && resposta.error === undefined) {
    const bruto = resposta.resultado;
    if (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) resultado = bruto;
    else if (typeof bruto === 'string') {
      try {
        resultado = JSON.parse(bruto);
      } catch {
        resultado = null;
      }
    }
  }
  const promovido = resultado !== null && resultado.ok === true;
  let erro = null;
  if (!promovido) {
    if (resposta && typeof resposta === 'object' && resposta.error !== undefined) erro = mensagemDeErro(resposta);
    else if (resultado && typeof resultado.erro === 'string') erro = resultado.erro;
    else erro = 'promover_lote não confirmou a troca do lote';
  }
  return {
    lote_id: textoOuVazio(estado.lote_id),
    total_documentos: Number.isFinite(estado.total_documentos) ? estado.total_documentos : 0,
    promovido,
    erro,
  };
}

// "Falha do Lote": ponto único antes do nó 11, venha a falha da indexação ou
// da promoção. Deixa só o que "Descartar Lote" e "Registrar Falha" leem.
export function falhaDoLote(estado) {
  const origem = estado && typeof estado === 'object' ? estado : {};
  return {
    lote_id: textoOuVazio(origem.lote_id),
    total_documentos: Number.isFinite(origem.total_documentos) ? origem.total_documentos : 0,
    erro: textoOuVazio(origem.erro) || 'falha sem detalhe',
  };
}

// "Nada a Indexar": nó 7 (falso). Nada é escrito: a base anterior continua
// valendo, porque o lote nunca chegou a ter documento.
export function nadaAIndexar(loteId) {
  return { lote_id: textoOuVazio(loteId), indexado: false, total_documentos: 0, motivo: 'sem_documento_aprovado' };
}
