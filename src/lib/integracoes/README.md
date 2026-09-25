Adaptadores de terceiro (PRD 14): Autentique (assinatura, P31), InfinitePay
(cobrança, P32), NFS-e (nota fiscal, P43) e e-mail transacional com Resend.

Cada pasta segue o mesmo formato: `tipos.ts` (entrada e saída em português),
`cliente.ts` (a chamada HTTP, com `fetchImpl` injetável), e quando há
webhook, `webhook.ts` com a lógica pura de decisão (sem rede nem banco),
usada pela rota em `src/app/api/webhooks/*` e testada com "fetch
interceptado" (CLAUDE.md, "integração com terceiro testada com respostas
simuladas... sem chamar a API real").

Nenhum módulo lê segredo fora de `process.env`; todos estão documentados em
`.env.example`. Nenhum destes clientes deve ser importado do lado do
navegador (todos com `import "server-only"`).

- `autentique/`: `createDocument` com upload e sandbox; webhook que
  reconsulta o documento antes de mudar estado.
- `infinitepay/`: link de cobrança com o limite de 3 parcelas sem juros;
  webhook que confirma com `payment_check` antes de qualquer baixa.
- `nfse/`: interface do adaptador para o padrão nacional e a implementação
  `EmissorNacionalAdaptador` (provedor comercial em [confirmar], T-05).
- `email/`: envio transacional com Resend, com guarda contra nome de
  paciente no assunto.
