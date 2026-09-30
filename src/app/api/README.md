Rotas de API: webhooks (Autentique, InfinitePay, NFS-e), cron e sincronização.
Cada rota autentica o chamador e nunca expõe service_role ao navegador.
Preenchido a partir do P12 (sincronização) e dos módulos que integram terceiros.

Rotas de infraestrutura (P11, P14 e P18b): `GET /api/saude` (saúde do sistema, aberta só com o
estado), `POST` e `DELETE /api/push/inscrever` (inscrição de Web Push da pessoa logada),
`/api/webhooks/whatsapp` (desafio e status de entrega da Cloud API, assinado) e, só em
homologação, `/api/teste/cloud-api` (captura do adaptador `cloud_api`).
