Adaptador da Autentique (PRD 14, P31): assinatura eletrônica do contrato.

- `tipos.ts`: tipos de entrada e saída, em português, sem nada de negócio.
- `cliente.ts`: `criarDocumento` (upload multipart do PDF, gestante e
  Kraamzorg assinam, parceiro testemunha, sandbox em homologação) e
  `buscarDocumento` (reconsulta usada pelo webhook antes de mudar estado).
- `webhook.ts`: `processarWebhookAutentique`, a lógica pura por trás da rota
  `src/app/api/webhooks/autentique/[segredo]/route.ts`. Nunca confia no corpo
  do POST: sempre reconsulta o documento pela API antes de marcar o contrato
  como assinado, e é idempotente (webhook duplicado não grava duas vezes).

Segredos e ajustes só em variável de ambiente (`.env.example`):
`AUTENTIQUE_API_TOKEN`, `AUTENTIQUE_WEBHOOK_SECRET` (o segredo no caminho
da rota, comparado em tempo constante) e `AUTENTIQUE_SANDBOX` (ligado a
menos que valha "false").

Formato da API conferido em 25/09/2026 por implementações públicas da API v2
(o domínio docs.autentique.com.br segue bloqueado na rede do ambiente):
ação `SIGN` para quem assina e `SIGN_AS_A_WITNESS` para a testemunha,
`name` obrigatório no signatário, entrega por e-mail, WhatsApp
(`DELIVERY_METHOD_WHATSAPP`) ou link (`DELIVERY_METHOD_LINK`), e o webhook
no formato `{ event: { type: "document.finished", data: { id } } }`.
[conferir] reconfirmar com um disparo real no painel de homologação. A
Autentique também assina o webhook com HMAC (`x-autentique-signature`);
o PRD 14 adotou o segredo no caminho, e a checagem do HMAC fica como
pendência opcional.
