// Divide a resposta da Isadora em no máximo 3 blocos de até cerca de 280
// caracteres, sem quebrar frase (PRD 19.4, nó 30 "Preparar Envio"). Função
// pura: o build embute este arquivo no nó Code; os testes importam a mesma
// função.
//
// Frases são reconhecidas por pontuação final (. ! ?) seguida de espaço ou
// quebra de linha. Quando o texto tem mais frases do que blocos permitidos, o
// excedente é anexado ao último bloco em vez de criar um quarto bloco.
//
// [P25] A versão do P23 casava frases com `[^.!?]+[.!?]+(?=\s|$)` e perdia o
// texto antes de um ponto sem espaço depois: "O Essencial é R$ 4.200." virava
// "200.". Agora a divisão é só no limite de frase, e nenhum caractere se
// perde (teste em `build.test.mjs`).

const TAMANHO_ALVO_PADRAO = 280;
const MAX_BLOCOS_PADRAO = 3;

function dividirEmFrases(texto) {
  return texto
    .split(/(?<=[.!?])\s+/)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

export function dividirEmBlocos(texto, opcoes = {}) {
  const tamanhoAlvo = opcoes.tamanhoAlvo ?? TAMANHO_ALVO_PADRAO;
  const maxBlocos = opcoes.maxBlocos ?? MAX_BLOCOS_PADRAO;

  const textoLimpo = typeof texto === 'string' ? texto.trim() : '';
  if (!textoLimpo) return [];

  const frases = dividirEmFrases(textoLimpo);
  const blocos = [];
  let atual = '';

  for (const frase of frases) {
    const candidato = atual ? `${atual} ${frase}` : frase;
    if (atual && candidato.length > tamanhoAlvo) {
      blocos.push(atual);
      atual = frase;
    } else {
      atual = candidato;
    }
  }
  if (atual) blocos.push(atual);

  if (blocos.length > maxBlocos) {
    const inicio = blocos.slice(0, maxBlocos - 1);
    const resto = blocos.slice(maxBlocos - 1).join(' ');
    inicio.push(resto);
    return inicio;
  }

  return blocos;
}
