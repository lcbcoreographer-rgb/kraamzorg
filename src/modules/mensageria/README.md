# src/modules/mensageria

Camada de aplicação do P18, sobre o adaptador de `src/lib/messaging` e os repositórios da
fundação (`src/lib/dados`).

- `tarefas/`: fila de tarefas por prioridade e vencimento (`/tarefas`, PRD 23.2). Agrupa
  (o "hoje" é o dia em Brasília), decodifica o `payload` (contrato em `tarefas/tipos.ts`,
  inclusive a `categoria` que decide o freio), checa o freio antes de mostrar "Abrir no
  WhatsApp" (`tarefas/verificador-freio.ts`, que troca o código do banco por frase) e
  registra o "Enviei" (`tarefas/acoes.ts` lê a tarefa de novo no servidor; só o texto vem
  do formulário; `tarefas/registrar-envio.ts` grava).
- `notificacoes/`: central interna (PRD 6.7 e 23.3): `central.ts` lê e marca como lida a
  tabela `notificacao`; `despachar.ts` manda WhatsApp interno, e-mail e push (pendente),
  respeitando as preferências da pessoa (`preferencias.ts`) quando a notificação é de uma
  pessoa só. O push (P11) manda sempre um aviso genérico, sem nome nem conteúdo.
- `push/` (P11): inscrição de Web Push da pessoa logada (`repositorio.ts`, pelas funções
  `api.registrar_inscricao_push` e `api.remover_inscricao_push`) e envio pelo servidor com VAPID
  (`servidor.ts`, `web-push`, `service_role` só para ler as inscrições).
- `cloud-api/` (P18b): monta o adaptador `cloud_api` de `src/lib/messaging` para o app, com a janela
  de `parametro.whatsapp_janela_horas` e o catálogo dos modelos aprovados pela Meta
  (`api.modelo_whatsapp_aprovado`).

Onde falta uma função `api.*` que ainda não existe (0012 a 0014 são de outra trilha, em
andamento), este módulo segue o mesmo padrão já usado por `src/modules/crm/pipeline`: em
demonstração, lê e grava direto na loja em memória (`@/lib/dados/demonstracao/loja`, sem
editar aquele arquivo); no Supabase, usa `rpcPendente` para a função do schema `api` que falta
(`pode_enviar_mensagem` e `registrar_envio_tarefa`: `mensagem` não tem INSERT para
`authenticated`, 0007) e só grava direto em tabela quando a RLS permite (`notificacao.lida_em`,
`tarefa.status`). Cada função documenta, no próprio arquivo, o que falta quando a migration
chegar.
