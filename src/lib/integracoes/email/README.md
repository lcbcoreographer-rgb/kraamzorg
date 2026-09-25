Adaptador de e-mail transacional com Resend (PRD 14).

- `guarda.ts`: recusa o envio se o assunto tiver nome de paciente (nome
  completo ou parte dele, sem acento e sem caixa), CPF, telefone ou e-mail,
  ou se o nome de um anexo tiver nome de paciente. A mensagem de erro nunca
  repete o dado. `enviarEmail` chama a guarda antes de qualquer requisição,
  e a lista de nomes é obrigatória.
- `cliente.ts`: `enviarEmail`, wrapper da API do Resend com anexo em
  base64. Assunto e corpo vêm de `mensagem_modelo` (nenhum texto aqui); a
  mensagem para família sai só pelo adaptador de mensageria.

Segredo só em variável de ambiente: `RESEND_API_KEY` (já em
`.env.example`).
