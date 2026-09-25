Repositórios por domínio: a única porta das telas para os dados (P07/P10, fundação do CRM).

- `repositorios.ts`: as interfaces (famílias e pipeline, ficha, tarefas, configurações, agente, usuários). `tipos.ts`: os tipos de domínio.
- `fabrica.ts`: `await obterRepositorios()` no servidor. A tela nunca sabe se é `supabase/` (RLS e schema api) ou `demonstracao/` (fixtures em memória, só com `NEXT_PUBLIC_APP_ENV=desenvolvimento` e `KZ_DADOS=demonstracao`; fora disso lança erro).
- Cada módulo acrescenta métodos no próprio domínio, nas duas implementações, com teste em `fabrica.test.ts` ou ao lado.
