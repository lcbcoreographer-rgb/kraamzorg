// Função pura equivalente a `privado.mascarar_documentos(texto)` (PRD, P05 item 5
// v4.2), usada pelo nó "Extrair Dados" (fluxo 3, nó 3) para mascarar CPF e cartão
// antes de o texto entrar no Redis, em `mensagem` e na memória do agente
// (PRD 11.11 item 6, 19.4 nó 3). O build embute este arquivo no JSON do nó Code;
// `n8n/build.test.mjs` importa a mesma função para testar.
//
// Esta é a definição de referência que o n8n copia (PRD, P05 item 5): qualquer
// mudança de regra entra primeiro aqui e depois em `privado.mascarar_documentos`
// (ou vice-versa), nunca só de um lado.

const SEPARADORES_GRUPO = ' .\\-/';

// Teto técnico de segurança do texto da família (SEG-BANCO-01): o nó Extrair
// Dados e a leitura da transcrição cortam o texto aqui antes de qualquer outra
// coisa (máscara, Redis, classificador, memória). É o mesmo valor que
// `agente.registrar_mensagem` e `agente.registrar_transcricao` aplicam no
// banco (migration 0016). Não é regra de negócio: nenhuma mensagem real de
// família chega perto disso.
export const LIMITE_TEXTO_MENSAGEM = 20000;

export function limitarTexto(texto) {
  if (typeof texto !== 'string' || texto.length <= LIMITE_TEXTO_MENSAGEM) return texto;
  let corte = LIMITE_TEXTO_MENSAGEM;
  // não deixa meio caractere (par substituto do UTF-16, emoji) no fim
  const codigo = texto.charCodeAt(corte - 1);
  if (codigo >= 0xd800 && codigo <= 0xdbff) corte -= 1;
  return texto.slice(0, corte);
}

function apenasDigitos(texto) {
  return (texto ?? '').replace(/\D/g, '');
}

function cpfValido(candidato) {
  const digitos = apenasDigitos(candidato);
  if (digitos.length !== 11) return false;
  // Dígitos repetidos (111.111.111-11) têm verificadores que batem e saem
  // mascarados, como em `privado.cpf_valido` (leitura literal do P05, caso
  // extra de supabase/tests/005_auditoria.sql).

  const calcularDv = (base) => {
    let soma = 0;
    let peso = base.length + 1;
    for (const caractere of base) {
      soma += Number(caractere) * peso;
      peso -= 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcularDv(digitos.slice(0, 9));
  const dv2 = calcularDv(digitos.slice(0, 9) + String(dv1));
  return digitos.slice(9) === `${dv1}${dv2}`;
}

function luhnValido(candidato) {
  const digitos = apenasDigitos(candidato);
  if (digitos.length === 0) return false;
  let soma = 0;
  let dobrar = false;
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let valor = Number(digitos[i]);
    if (dobrar) {
      valor *= 2;
      if (valor > 9) valor -= 9;
    }
    soma += valor;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

function mascararCpf(texto) {
  let resultado = texto;

  // Formatado: ddd.ddd.ddd-dd
  resultado = resultado.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, (match) =>
    cpfValido(match) ? '[CPF ocultado]' : match,
  );

  // Corrido: 11 dígitos isolados (não colados a outro dígito), para não comer
  // parte de um cartão de 13 a 19 dígitos.
  resultado = resultado.replace(/(?<!\d)\d{11}(?!\d)/g, (match) =>
    cpfValido(match) ? '[CPF ocultado]' : match,
  );

  return resultado;
}

// Número de cartão: 13 a 19 dígitos, Luhn válido e sem formato de telefone
// E.164 brasileiro. `anterior` é o caractere logo antes do trecho no texto.
// Mesma regra de `privado.cartao_valido`.
function cartaoValido(digitos, anterior) {
  if (digitos.length < 13 || digitos.length > 19) return false;
  if (anterior === '+' && digitos.length === 13 && digitos.startsWith('55')) return false;
  return luhnValido(digitos);
}

// Mascara cartão dentro de um trecho de grupos de dígitos (um separador de um
// caractere entre eles), com a mesma regra de `privado.mascarar_trecho_cartao`:
// primeiro o trecho inteiro; se ele não for cartão, a menor sequência de
// grupos inteiros que seja, da esquerda para a direita (cartão seguido de
// validade e CVV na mesma linha forma um trecho só, com mais de 19 dígitos).
// A busca que começa num grupo para quando a sequência passa de 19 dígitos,
// o que deixa o custo linear no tamanho do trecho (SEG-BANCO-01).
function mascararTrechoCartao(trecho, anterior) {
  const digitos = apenasDigitos(trecho);
  if (digitos.length < 13) return trecho;
  if (digitos.length <= 19 && cartaoValido(digitos, anterior)) return '[cartão ocultado]';

  const grupos = trecho.split(/\D/);
  if (grupos.length < 2) return trecho;
  const separadores = trecho.match(/\D/g) ?? [];

  const pedacos = [];
  let i = 0;
  while (i < grupos.length) {
    let achou = false;
    let juntos = '';
    const antes = i === 0 ? anterior : separadores[i - 1];
    for (let j = i; j < grupos.length; j += 1) {
      juntos += grupos[j];
      if (juntos.length > 19) break;
      if (juntos.length >= 13 && cartaoValido(juntos, antes)) {
        pedacos.push('[cartão ocultado]');
        achou = true;
        i = j + 1;
        break;
      }
    }
    if (!achou) {
      pedacos.push(grupos[i]);
      i += 1;
    }
    if (i < grupos.length) pedacos.push(separadores[i - 1]);
  }
  return pedacos.join('');
}

// Junta grupos de dígitos separados por espaço, ponto, hífen ou barra antes do
// teste de Luhn (regra do P05 item 5, cartão em grupos e Amex 4-6-5) e
// mascara o trecho inteiro, ou só a sequência de grupos que for cartão.
function mascararCartao(texto) {
  const regexCandidato = new RegExp(`\\d(?:[${SEPARADORES_GRUPO}]?\\d)*`, 'g');
  let houveCartao = false;

  const resultado = texto.replace(regexCandidato, (match, offset) => {
    const troca = mascararTrechoCartao(match, texto.slice(Math.max(0, offset - 1), offset));
    if (troca !== match) houveCartao = true;
    return troca;
  });

  return { texto: resultado, houveCartao };
}

// Na mesma mensagem que já teve um cartão ocultado, validade (MM/AA ou
// MM/AAAA) e o CVV/CVC logo depois desses rótulos também saem mascarados
// (regra do P05 item 5).
function mascararValidadeECvv(texto) {
  let resultado = texto.replace(/\b(0[1-9]|1[0-2])\/(\d{4}|\d{2})\b/g, '[dado de cartão ocultado]');
  resultado = resultado.replace(
    /(cvv|cvc|c[oó]digo de seguran[çc]a)(\s*:?\s*)(\d{3,4})\b/gi,
    (_match, rotulo, espaco) => `${rotulo}${espaco}[dado de cartão ocultado]`,
  );
  return resultado;
}

export function mascararDocumentos(texto) {
  if (typeof texto !== 'string' || texto.length === 0) return texto ?? '';

  let resultado = mascararCpf(texto);

  const { texto: comCartaoMascarado, houveCartao } = mascararCartao(resultado);
  resultado = comCartaoMascarado;

  if (houveCartao) {
    resultado = mascararValidadeECvv(resultado);
  }

  return resultado;
}
