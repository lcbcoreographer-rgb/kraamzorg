// Nó 28 "Validar Resposta" do fluxo 3 e nó 39 "Validar" da entrada B (PRD
// 11.11 itens 3 a 8 e 5a, 19.4). Função pura: recebe o texto do modelo e o
// contexto que `agente.ficha_para_agente` devolveu (planos, valores, listas
// do validador) e devolve o texto corrigido, as violações que pedem reescrita
// e as marcas para o envio. O build embute este arquivo no nó Code; os testes
// importam a mesma função.
//
// Nenhuma lista de palavras mora aqui (CLAUDE.md: lista de termos vai para
// `parametro`): promessas, escassez, palavras evitadas, dados pessoais,
// negação de assistente virtual e palavras de condição chegam em
// `contexto.listas` (`parametro.validador_listas`, lido pela ficha). Sem as
// listas o validador reprova tudo (falha fechada), para uma ficha incompleta
// nunca virar resposta sem conferência. Aqui ficam só regras de forma:
// valores em reais, percentual, travessão, markdown, emoji, pontuação e
// colchetes.
//
// Correções automáticas (não pedem reescrita, PRD 11.11 item 5 e 5a):
// travessão e meia-risca viram vírgula; títulos, listas, links, negrito duplo
// e código são removidos; o negrito do WhatsApp (*assim*) fica, no máximo um
// por bloco; emoji acima de um por resposta é cortado, e todo emoji sai
// quando a resposta tem valor ou o motivo em curso é saúde, perda ou
// reclamação; exclamação acima de uma por bloco vira ponto.
//
// Violações (pedem a reescrita do nó 29): valor fora da tabela, ligado ao
// plano errado ou por extenso; percentual perto de condição; promessa;
// escassez; palavra evitada (por palavra inteira); pedido de documento ou
// dado pessoal; negar ser assistente virtual; mais de um "?" fora de citação
// (exceto no fechamento da venda); texto entre colchetes que não seja
// [ENVIAR_APRESENTACAO] sozinho numa linha; link (PRD 11.2).

import { normalizarTexto, contemPalavra } from './normalizar-texto.js';

export const MARCA_APRESENTACAO = '[ENVIAR_APRESENTACAO]';

export const LISTAS_VALIDADOR = [
  'palavras_evitadas',
  'promessas',
  'escassez',
  'pedido_dado',
  'negar_assistente',
  'palavras_condicao',
];

const MOTIVOS_SEM_EMOJI = ['saude', 'perda', 'reclamacao'];
const NEGACOES = ['nao', 'nunca', 'sem', 'nem'];
const JANELA_NEGACAO_PALAVRAS = 4;

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function dividirBlocos(texto) {
  return String(texto ?? '')
    .split(/\n[ \t]*\n/)
    .map((bloco) => bloco.trim())
    .filter(Boolean);
}

export function dividirFrases(bloco) {
  return String(bloco ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

function linhaEhMarcaApresentacao(linha) {
  return linha.trim().toUpperCase() === MARCA_APRESENTACAO;
}

const PADRAO_EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*️?/gu;

export function contarEmojis(texto) {
  return [...String(texto ?? '').matchAll(PADRAO_EMOJI)].length;
}

function limparEspacos(texto) {
  return texto
    .split('\n')
    .map((linha) => linha.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.!?;:])/g, '$1').trimEnd())
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Correções automáticas
// ---------------------------------------------------------------------------

