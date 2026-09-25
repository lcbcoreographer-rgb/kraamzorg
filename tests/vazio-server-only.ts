/**
 * Substitui `server-only` sob Vitest. O pacote real só existe para
 * disparar erro quando um bundler sem a condição `react-server` (webpack
 * fora do Next, ou qualquer runtime de teste) tenta importá-lo; é assim
 * que o Next.js barra em build um módulo de servidor importado do lado do
 * cliente (`node_modules/server-only/index.js`, README do pacote).
 *
 * Vitest não é o bundler do Next e não tem essa condição, então a
 * importação sempre lançaria, mesmo em teste de unidade rodando 100% no
 * servidor. O alias abaixo (`vitest.config.ts`, `resolve.alias`) troca o
 * pacote por este módulo vazio só durante o teste; o Next.js continua
 * resolvendo o pacote real no build, guarda intacta.
 */
export {};
