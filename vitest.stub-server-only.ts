// Substitui o pacote "server-only" durante o Vitest. "server-only" existe
// para quebrar o build se um componente de navegador importar um módulo de
// servidor (Next.js, react-server condition); o Vitest roda em jsdom, que
// não tem essa condição, então o pacote real lança erro por engano aqui.
// Este stub troca o guard por um módulo vazio só nos testes (vitest.config.ts,
// resolve.alias); o guard de verdade continua ativo no build do Next.js.
export {};
