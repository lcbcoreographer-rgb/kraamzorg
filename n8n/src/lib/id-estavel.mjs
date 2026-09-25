// Gera ids estáveis (determinísticos) a partir de um texto: mesmo texto de
// entrada sempre devolve o mesmo id, então o `id` de raiz de cada fluxo
// (PRD 19.5, "o JSON tem `id` na raiz") e o `id` de cada nó não mudam de build
// para build, e o diff de `n8n/dist/*.json` mostra só o que de fato mudou.
//
// Não é um UUID v5 de verdade (não usa o namespace binário da RFC), só um
// hash formatado com a aparência de UUID: suficiente aqui, porque o único
// requisito é estabilidade e ausência de colisão prática, não interoperar
// com geradores de UUID de terceiros.

import { createHash } from 'node:crypto';

export function idEstavel(texto) {
  const hash = createHash('sha256').update(String(texto)).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`, // versão 4 "de mentira", só para o formato
    `8${hash.slice(17, 20)}`, // variante fixa, só para o formato
    hash.slice(20, 32),
  ].join('-');
}