function removerMarkdown(texto, correcoes) {
  let resultado = texto;
  const antes = resultado;
  resultado = resultado.replace(/^```[^\n]*\n?/gm, '');
  resultado = resultado.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  resultado = resultado.replace(/^\s{0,3}>\s?/gm, '');
  resultado = resultado.replace(/^\s*(?:[-*+•]|\d{1,2}[.)])\s+/gm, '');
  resultado = resultado.replace(/\[([^\]\n]+)\]\((?:[^)\s]+)\)/g, '$1');
  resultado = resultado.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  resultado = resultado.replace(/__([^_\n]+)__/g, '$1');
  resultado = resultado.replace(/`([^`\n]+)`/g, '$1');
  if (resultado !== antes) correcoes.push('markdown_removido');
  return resultado;
}

function trocarTravessao(texto, correcoes) {
  let resultado = texto.replace(/[ \t]*[—–][ \t]*/g, ', ');
  resultado = resultado.replace(/(\S)[ \t]+-[ \t]+(?=\S)/g, '$1, ');
  resultado = resultado.replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').replace(/^,\s*/gm, '');
  if (resultado !== texto) correcoes.push('travessao_trocado_por_virgula');
  return resultado;
}

// Negrito do WhatsApp: no máximo um por bloco; os demais perdem os asteriscos.
function limitarNegrito(bloco, correcoes) {
  let contador = 0;
  const resultado = bloco.replace(/\*([^*\n]+)\*/g, (casamento, conteudo) => {
    contador += 1;
    return contador === 1 ? casamento : conteudo;
  });
  if (resultado !== bloco) correcoes.push('negrito_extra_removido');
  return resultado;
}

function limitarExclamacao(bloco, correcoes) {
  let resultado = bloco.replace(/!{2,}/g, '!');
  let contador = 0;
  resultado = resultado.replace(/!/g, () => {
    contador += 1;
    return contador === 1 ? '!' : '.';
  });
  if (resultado !== bloco) correcoes.push('exclamacao_extra_trocada');
  return resultado;
}

function ajustarEmojis(texto, { removerTodos }, correcoes) {
  let contador = 0;
  const resultado = texto.replace(PADRAO_EMOJI, (emoji) => {
    contador += 1;
    if (removerTodos) return '';
    return contador === 1 ? emoji : '';
  });
  if (resultado !== texto) correcoes.push(removerTodos ? 'emoji_removido' : 'emoji_extra_cortado');
  return resultado;
}

// ---------------------------------------------------------------------------
// Valores em reais
// ---------------------------------------------------------------------------

const NUMERO = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?`;

function paraCentavos(numeroTexto, mil) {
  const valor = Number(String(numeroTexto).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * (mil ? 1000 : 1) * 100);
}

function sobrepoe(intervalos, inicio, fim) {
  return intervalos.some(([a, b]) => inicio < b && fim > a);
}

// Todos os valores em reais de um texto, com a posição e a forma: parcela
// ("3x de R$ 1.400", "3x de 1.400") ou à vista ("R$ 4.200", "4.200 reais",
// "4,2 mil").
export function encontrarValores(texto) {
  const origem = String(texto ?? '');
  const achados = [];
  const ocupados = [];
  const padroes = [
    { forma: 'parcela', regex: new RegExp(String.raw`(\d{1,2})\s*x\s*(?:de\s*)?(?:R\$\s*)?(${NUMERO})(\s*mil\b)?(?:\s*reais\b)?`, 'gi') },
    { forma: 'avista', regex: new RegExp(String.raw`R\$\s*(${NUMERO})(\s*mil\b)?`, 'gi') },
    { forma: 'avista', regex: new RegExp(String.raw`(?<![\d.,])(${NUMERO})(\s*mil)?\s*reais\b`, 'gi') },
    { forma: 'avista', regex: new RegExp(String.raw`(?<![\d.,])(${NUMERO})\s*mil\b`, 'gi') },
  ];
  for (const { forma, regex } of padroes) {
    for (const casamento of origem.matchAll(regex)) {
      const inicio = casamento.index;
      const fim = inicio + casamento[0].length;
      if (sobrepoe(ocupados, inicio, fim)) continue;
      const parcela = forma === 'parcela';
      const numero = parcela ? casamento[2] : casamento[1];
      const mil = Boolean(parcela ? casamento[3] : casamento[2]) || (!parcela && /mil\b/i.test(casamento[0]));
      const centavos = paraCentavos(numero, mil);
      if (centavos === null) continue;
      ocupados.push([inicio, fim]);
      achados.push({
        forma,
        parcelas: parcela ? Number(casamento[1]) : null,
        centavos,
        inicio,
        fim,
        trecho: casamento[0],
      });
    }
  }
  return achados.sort((a, b) => a.inicio - b.inicio);
}

const NUMERAIS = [
  'zero', 'um', 'uma', 'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze',
  'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
  'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento', 'duzentos',
  'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos', 'mil',
];
const PADRAO_EXTENSO = new RegExp(`\\b(?:(?:${NUMERAIS.join('|')})(?:\\s+e\\s+|\\s+|,\\s*))*(?:${NUMERAIS.join('|')})\\s+(?:mil\\s+)?reais\\b|\\b(?:${NUMERAIS.join('|')})\\s+mil\\b`, 'u');

// Valor em reais escrito por extenso ("quatro mil e duzentos reais") ou "R$"
// sem número: reprova (PRD 11.11 item 4, v4.2).
export function temValorPorExtenso(texto) {
  const normalizado = normalizarTexto(texto);
  if (/R\$(?!\s*\d)/.test(String(texto ?? ''))) return true;
  return PADRAO_EXTENSO.test(normalizado);
}

function nomesDoPlano(plano) {
  return [plano.nome, ...(Array.isArray(plano.apelidos) ? plano.apelidos : [])]
    .map((nome) => normalizarTexto(nome))
    .filter(Boolean);
}

// Planos citados num trecho, sem contar o nome curto dentro de um nome maior
// ("Essencial" dentro de "Gemelar Essencial").
export function planosCitados(trecho, planos = []) {
  const normalizado = normalizarTexto(trecho);
  const ocorrencias = [];
  planos.forEach((plano, indice) => {
    for (const nome of nomesDoPlano(plano)) {
      const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapado}(?![\\p{L}\\p{N}])`, 'gu');
      for (const casamento of normalizado.matchAll(regex)) {
        ocorrencias.push({ indice, inicio: casamento.index, fim: casamento.index + nome.length });
      }
    }
  });
  const validas = ocorrencias.filter(
    (ocorrencia) =>
      !ocorrencias.some(
        (outra) =>
          outra !== ocorrencia &&
          outra.inicio <= ocorrencia.inicio &&
          outra.fim >= ocorrencia.fim &&
          outra.fim - outra.inicio > ocorrencia.fim - ocorrencia.inicio,
      ),
  );
  return [...new Set(validas.map((ocorrencia) => ocorrencia.indice))];
}

