# src/modules/mensageria/notificacoes

Central interna (PRD 6.7 e 23.3, item 3 do P18): "app" é a própria tabela `notificacao`
(RLS já pronta desde `0007_permissoes.sql`, lida e marcada como lida direto por
`central.ts`, sem RPC). "push", "whatsapp_interno" e "email" são despachados por
`despachar.ts`, chamado pela rota `src/app/api/interno/notificar` — quem decide gravar a
notificação e quem avisar é o sistema (a própria migration diz isso), nunca a tela.

`push` ainda não tem para onde mandar (inscrição do navegador é do P11): fica documentado
como pendente em `despachar.ts`, sem crash. `email` usa o Resend por HTTP direto (sem SDK
nova); falta `RESEND_FROM_EMAIL` em `.env.example` (raiz, fora deste módulo).

`preferencias.ts`: por pessoa, três interruptores (push, WhatsApp interno, e-mail; "app"
não desliga). O banco não tem onde guardar isso ainda — funciona de verdade em
demonstração; em Supabase lê sempre o padrão (tudo ligado) e recusa gravar até existir
coluna ou tabela.

Sem componente de tela próprio: o sino da central mora no cabeçalho da casca
(`src/components/shell`, P10, fora das pastas deste módulo). As funções daqui já ficam
prontas para quem montar esse componente importar.
