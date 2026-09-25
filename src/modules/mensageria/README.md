# src/modules/mensageria

Camada de aplicação do P18, sobre o adaptador de `src/lib/messaging` e os repositórios da
fundação (`src/lib/dados`).

- `tarefas/`: fila de tarefas por prioridade e vencimento (`/tarefas`, PRD 23.2). Agrupa,
  decodifica o `payload` (contrato em `tarefas/tipos.ts`), checa o freio antes de mostrar
  "Abrir no WhatsApp" (`tarefas/verificador-freio.ts`) e registra o "Enviei"
  (`tarefas/registrar-envio.ts`).
- `notificacoes/`: central interna (PRD 6.7 e 23.3) — porta `NotificacoesRepositorio` com
  as duas implementações (demonstração e Supabase) e o serviço que decide os canais por
  preferência de cada pessoa.

Onde falta uma função `api.*` que ainda não existe (0012 a 0014 são de outra trilha, em
andamento), este módulo segue o mesmo padrão já usado por `src/modules/crm/pipeline`: em
demonstração, lê e grava direto na loja em memória (`@/lib/dados/demonstracao/loja`, sem
editar aquele arquivo); no Supabase, grava direto na tabela quando a RLS já permite (nunca
update de estágio) ou usa `rpcPendente` quando a escrita precisa mesmo de uma função do
schema `api`. Cada função documenta, no próprio arquivo, o que falta quando a migration
chegar.
