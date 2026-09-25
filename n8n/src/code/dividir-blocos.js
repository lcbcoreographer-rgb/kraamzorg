// Divide a resposta da Isadora em no máximo 3 blocos de até cerca de 280
// caracteres, sem quebrar frase (PRD 19.4, nó 30 "Preparar Envio"). Função
// pura: o build embute este arquivo no nó Code; os testes importam a mesma
// função.
//
// Frases são reconhecidas por pontuação final (. ! ?). Quando o texto tem
// mais frases do que blocos permitidos, o excedente é anexado ao último
// bloco em vez de criar um quarto bloco.

const TAMANHO_ALVO_PADRAO = 280;
const MAX_BLOCOS_PADRAO = 3;

function dividirEmFrases(texto) {
  const bruto = texto.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (!bruto) return [texto];
  return bruto.map((frase) => frase.trim()).filter(Boolean);
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