function valorEhDoPlano(valor, plano) {
  if (valor.forma === 'parcela') {
    return (
      Number(plano.parcela_centavos) === valor.centavos &&
      (plano.parcelas === undefined || plano.parcelas === null || Number(plano.parcelas) === valor.parcelas)
    );
  }
  return Number(plano.valor_centavos) === valor.centavos;
}

function valorExisteNaTabela(valor, contexto) {
  const planos = contexto.planos ?? [];
  if (planos.some((plano) => valorEhDoPlano(valor, plano))) return true;
  if (valor.forma === 'avista' && (contexto.taxas_centavos ?? []).includes(valor.centavos)) return true;
  return false;
}

function ehTaxa(valor, contexto) {
  return valor.forma === 'avista' && (contexto.taxas_centavos ?? []).includes(valor.centavos);
}

function precedidoDeAPartirDe(bloco, valor) {
  const antes = normalizarTexto(bloco.slice(0, valor.inicio));
  return /a partir de\s*$/.test(antes);
}

function fraseDoValor(bloco, valor) {
  const inicioFrase = Math.max(
    bloco.lastIndexOf('. ', valor.inicio - 1),
    bloco.lastIndexOf('! ', valor.inicio - 1),
    bloco.lastIndexOf('? ', valor.inicio - 1),
    bloco.lastIndexOf('\n', valor.inicio - 1),
  );
  const resto = bloco.slice(valor.fim);
  const fimRelativo = resto.search(/[.!?](?:\s|$)|\n/);
  const fim = fimRelativo === -1 ? bloco.length : valor.fim + fimRelativo;
  return bloco.slice(inicioFrase === -1 ? 0 : inicioFrase + 1, fim);
}

function formatarReais(centavos) {
  const inteiro = Math.floor(centavos / 100);
  const resto = centavos % 100;
  const milhar = String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return resto ? `R$ ${milhar},${String(resto).padStart(2, '0')}` : `R$ ${milhar}`;
}

