// Nó 39 "Validar" da entrada B (PRD 19.4 e 11.11 item 7). Função pura,
// embutida no nó Code; os testes importam a mesma. Regras no cabeçalho de
// `followup.js`.

import { normalizarTexto } from './normalizar-texto.js';
import { validarResposta } from './validar-resposta.js';
import { temSilencio } from './marcas-sistema.js';
import { comMarca, conteudoOpenAi, jsonDoModelo } from './resultado-no.js';

// Hash FNV-1a de 32 bits do texto normalizado (minúsculo, sem acento, sem
// pontuação nem emoji): dois textos iguais a menos de acento e pontuação
// batem.
export function hashDoTexto(texto) {
  const base = normalizarTexto(texto).replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
  let hash = 0x811c9dc5;
  for (const caractere of base) {
    hash ^= caractere.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function palavras(texto) {
  return new Set(
    normalizarTexto(texto)
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter((palavra) => palavra.length > 2),
  );
}

// Semelhança de Jaccard entre os conjuntos de palavras (0 a 1).
export function semelhanca(a, b) {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 && pb.size === 0) return 1;
  let comuns = 0;
  for (const palavra of pa) if (pb.has(palavra)) comuns += 1;
  return comuns / (pa.size + pb.size - comuns);
}

export function repeteEnvioDoDia(texto, enviadosHoje = [], limite = null) {
  const hash = hashDoTexto(texto);
  for (const enviado of enviadosHoje) {
    if (hashDoTexto(enviado) === hash) return { repete: true, por: 'hash' };
    if (limite !== null && semelhanca(texto, enviado) >= limite) return { repete: true, por: 'semelhanca' };
  }
  return { repete: false, por: null };
}

// Nó 39 "Validar".
export function validarFollowup(estado, respostaOpenAi) {
  const objeto = jsonDoModelo(conteudoOpenAi(respostaOpenAi));
  const bruto = typeof objeto?.texto === 'string' ? objeto.texto : null;
  const reprovar = (motivo, extra = {}) =>
    comMarca({ ...estado, followup_aprovado: false, followup_motivo: motivo, texto_followup: null, ...extra });

  if (bruto === null) return reprovar('geracao_falhou');
  if (temSilencio(bruto)) return reprovar('silencio');

  const resultado = validarResposta(bruto, {
    listas: estado.listas,
    planos: [],
    permitir_valores: false,
    permitir_apresentacao: false,
  });
  if (!resultado.aprovada) return reprovar('validador', { violacoes: resultado.violacoes });
  if (!resultado.texto) return reprovar('geracao_falhou');

  const repeticao = repeteEnvioDoDia(resultado.texto, estado.enviados_hoje, estado.limite_similaridade);
  if (repeticao.repete) return reprovar(`repete_envio_do_dia_${repeticao.por}`);

  return comMarca({ ...estado, followup_aprovado: true, followup_motivo: null, texto_followup: resultado.texto });
}
