Adaptador de e-mail transacional com Resend (PRD 14).

- `guarda.ts`: `garantirAssuntoSemDadoPessoal`, recusa o envio se o assunto
  contiver um termo proibido (nome de paciente, comparação sem acento e sem
  caixa). `enviarEmail` chama essa guarda antes de qualquer requisição.
- `textos.ts`: `ASSUNTO_EMAIL_EVOLUCAO`, o assunto fixo do e-mail de
  evolução aos médicos (PRD 23.5), sem nome de paciente por desenho.
- `cliente.ts`: `enviarEmail`, wrapper da API do Resend com anexo em
  base64.

Segredo só em variável de ambiente: `RESEND_API_KEY` (já em
`.env.example`).
