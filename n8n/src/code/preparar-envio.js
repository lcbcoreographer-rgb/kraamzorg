// Nó 30 "Preparar Envio" do fluxo 3 (PRD 19.4 e 11.11 itens 3 e 8). Função
// pura: recebe o texto já validado e a situação da apresentação e devolve a
// lista de envios, na ordem em que saem. O build embute este arquivo no nó
// Code; os testes importam a mesma função.
//
// Regras:
// - `[SILENCIO]` em qualquer posição do texto encerra: nada sai (v4.2).
// - No máximo três blocos de cerca de 280 caracteres, sem quebrar frase. Cada
//   parágrafo do modelo (separado por linha em branco) vira bloco; parágrafo
//   longo é dividido por frase; o excedente entra no último bloco.
// - A apresentação sai antes do primeiro bloco com "R$" (item 3), salvo se o
//   mesmo arquivo saiu dentro de `pdf_reenvio_janela_horas` (zero por padrão,
//   ou seja, sempre sai). Com `[ENVIAR_APRESENTACAO]` sozinho numa linha, sai
//   sempre, naquele ponto. Uma apresentação por resposta.
// - Sem o arquivo da apresentação (parâmetro `pdf_apresentacao` vazio), valor
//   nenhum sai: nada é enviado e o fluxo abre a transferência
//   (`faltou_apresentacao`).
// - Digitação simulada por bloco (item 8): de `digitacaoMinimaMs` a
//   `digitacaoMaximaMs`, proporcional ao tamanho do bloco.

import { dividirEmBlocos } from './dividir-blocos.js';
import { temSilencio, MARCA_APRESENTACAO_LINHA } from './marcas-sistema.js';

const TAMANHO_ALVO = 280;
const MAX_BLOCOS = 3;

// Blocos com a marca de apresentação antes de cada um (a marca no fim fica
// em `apresentacaoNoFim`).
export function montarBlocos(texto, { tamanhoAlvo = TAMANHO_ALVO, maxBlocos = MAX_BLOCOS } = {}) {
  const pedacos = [];
  let marcaPendente = false;
  for (const paragrafo of String(texto ?? '').split(/\n[ \t]*\n/)) {
    const linhas = [];
    for (const linha of paragrafo.split('\n')) {
      if (MARCA_APRESENTACAO_LINHA.test(linha)) {
        if (linhas.length > 0) {
          pedacos.push({ texto: linhas.join('\n').trim(), apresentacaoAntes: marcaPendente });
          linhas.length = 0;
          marcaPendente = false;
        }
        marcaPendente = true;
      } else if (linha.trim()) {
        linhas.push(linha.trim());
      }
    }
    const conteudo = linhas.join('\n').trim();
    if (!conteudo) continue;
    dividirEmBlocos(conteudo, { tamanhoAlvo, maxBlocos: Number.MAX_SAFE_INTEGER }).forEach((parte, indice) => {
      pedacos.push({ texto: parte, apresentacaoAntes: indice === 0 && marcaPendente });
    });
    marcaPendente = false;
  }

  let blocos = pedacos;
  if (pedacos.length > maxBlocos) {
    const inicio = pedacos.slice(0, maxBlocos - 1);
    const resto = pedacos.slice(maxBlocos - 1);
    inicio.push({
      texto: resto.map((pedaco) => pedaco.texto).join(' '),
      apresentacaoAntes: resto.some((pedaco) => pedaco.apresentacaoAntes),
    });
    blocos = inicio;
  }
  return { blocos, apresentacaoNoFim: marcaPendente };
}

function horasDesde(isoData, agora) {
  const momento = Date.parse(isoData);
  const referencia = Date.parse(agora);
  if (!Number.isFinite(momento) || !Number.isFinite(referencia)) return Infinity;
  return (referencia - momento) / 3600000;
}

// A apresentação sai por causa de valor? Janela zero (ou ausente) = sempre.
export function apresentacaoPorValorSai(pdf = {}, agora) {
  const janela = Number(pdf.reenvio_janela_horas);
  if (!Number.isFinite(janela) || janela <= 0) return true;
  if (!pdf.enviado_em) return true;
  return horasDesde(pdf.enviado_em, agora) >= janela;
}

export function tempoDeDigitacao(texto, { minimoMs, maximoMs, tamanhoAlvo = TAMANHO_ALVO }) {
  const minimo = Number(minimoMs);
  const maximo = Number(maximoMs);
  if (!Number.isFinite(minimo) || !Number.isFinite(maximo) || maximo < minimo) return 0;
  const proporcao = Math.min(1, String(texto ?? '').length / tamanhoAlvo);
  return Math.round(minimo + (maximo - minimo) * proporcao);
}

export function prepararEnvio({ texto, pdf = {}, agora, digitacao = {}, intervaloSegundos = 0 }) {
  if (temSilencio(texto)) {
    return { silencio: true, envios: [], blocos: [], tem_envio: false, apresentacao: null, faltou_apresentacao: false };
  }

  const { blocos, apresentacaoNoFim } = montarBlocos(texto);
  const indiceValor = blocos.findIndex((bloco) => /R\$/.test(bloco.texto));
  const indicePedido = blocos.findIndex((bloco) => bloco.apresentacaoAntes);
  const candidatos = [];
  if (indicePedido >= 0) candidatos.push({ indice: indicePedido, motivo: 'pedido' });
  else if (apresentacaoNoFim) candidatos.push({ indice: blocos.length, motivo: 'pedido' });
  if (indiceValor >= 0 && apresentacaoPorValorSai(pdf, agora)) candidatos.push({ indice: indiceValor, motivo: 'valor' });
  candidatos.sort((a, b) => a.indice - b.indice);
  const apresentacao = candidatos[0] ?? null;

  const arquivo = typeof pdf.url === 'string' && pdf.url.trim() ? pdf.url.trim() : '';
  if (apresentacao && !arquivo) {
    return {
      silencio: false,
      envios: [],
      blocos: blocos.map((bloco) => bloco.texto),
      tem_envio: false,
      apresentacao: null,
      faltou_apresentacao: true,
    };
  }

  const envios = [];
  const documento = {
    tipo: 'documento',
    arquivo,
    nome_arquivo: typeof pdf.nome_arquivo === 'string' ? pdf.nome_arquivo.trim() : '',
    espera_segundos: intervaloSegundos,
  };
  blocos.forEach((bloco, indice) => {
    if (apresentacao && apresentacao.indice === indice) envios.push({ ...documento });
    envios.push({
      tipo: 'texto',
      texto: bloco.texto,
      delay_ms: tempoDeDigitacao(bloco.texto, { minimoMs: digitacao.minimoMs, maximoMs: digitacao.maximoMs }),
      espera_segundos: intervaloSegundos,
    });
  });
  if (apresentacao && apresentacao.indice >= blocos.length) envios.push({ ...documento });

  envios.forEach((envio, ordem) => {
    envio.ordem = ordem;
  });

  return {
    silencio: false,
    envios,
    blocos: blocos.map((bloco) => bloco.texto),
    tem_envio: envios.length > 0,
    apresentacao: apresentacao ? apresentacao.motivo : null,
    faltou_apresentacao: false,
  };
}