// PRD 11.11 item 4 (v4.2): a ligação entre valor e plano é conferida por
// bloco. Bloco (ou, sem plano, o bloco anterior) com um plano só: todo valor
// do bloco é desse plano. Com mais de um: cada valor na mesma frase do seu
// plano. Sem plano: só o menor valor da tabela precedido de "a partir de".
export function conferirValores(blocos, contexto, violacoes) {
  const planos = contexto.planos ?? [];
  let planosDoBlocoAnterior = [];
  blocos.forEach((bloco, indiceBloco) => {
    const citados = planosCitados(bloco, planos);
    const vigentes = citados.length > 0 ? citados : planosDoBlocoAnterior;
    for (const valor of encontrarValores(bloco)) {
      const rotulo = `${valor.forma === 'parcela' ? `${valor.parcelas}x de ` : ''}${formatarReais(valor.centavos)}`;
      if (contexto.permitir_valores === false) {
        violacoes.push({ regra: 'valor_proibido', detalhe: `${rotulo} (bloco ${indiceBloco + 1}): esta mensagem não pode ter valor` });
        continue;
      }
      if (!valorExisteNaTabela(valor, contexto)) {
        violacoes.push({ regra: 'valor_fora_da_tabela', detalhe: `${rotulo} (bloco ${indiceBloco + 1}) não está na tabela vigente` });
        continue;
      }
      if (ehTaxa(valor, contexto)) continue;
      if (vigentes.length === 1) {
        if (!valorEhDoPlano(valor, planos[vigentes[0]])) {
          violacoes.push({
            regra: 'valor_de_outro_plano',
            detalhe: `${rotulo} (bloco ${indiceBloco + 1}) não é valor do plano ${planos[vigentes[0]].nome}`,
          });
        }
      } else if (vigentes.length > 1) {
        const naFrase = planosCitados(fraseDoValor(bloco, valor), planos);
        if (!naFrase.some((indice) => valorEhDoPlano(valor, planos[indice]))) {
          violacoes.push({
            regra: 'valor_sem_o_plano_na_frase',
            detalhe: `${rotulo} (bloco ${indiceBloco + 1}) não está na mesma frase do seu plano`,
          });
        }
      } else {
        const minimo = Number(contexto.valor_minimo_centavos);
        const ehMinimo = valor.forma === 'avista' && valor.centavos === minimo;
        if (!ehMinimo || !precedidoDeAPartirDe(bloco, valor)) {
          violacoes.push({
            regra: 'valor_sem_plano',
            detalhe: `${rotulo} (bloco ${indiceBloco + 1}) sem plano citado: só o menor valor, com "a partir de"`,
          });
        }
      }
    }
    planosDoBlocoAnterior = citados;
  });
}

// ---------------------------------------------------------------------------
// Bloqueios de conteúdo
// ---------------------------------------------------------------------------

function listasDoContexto(contexto) {
  const listas = contexto.listas;
  if (!listas || typeof listas !== 'object') return null;
  const resultado = {};
  for (const nome of [...LISTAS_VALIDADOR, 'pedido_verbos']) {
    resultado[nome] = Array.isArray(listas[nome]) ? listas[nome].filter((item) => typeof item === 'string' && item.trim()) : [];
  }
  return resultado;
}

function termosPresentes(texto, lista) {
  return lista.filter((termo) => contemPalavra(texto, termo));
}

function temPercentualComCondicao(frase, palavrasCondicao) {
  if (!/\d+(?:[.,]\d+)?\s*(?:%|por\s*cento)/i.test(frase)) return false;
  return palavrasCondicao.some((palavra) => contemPalavra(frase, palavra));
}

// Pedido de documento ou dado pessoal: termo da lista numa oração que não
// está negada logo antes ("não precisa mandar documentos"). Com a lista
// `pedido_verbos`, a oração também precisa ser pedido (verbo da lista ou
// pergunta); sem ela, basta o termo não negado (falha fechada).
function pedidoDeDado(texto, listas) {
  const oracoes = String(texto ?? '').split(/[.!;:\n]|,(?!\d)/);
  const achados = [];
  for (const oracao of oracoes) {
    const normalizada = normalizarTexto(oracao);
    if (!normalizada) continue;
    for (const termo of listas.pedido_dado) {
      if (!contemPalavra(normalizada, termo)) continue;
      const termoNormalizado = normalizarTexto(termo);
      const posicao = normalizada.indexOf(termoNormalizado);
      const palavrasAntes = normalizada.slice(0, Math.max(0, posicao)).split(/\s+/).filter(Boolean);
      const janela = palavrasAntes.slice(-JANELA_NEGACAO_PALAVRAS);
      if (janela.some((palavra) => NEGACOES.includes(palavra))) continue;
      if (listas.pedido_verbos.length > 0) {
        const ehPedido = oracao.includes('?') || listas.pedido_verbos.some((verbo) => contemPalavra(normalizada, verbo));
        if (!ehPedido) continue;
      }
      achados.push(termo);
    }
  }
  return [...new Set(achados)];
}

function semCitacoes(texto) {
  return String(texto ?? '')
    .replace(/"[^"\n]*"/g, '')
    .replace(/“[^”\n]*”/g, '')
    .replace(/«[^»\n]*»/g, '');
}

