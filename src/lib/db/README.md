Clientes do Supabase e tipos do banco (P07, fundação do CRM).

- `cliente-servidor.ts`: Server Components, Server Actions e rotas. Cookies e RLS do usuário logado; escrita e dado sensível por `cliente.schema("api").rpc(...)`.
- `cliente-navegador.ts`: componentes "use client", só chave anônima (RLS). Preferir ler no servidor.
- `cliente-servico.ts`: service_role, `import "server-only"`, só nos motivos listados no arquivo (convite e sessões da diretoria). O teste `cliente-servico.test.ts` falha se outro arquivo importar.
- `types.ts`: gerado. `pnpm db:types:local` (banco de `supabase/sem-docker`, PGPORT da sua trilha) ou `pnpm db:types` (CLI do Supabase, com Docker). Nunca edite à mão.
