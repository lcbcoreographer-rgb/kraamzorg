Adaptador InfinitePay Checkout (PRD 14, P32): link de cobrança e webhook.

- `limites.ts`: o limite de 3 parcelas sem juros (PRD 14 v4.2, T-06),
  validado antes de qualquer chamada de rede.
- `tipos.ts`: tipos de entrada e saída.
- `cliente.ts`: `criarLinkPagamento` (`order_nsu` = id da cobrança, itens em
  centavos, `redirect_url`, `webhook_url`, dados do cliente) e
  `paymentCheck` (confirmação usada pelo webhook antes de qualquer baixa).
- `webhook.ts`: `processarWebhookInfinitePay`, a lógica por trás da rota
  `src/app/api/webhooks/infinitepay/route.ts`. O webhook da InfinitePay não
  é assinado (PRD 14): o corpo nunca decide uma baixa sozinho, sempre passa
  por `payment_check`; é idempotente (cobrança já paga não baixa de novo).

Segredos só em variável de ambiente: `INFINITEPAY_HANDLE` e
`INFINITEPAY_API_KEY` (`.env.example`).

[conferir] T-06 (Plano de Cobrança vs. link simples) ainda em aberto; ver
comentário no topo de `cliente.ts` e `docs/aprovacao/decisoes-pendentes.md`
item 5.
