Autenticação, papéis e MFA (P07, parte de app).

- `sessao.ts`: `obterAutenticacao()`, `obterSessao()` e `exigirSessao(caminho?)` para o servidor. `exigirSessao()` sem caminho (layouts) exige perfil ativo e o AAL2 de quem precisa; com o caminho (páginas e Server Actions) aplica a mesma regra do proxy, papel incluído. Escolhe a implementação pelo modo (`src/lib/dados/modo.ts`): Supabase Auth ou demonstração.
- `acesso.ts`: a regra do proxy (`src/proxy.ts`), função pura e testada: sessão, AAL2 para os papéis de `PAPEIS_COM_MFA` e rota dentro da navegação do papel.
- `borda.ts`: leitura da sessão no proxy, onde o @supabase/ssr renova o token.
- `papeis.ts`: tipo `Papel`, rótulos e a lista de MFA, que espelha `privado.perfil_exige_mfa()` (teste lê a migration 0007).
