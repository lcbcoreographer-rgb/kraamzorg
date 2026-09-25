Adaptador da Autentique (PRD 14, P31): assinatura eletrônica do contrato.

- `tipos.ts`: tipos de entrada e saída, em português, sem nada de negócio.
- `cliente.ts`: `criarDocumento` (upload multipart do PDF, gestante e
  Kraamzorg assinam, parceiro testemunha, sandbox em homologação) e
  `buscarDocumento` (reconsulta usada pelo webhook antes de mudar estado).
- `webhook.ts`: `processarWebhookAutentique`, a lógica pura por trás da rota
  `src/app/api/webhooks/autentique/[segredo]/route.ts`. Nunca confia no corpo
  do POST: sempre reconsulta o documento pela API antes de marcar o contrato
  como assinado, e é idempotente (webhook duplicado não grava duas vezes).

Segredos só em variável de ambiente (`.env.example`): `AUTENTIQUE_API_TOKEN`
e `AUTENTIQUE_WEBHOOK_SECRET` (o segredo no caminho da rota).

[conferir] Os nomes exatos dos campos GraphQL (`DocumentInput`,
`SignerInput`, enum de ação) e o formato do payload do webhook não puderam
ser reconferidos contra `docs.autentique.com.br` nesta sessão (domínio
bloqueado na rede do ambiente); o formato usado segue o PRD 14 e o padrão
GraphQL multipart request spec público da Autentique. Reconfira antes de
ligar a credencial real de homologação.
