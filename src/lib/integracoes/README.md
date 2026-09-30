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
- `infinitepay/`: link de cobrança limitado a `pacote_versao.parcelas_max_sem_juros`;
  webhook que confirma com `payment_check` antes de qualquer baixa.
- `nfse/`: interface do adaptador para o padrão nacional e a implementação
  `EmissorNacionalAdaptador` (provedor comercial em [confirmar], T-05).
- `email/`: envio transacional com Resend, com guarda contra nome de
  paciente no assunto.

P31 e P32 (0019): `fabrica.ts` escolhe a Autentique e a InfinitePay do
ambiente (duplo local só na demonstração); `links-pagamento.ts` pede e guarda
o link de cada cobrança sem nunca lançar; `servico-webhooks.ts` é o que os
dois webhooks fazem no banco, pelas funções `public.contrato_*` e
`public.cobranca*`, só `service_role`.

P41 e P43 (0024): `fabrica.ts` também escolhe o e-mail (`obterEmail`: na
demonstração, caixa de saída local com a mesma guarda de assunto e de anexo;
fora dela, Resend com `RESEND_API_KEY` e `RESEND_FROM_EMAIL`) e o emissor de
NFS-e (`obterEmissorNfse`: na demonstração, provedor de mentira; fora dela,
`NFSE_PROVEDOR_BASE_URL` e `NFSE_PROVEDOR_API_KEY`). `nfse/emissao.ts` é o
caminho comum da tela do financeiro e do servidor (emitir, guardar os arquivos
do provedor no storage privado, registrar o resultado no banco).
`servico-webhooks.ts` ganhou `emitirNotaAutomatica`, chamada pelo webhook da
InfinitePay depois da baixa, em melhor esforço e só com
`parametro.nfse_emissao.automatica` ligado.
