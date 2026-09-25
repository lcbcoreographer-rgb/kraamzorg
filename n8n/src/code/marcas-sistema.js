// Marcas de sistema na saída do modelo (PRD 19.4 nós 27 e 30, 11.9):
// `[SILENCIO]` em qualquer posição encerra; `[ENVIAR_APRESENTACAO]` sozinho
// numa linha pede a apresentação oficial. Arquivo pequeno de propósito: entra
// em vários nós Code.

export const MARCA_SILENCIO = /\[\s*SILENCIO\s*\]/i;
export const MARCA_APRESENTACAO_LINHA = /^\s*\[\s*ENVIAR_APRESENTACAO\s*\]\s*$/i;

export function temSilencio(texto) {
  return MARCA_SILENCIO.test(String(texto ?? ''));
}
