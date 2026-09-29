/**
 * Divide um texto aprovado de mensagem_modelo em primeira frase e resto,
 * só para a apresentação (a primeira frase vira o título em Jost, o resto
 * o parágrafo). Nenhuma palavra muda: juntar as duas partes com um espaço
 * devolve o texto original.
 */
export function dividirPrimeiraFrase(texto: string): {
  primeira: string;
  resto: string;
} {
  const limpo = texto.trim();
  const achado = /^(.+?[.?])\s+(\S[\s\S]*)$/.exec(limpo);
  if (!achado) return { primeira: limpo, resto: "" };
  return { primeira: achado[1] ?? limpo, resto: achado[2] ?? "" };
}
