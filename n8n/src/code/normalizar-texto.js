// Normalização usada pelo filtro determinístico de termos de alerta (PRD 11.11
// item 1: "texto normalizado, minúsculo, sem acento, contra termo_alerta") e por
// qualquer outra comparação de texto por palavra do fluxo 3. Função pura: o
// build embute este arquivo no nó Code correspondente; os testes importam a
// mesma função.

export function normalizarTexto(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Confere se `termo` (já normalizado) aparece em `texto` como palavra inteira,
// não como parte de outra palavra (PRD 11.11 item 1: "a comparação é por
// palavra", para "cura" não pegar "curativo", e "perdi o bebê" não pegar
// "perdi um bebê" sem o termo próprio para esse caso).
export function contemPalavra(texto, termo) {
  const textoNormalizado = normalizarTexto(texto);
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado) return false;
  const escapado = termoNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapado}(?![\\p{L}\\p{N}])`, 'u');
  return regex.test(textoNormalizado);
}
