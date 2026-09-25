`POST /api/interno/notificar` (P18 item 4): o banco chama por `pg_net` depois de gravar a
linha em `notificacao` (RLS pronta desde `0007_permissoes.sql`; o canal "app" não passa por
aqui, a tela lê a tabela direto). Esta rota só despacha os canais que só o app alcança:
`whatsapp_interno` (grupos e plantão pela UAZAPI, sem passar pelo freio), `email` (Resend,
reserva) e `push` (pendente do P11).

Segredo no cabeçalho `x-kz-interno-secret`, comparado com `INTERNAL_ROUTES_SECRET` (já em
`.env.example`) em tempo constante: os dois lados viram hash SHA-256 antes de
`timingSafeEqual`, para nem o tamanho do segredo vazar pelo tempo de resposta.
