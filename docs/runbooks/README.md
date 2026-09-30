# Runbooks

Procedimentos de operação do Kraamzorg OS. Cada um diz quem faz, em que ordem e como conferir.

| Runbook                                | Quando usar                                                                                                                                 |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| [`ambientes.md`](ambientes.md)         | Entender os três ambientes, as variáveis de cada um, o que entra em cada banco e como conferir tudo antes de promover                       |
| [`deploy-vercel.md`](deploy-vercel.md) | Criar ou mudar o projeto na Vercel, o domínio, os webhooks, o monitor; subir, promover e voltar atrás                                       |
| [`restauracao.md`](restauracao.md)     | Teste mensal de restauração de backup num projeto temporário; restauração de verdade                                                        |
| [`incidente.md`](incidente.md)         | Suspeita ou certeza de exposição de dado ou credencial: conter, guardar evidência, girar credenciais, comunicar a Kraamzorg em até 24 horas |

Regras que valem para todos: nome de paciente nunca em nome de arquivo, ticket, chat, log ou registro de teste; segredo só no cofre da Kraamzorg e nas variáveis da Vercel; dado real nunca sai de produção.
