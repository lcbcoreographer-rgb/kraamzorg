# Runbook · Incidente de segurança

O que fazer quando há suspeita ou certeza de que dado de família, credencial ou o acesso ao sistema foi exposto, alterado ou perdido. Base: PRD 21.3 (incidente comunicado à Kraamzorg em até 24 horas, cláusula 10.4 do contrato) e a LGPD (arts. 46 a 48).

**O prazo que manda: a Drop comunica a Kraamzorg em até 24 horas** depois de saber do incidente, mesmo sem ter todos os detalhes. Comunicar cedo e incompleto é melhor que comunicar tarde e completo. A Kraamzorg é a controladora dos dados e decide, com o jurídico, sobre a comunicação à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares. A Drop, como operadora, informa e ajuda a apurar.

## 1. O que conta como incidente

Comunique se houver qualquer um destes, ainda que só suspeita:

- Credencial ou segredo vazou: chave de serviço do Supabase, token de WhatsApp (UAZAPI ou Cloud API), chave da OpenAI, do Resend, da Autentique, da InfinitePay, chave privada VAPID, senha de conta.
- Pessoa sem permissão viu ou baixou dado de família (registro assistencial, contrato, CPF, conversa).
- Dado real apareceu fora de produção: em homologação, em seed, em repositório, em pull request, em chat, em log ou no Sentry.
- Mensagem foi enviada à família errada, ou a uma família em bloqueio total, ou com o nome de outra família.
- Perda ou corrupção de dado (banco, Storage), inclusive por engano de quem opera.
- Conta de alguém com acesso ao sistema foi tomada, ou um aparelho de enfermeira com o aplicativo instalado foi perdido ou roubado.
- Comportamento estranho no `log_auditoria`: leitura assistencial em massa, acesso fora do horário, papel mudado sem pedido.

Na dúvida, trate como incidente e ajuste o nível depois.

## 2. Primeira hora: conter

Quem descobre avisa, no mesmo instante, a pessoa de plantão da Drop e o Leonardo (Kraamzorg). Contatos ficam no cofre [confirmar: telefones de plantão]. Depois, nesta ordem, o que se aplica:

1. **Parar de piorar.**
   - Credencial exposta: gire a credencial (seção 4) antes de investigar.
   - Aparelho perdido: revogue as sessões da pessoa (Diretoria, tela de **Sessões**, revogar) e desative o perfil se preciso.
   - Mensagem indevida saindo: ponha `agente_modo` em `desligado` (parâmetro), acione o freio da família afetada (bloqueio total), desligue o fluxo 3 do n8n.
   - Dado real em lugar errado: apague de onde não devia estar depois de guardar a evidência (seção 3) e antes que se espalhe (repositório: reescrever o histórico não basta; trate a credencial ou o dado como exposto).
2. **Guardar evidência antes de mexer.** Ver seção 3.
3. **Anotar a hora** em que soube, quem soube, e cada ação com a hora. Esse registro é o que a Kraamzorg vai usar.

## 3. Evidência (não destrua o que prova o que aconteceu)

- **Log de auditoria do sistema** (`log_auditoria`): só a diretoria lê, com MFA, pela função `api.log_auditoria`; o banco não permite editar nem apagar. Exporte o recorte do período por ela, sem copiar o conteúdo sensível (o log já guarda as colunas pessoais como `[oculto]` mais HMAC).
- **Logs da Vercel** (deploys, funções) e **do Supabase** (API, Auth, Postgres) do período.
- **Execuções do n8n com erro** (ficam 7 dias): exporte antes de expirarem.
- **Captura de tela** do que foi visto, sem dado de paciente: se a captura mostrar dado, guarde só no cofre.
- **Sentry**: o que chega lá não tem dado pessoal; confira que não chegou (se chegou, é parte do incidente).

Nada disso vai para chat, e-mail comum ou pull request. Vai para a pasta do incidente no cofre da Kraamzorg.

## 4. Girar credenciais

Depois de conter, gire tudo que possa ter sido visto, no serviço de origem, e atualize a variável na Vercel e o cofre (ver `ambientes.md`, seção 3). Sempre gerar valor **novo**, nunca reaproveitar.

