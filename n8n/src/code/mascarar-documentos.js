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

function apenasDigitos(texto) {
  return (texto ?? '').replace(/\D/g, '');
}

function cpfValido(candidato) {
  const digitos = apenasDigitos(candidato);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

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

// "+55" seguido de DDD (2 dígitos) e número de 9 dígitos: formato de telefone
// E.164, nunca tratado como cartão, mesmo que o Luhn dos 13 dígitos bata por
// coincidência (regra do P05 item 5: "não tenha formato de telefone").
function ehTelefoneE164(textoOriginal, inicio, digitos) {
  const precedente = textoOriginal.slice(Math.max(0, inicio - 1), inicio);
  return precedente === '+' && digitos.length === 13 && digitos.startsWith('55');
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

// Junta grupos de dígitos separados por espaço, ponto, hífen ou barra antes do
// teste de Luhn (regra do P05 item 5, cartão em grupos e Amex 4-6-5), e mascara
// o trecho inteiro (dígitos + separadores) quando o resultado tem de 13 a 19
// dígitos, passa no Luhn e não tem formato de telefone.
function mascararCartao(texto) {
  const regexCandidato = new RegExp(`\\d(?:[${SEPARADORES_GRUPO}]?\\d)*`, 'g');
  let houveCartao = false;

  const resultado = texto.replace(regexCandidato, (match, offset) => {
    const digitos = apenasDigitos(match);
    if (digitos.length < 13 || digitos.length > 19) return match;
    if (ehTelefoneE164(texto, offset, digitos)) return match;
    if (!luhnValido(digitos)) return match;
    houveCartao = true;
    return '[cartão ocultado]';
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