function colchetesProibidos(texto, permitirApresentacao) {
  const achados = [];
  for (const linha of String(texto ?? '').split('\n')) {
    if (permitirApresentacao && linhaEhMarcaApresentacao(linha)) continue;
    if (!/[[\]]/.test(linha)) continue;
    const pares = [...linha.matchAll(/\[[^\]\n]*\]/g)].map((casamento) => casamento[0]);
    achados.push(...(pares.length > 0 ? pares : [linha.trim()]));
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function validarResposta(textoOriginal, contexto = {}) {
  const correcoes = [];
  const violacoes = [];
  const permitirApresentacao = contexto.permitir_apresentacao !== false;

  let texto = String(textoOriginal ?? '').replace(/\r\n?/g, '\n');
  texto = removerMarkdown(texto, correcoes);
  texto = trocarTravessao(texto, correcoes);

  const temValor = /R\$/.test(texto) || encontrarValores(texto).length > 0;
  const motivoEmCurso = contexto.motivo_em_curso ?? null;
  const motivos = Array.isArray(motivoEmCurso) ? motivoEmCurso : [motivoEmCurso];
  const semEmoji = temValor || motivos.some((motivo) => MOTIVOS_SEM_EMOJI.includes(motivo));
  texto = ajustarEmojis(texto, { removerTodos: semEmoji }, correcoes);

  const blocosCorrigidos = dividirBlocos(texto).map((bloco) => limitarExclamacao(limitarNegrito(bloco, correcoes), correcoes));
  texto = limparEspacos(blocosCorrigidos.join('\n\n'));
  const blocos = dividirBlocos(texto);

  // Colchetes (19.4 nó 28, v4.2).
  for (const trecho of colchetesProibidos(texto, permitirApresentacao)) {
    violacoes.push({ regra: 'colchetes', detalhe: `texto entre colchetes não permitido: ${trecho}` });
  }

  // Link: a Isadora só envia texto e a apresentação oficial (PRD 11.2).
  if (/\bhttps?:\/\/|\bwww\./i.test(texto)) {
    violacoes.push({ regra: 'link', detalhe: 'link na resposta; só a apresentação oficial sai como arquivo' });
  }

  const blocosSemMarca = blocos
    .map((bloco) => bloco.split('\n').filter((linha) => !linhaEhMarcaApresentacao(linha)).join('\n').trim())
    .filter(Boolean);

  // Valores (item 4).
  if (temValorPorExtenso(texto)) {
    violacoes.push({ regra: 'valor_por_extenso', detalhe: 'valor em reais por extenso ou "R$" sem número' });
  }
  conferirValores(blocosSemMarca, contexto, violacoes);

  const listas = listasDoContexto(contexto);
  if (!listas) {
    violacoes.push({ regra: 'validador_sem_listas', detalhe: 'as listas do validador não chegaram da ficha' });
  } else {
    for (const frase of blocosSemMarca.flatMap(dividirFrases)) {
      if (temPercentualComCondicao(frase, listas.palavras_condicao)) {
        violacoes.push({ regra: 'percentual_de_condicao', detalhe: `percentual perto de condição: "${frase}"` });
      }
    }
    const regrasDeLista = [
      ['promessas', 'promessa', 'promessa de resultado'],
      ['escassez', 'escassez', 'escassez ou urgência'],
      ['palavras_evitadas', 'palavra_evitada', 'palavra que a marca evita'],
      ['negar_assistente', 'nega_assistente_virtual', 'nega ser assistente virtual'],
    ];
    for (const [lista, regra, descricao] of regrasDeLista) {
      for (const termo of termosPresentes(texto, listas[lista])) {
        violacoes.push({ regra, detalhe: `${descricao}: "${termo}"` });
      }
    }
    for (const termo of pedidoDeDado(texto, listas)) {
      violacoes.push({ regra: 'pedido_de_dado', detalhe: `pedido de documento ou dado pessoal: "${termo}"` });
    }
  }

  // Perguntas (item 5a): mais de um "?" fora de citação, salvo no fechamento.
  const perguntas = (semCitacoes(texto).match(/\?/g) ?? []).length;
  if (perguntas > 1 && contexto.fechamento_venda !== true) {
    violacoes.push({ regra: 'perguntas_demais', detalhe: `${perguntas} perguntas numa resposta; o limite é uma` });
  }

  const pediuApresentacao = permitirApresentacao && texto.split('\n').some(linhaEhMarcaApresentacao);
  return {
    aprovada: violacoes.length === 0,
    texto,
    blocos,
    violacoes,
    correcoes: [...new Set(correcoes)],
    tem_valor: temValor,
    pediu_apresentacao: pediuApresentacao,
    precisa_pdf: temValor || pediuApresentacao,
  };
}

// Violações em texto, uma por linha, para o prompt de reescrita (nó 29).
export function violacoesEmTexto(violacoes = []) {
  return violacoes.map((violacao) => `- ${violacao.detalhe}`).join('\n');
}