| Credencial                                                             | Onde gira                                                              | Depois de girar                                                    |
| :--------------------------------------------------------------------- | :--------------------------------------------------------------------- | :----------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` e a chave anônima                          | Painel do Supabase, chaves de API                                      | Atualizar a Vercel (produção e o que usar a chave) e redeploy      |
| Senha do papel `n8n_agente`                                            | Painel do Supabase, definir à mão a partir do cofre                    | Atualizar a credencial no n8n                                      |
| Segredo do Vault do HMAC do log                                        | Supabase Vault                                                         | Registrar a data: HMACs anteriores não batem com a chave nova      |
| `UAZAPI_TOKEN`                                                         | Painel da UAZAPI                                                       | Atualizar a Vercel e o n8n                                         |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Painel da Meta (usuário do sistema e aplicativo)                       | Atualizar a Vercel e o n8n; reinscrever o webhook com o novo token |
| `OPENAI_API_KEY`                                                       | OpenAI                                                                 | Atualizar a Vercel e o n8n                                         |
| `RESEND_API_KEY`                                                       | Resend                                                                 | Atualizar a Vercel                                                 |
| `AUTENTIQUE_API_TOKEN`, `AUTENTIQUE_WEBHOOK_SECRET`                    | Autentique                                                             | Atualizar a Vercel e o endereço do webhook                         |
| `INFINITEPAY_API_KEY`                                                  | InfinitePay                                                            | Atualizar a Vercel                                                 |
| `CRON_SECRET`, `INTERNAL_ROUTES_SECRET`                                | Gerar novo                                                             | Atualizar a Vercel e quem chama (n8n, monitor)                     |
| Par VAPID                                                              | `node scripts/gerar-chaves-vapid.mjs`                                  | Atualizar a Vercel; cada aparelho liga os avisos de novo           |
| Senha e MFA de uma pessoa                                              | Diretoria: revogar sessões e, se a conta foi tomada, recadastrar o MFA | Avisar a pessoa por outro canal                                    |

## 5. Comunicar a Kraamzorg (em até 24 horas)

Quem comunica: a pessoa responsável da Drop, ao Leonardo, por telefone **e** por mensagem escrita, e confirma que foi lida. Use o modelo abaixo. **Sem nome de paciente**: identifique famílias por id interno, e só se for indispensável.

```
ASSUNTO: Incidente de segurança no Kraamzorg OS, [ambiente], [data]

1. O que aconteceu, em uma frase:
2. Quando começou e quando descobrimos (data e hora, fuso de Brasília):
3. Quem descobriu e como:
4. Que dados podem ter sido afetados (categorias: contato, contrato, CPF, registro assistencial, conversa; produção ou homologação):
5. Quantas famílias e pessoas, ou "ainda em apuração":
6. O que já fizemos para conter (com hora):
7. Ainda existe risco agora? (sim, não, não sabemos):
8. O que vamos fazer nas próximas horas e quando dou notícia de novo:
9. O que a Kraamzorg precisa decidir ou fazer (comunicar titulares, ANPD, jurídico):
10. Contato de plantão da Drop:
```

Atualize a Kraamzorg a cada fato novo e, no mínimo, uma vez por dia enquanto o incidente estiver aberto.

## 6. Decisões que são da Kraamzorg (controladora)

- Comunicar a ANPD e os titulares afetados: a LGPD (art. 48) exige comunicação em prazo razoável quando o incidente pode acarretar risco ou dano relevante; a ANPD regulamenta o prazo e o conteúdo [confirmar com o jurídico o prazo vigente]. Dado de saúde de gestante e recém-nascido é dado sensível: parta do princípio de que o risco é relevante.
- O que dizer às famílias, e por quem. A fala é sempre humana, pelo nome, e nunca pela Isadora nem por mensagem automática. Nenhuma automação sai para família afetada até a Kraamzorg liberar (use o freio da família).
- Se avisa a seguradora, o conselho profissional ou terceiros.

## 7. Depois de resolvido

1. Confirmar que a causa foi fechada (credencial girada, acesso removido, código corrigido) e que nada mais está exposto.
2. Retomar o que foi desligado, um item por vez: banco, app, webhooks, n8n, e por último o agente (`agente_modo` volta só com a aprovação do Leonardo).
3. Revisão sem culpa em até 5 dias úteis: linha do tempo, causa raiz, o que faltou para pegar antes, o que muda. Registrar em `docs/sessoes` do prompt que corrige, com o que virou teste automatizado.
4. Se o incidente mostrou uma regra que faltava, a mudança de regra edita o PRD primeiro, em commit separado (CLAUDE.md).
5. Guardar o registro do incidente no cofre por prazo definido pelo jurídico [confirmar].

## 8. Registro de incidentes

O registro completo fica no cofre da Kraamzorg. Aqui vai só o índice, sem dado de paciente.

| Data                          | Ambiente | Tipo | Comunicado à Kraamzorg em | Fechado em | Revisão |
| :---------------------------- | :------- | :--- | :------------------------ | :--------- | :------ |
| (nenhum incidente registrado) |          |      |                           |            |         |
