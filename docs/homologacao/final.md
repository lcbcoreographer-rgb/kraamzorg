# Homologação final (P53)

Aceite do P53: este documento sem pendência crítica. Data: 30/09/2026. Detalhe da segurança em `docs/seguranca/revisao-final.md`; saídas dos comandos em `docs/sessoes/P53.md`.

## Situação

| Item do P53                                                             | Situação                                                                                                                                                                                                  |
| :---------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. e2e de ponta a ponta das fases                                       | Suíte inteira verde nesta máquina (`pnpm e2e` e `pnpm e2e:offline`, em modo demonstração). A rodada em homologação, com Supabase, n8n e integrações de sandbox, depende do projeto de homologação da Drop |
| 2. RLS com leitura cruzada, avisos, cabeçalhos, gitleaks e dependências | Feito. Sem achado crítico, alto ou médio; dois baixos corrigidos; `supabase/tests/053_revisao_final.sql` fixa a varredura                                                                                 |
| 3. Teste de restauração documentado                                     | Ensaio local aprovado (`restaurar-teste.sh`, runbook seção 8). O primeiro teste com backup real fica para o primeiro mês de produção, como o runbook manda                                                |
| 4. Carga no webhook do agente                                           | 20 mensagens simultâneas de 20 números no caminho de banco do fluxo 3: aprovada. A carga pelo n8n real depende da homologação da Drop                                                                     |
| 5. Plano de virada                                                      | Abaixo                                                                                                                                                                                                    |

## Pendências

Nenhuma crítica no código. O que falta depende de conta ou decisão de terceiros e já tem dono:

1. T-01: a Isadora só vai para a produção com o adaptador `cloud_api` homologado; até lá `agente_modo = desligado` na produção (Leonardo e Drop).
2. Vault na restauração real: confirmar com o suporte da Supabase se a chave do HMAC volta junto (runbook de restauração, seção 3).
3. LGPD-03 e REV-03 (baixas): sessão própria, com teste de tela.
4. Primeiro teste mensal de restauração com o backup de produção, no primeiro dia útil depois da virada.

## Plano de virada para produção

Cada passo com quem executa e como conferir. Nada sai para família antes do passo 8.

1. **Congelar**: `hml` aprovado por Leonardo e Edilaine; promover `hml` para `main` (runbook `deploy-vercel.md`, seção 6).
2. **Banco de produção**: `supabase db push` das migrations 0001 a 0028 e 0045 no projeto de produção, depois da revisão humana do SQL. Conferir com a lista da seção 3 do runbook de restauração (tabelas com RLS, funções de `api`, gatilhos do registro).
3. **Segredos**: Vault (chave do HMAC do log), variáveis da Vercel de produção e senha dos papéis de banco (`n8n_agente`) definidas à mão a partir do cofre. `node scripts/checar-ambiente.mjs --env producao` sem nenhuma falta.
4. **Dados reais de configuração**: praças, localidades e taxas, pacotes vigentes, condições comerciais, parâmetros, `mensagem_modelo` aprovados e instrumentos aprovados pela Edilaine. Nenhum dado do seed sintético; nenhuma família de teste.
5. **Parâmetro do agente**: `agente_modo = desligado` antes de ligar qualquer fluxo.
6. **Fluxos n8n de produção**: `node n8n/build.mjs --env prod --config <config do cofre, fora do repositório>`, importação dos JSON, fluxos desligados; conferir que o papel é `n8n_agente` e que nenhum nó usa `service_role`.
7. **Webhooks**: Autentique, InfinitePay e Cloud API apontados para o domínio de produção, cada um com o seu segredo. O webhook da UAZAPI de produção só com o T-01 resolvido. Conferir `/api/saude` com o segredo interno.
8. **Liberação**: logins de cada papel com MFA; uma família fictícia de ponta a ponta em produção e apagada pela eliminação a pedido; `agente_modo` só sai de `desligado` com a aprovação escrita do Leonardo.
9. **Depois**: monitor de disponibilidade e Sentry ligados; primeiro teste de restauração no mês seguinte; incidente em até 24 horas pelo `docs/runbooks/incidente.md`.
