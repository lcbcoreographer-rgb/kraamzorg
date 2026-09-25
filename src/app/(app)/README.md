Painel de diretoria, comercial, coordenação, financeiro e marketing, dentro da casca (`src/components/shell/casca-app.tsx`).
Cada pasta é de um módulo (o dono está em `src/lib/navegacao`, campo `dono`): o módulo troca o `TelaEmConstrucao` da própria `page.tsx` e não mexe na casca.
Leitura por `await obterRepositorios()` (src/lib/dados); escrita por Server Action na própria pasta.
