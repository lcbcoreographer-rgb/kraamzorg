# Fechamento: funções do CRM no banco e ajustes do n8n

Data: 25/09/2026
Branch: `claude/kraamzorg-delivery-review-6kzd8q`. Nada desta rodada tem commit ainda; a migration 0017 não foi aplicada em nenhum ambiente (`supabase db push` só depois da revisão humana, CLAUDE.md).

O fechamento rodou em duas frentes (banco e n8n) e a máquina reiniciou no fim. Esta sessão tratou tudo o que estava no working tree como não revisado: refez a revisão de segurança das funções novas, conferiu os contratos entre o app, o n8n e o banco, rodou a suíte inteira do zero e gerou os JSON finais de homologação.

## O que foi fechado

### Banco

- `supabase/migrations/0017_api_crm.sql`: as funções do schema `api` que o CRM já chamava por `rpcPendente` (P17, P18 e P27), mais `privado.item_base_conhecimento` (auxiliar, sem grant). Toda função é `security definer`, `set search_path = ''`, confere papel e AAL por dentro (`privado.autorizar`) e tem `execute` só para `authenticated`. A trava no fim da migration falha o `db push` se alguma função de `api` sair dessa regra.
- `supabase/tests/017_api_crm.sql` (167 asserções) e a lista do ADR 0002 no `supabase/tests/007_permissoes.sql`.
- `supabase/seed.sql`: `parametro.validador_listas` com as quatro listas que faltavam (`pedido_dado`, `pedido_verbos`, `negar_assistente`, `palavras_condicao`) [confirmar: Leonardo, listas completas].
- `src/lib/db/types.ts` regenerado do banco local.
- `docs/adr/0002-permissoes.md` (seções 5 e 6 e decisões) e `docs/adr/0003-fronteira-agente.md` (divergência 5 e pendência do P27 resolvidas).

### n8n

Quatro ajustes no fluxo 3 (ADR 0003, divergências 1 a 4), com testes em `n8n/fluxo-3.test.mjs`:

1. O nó "Não Lead no Início?" também dispara com a classificação `nao_classificado` (antes só com nulo, e o banco nunca devolve nulo).
2. `agente.sincronizar_memoria(conversa_id, 'descartado', null)` nos dois caminhos em que nada sai para a família (saúde ou `[SILENCIO]`, e resposta barrada sem fallback).
3. A descrição da ferramenta `atualizar_ficha` lista as 21 chaves que `agente.atualizar_lead` aceita.
4. A URL do PDF da apresentação: usa a `url` do banco quando já é completa; senão monta com `storage.urlPublicaMarketing` do config; sem as duas, a apresentação não sai e a transferência `faltou_apresentacao` segue. Chave nova em `n8n/config.example.json` e em `n8n/IMPORTAR.md`.

## Funções de `api` (lista final, 34)

"Regra do perfil" é `privado.autorizar(papeis, false)`: AAL2 para quem tem papel com MFA obrigatório (enfermeira, financeiro, coordenação, diretoria) e AAL1 para quem é só comercial ou só marketing. Detalhe de cada linha no ADR 0002, seção 5.

| Função                                                                          | Papéis                                                                                                                                                                                    | AAL                                      |
| :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `api.transicionar(maquina, entidade_id, para, motivo)`                          | p1: comercial, diretoria; p2: comercial, financeiro, coordenação, diretoria; acompanhamento e visita: coordenação, diretoria, enfermeira atribuída; p4: comercial, coordenação, diretoria | AAL2, menos p1 (regra do perfil)         |
| `api.transicoes_permitidas(maquina, de)`                                        | os mesmos de `api.transicionar`                                                                                                                                                           | como `api.transicionar`                  |
| `api.familias_do_dia(dia)`                                                      | enfermeira (atribuídas), coordenação, diretoria                                                                                                                                           | AAL2                                     |
| `api.ficha_assistencial(familia_id)`                                            | enfermeira (atribuída), coordenação, diretoria                                                                                                                                            | AAL2, com log de leitura                 |
| `api.dados_contrato(pessoa_id, completo)`                                       | comercial, financeiro, diretoria                                                                                                                                                          | AAL2 no completo, com log nos dois modos |
| `api.status_cobranca(familia_id)`                                               | comercial, financeiro, diretoria                                                                                                                                                          | AAL2                                     |
| `api.sessao_venda_gravacao(sessao_id)`                                          | quem conduziu (comercial ou coordenação), diretoria                                                                                                                                       | AAL2, com log de leitura                 |
| `api.status_equipe(regiao_id, semana)`                                          | coordenação, diretoria, enfermeira (só a própria)                                                                                                                                         | AAL2                                     |
| `api.marketing_leads_por_origem(desde, ate)`                                    | marketing, diretoria                                                                                                                                                                      | regra do perfil                          |
| `api.marketing_funil(desde, ate)`                                               | marketing, diretoria                                                                                                                                                                      | regra do perfil                          |
| `api.lead_origem(familias)`                                                     | comercial, diretoria                                                                                                                                                                      | regra do perfil                          |
| `api.log_auditoria(entidade, entidade_id, desde, ate, limite)`                  | diretoria                                                                                                                                                                                 | AAL2, com log da própria leitura         |
| `api.acionar_freio(familia_id, estado, motivo)`                                 | comercial, enfermeira, financeiro, coordenação, diretoria, só em família que vê                                                                                                           | regra do perfil                          |
| `api.desfazer_freio(familia_id)`                                                | quem acionou, dentro do prazo, enquanto for a última mudança do freio                                                                                                                     | regra do perfil                          |
| `api.justificar_freio(familia_id, motivo)`                                      | quem acionou por último, coordenação, diretoria                                                                                                                                           | regra do perfil                          |
| `api.reverter_freio(familia_id, estado, justificativa)`                         | coordenação, diretoria                                                                                                                                                                    | AAL2                                     |
| `api.retomar_agente(conversa_id)`                                               | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.eliminar_titular(familia_id, motivo)`                                      | diretoria                                                                                                                                                                                 | AAL2                                     |
| `api.revogar_sessoes(usuario_id)`                                               | diretoria                                                                                                                                                                                 | AAL2                                     |
| `api.parametros_da_tela(chaves)`                                                | lista fechada por chave (ADR 0002)                                                                                                                                                        | regra do perfil                          |
| `api.buscar_duplicatas_pipeline()`                                              | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.mesclar_familias(familia_fica_id, familia_perde_id, oportunidade_fica_id)` | comercial, diretoria                                                                                                                                                                      | regra do perfil                          |
| `api.vincular_nova_gestacao(familia_id, familia_anterior_id)`                   | comercial, diretoria                                                                                                                                                                      | regra do perfil                          |
| `api.pode_enviar_mensagem(familia_id, categoria, canal)`                        | comercial, enfermeira, financeiro, coordenação, diretoria, só em família que vê                                                                                                           | regra do perfil                          |
| `api.registrar_envio_tarefa(tarefa_id, texto)`                                  | quem responde pela tarefa (regra da RLS de `tarefa`) e vê a família                                                                                                                       | regra do perfil                          |
| `api.pausar_conversa(conversa_id, motivo)`                                      | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.retomar_pausa_conversa(conversa_id)`                                       | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.resolver_transferencia(handoff_id, desfecho)`                              | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.reenviar_notificacao_handoff(handoff_id)`                                  | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.base_conhecimento_listar()`                                                | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.base_conhecimento_salvar(id, tipo, titulo, texto, fonte)`                  | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.base_conhecimento_aprovar(id)`                                             | diretoria                                                                                                                                                                                 | AAL2, sempre                             |
| `api.ultima_ingestao_base()`                                                    | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |
| `api.metricas_agente(desde, ate)`                                               | comercial, coordenação, diretoria                                                                                                                                                         | regra do perfil                          |

Nenhuma das funções da 0017 devolve dado assistencial. Mensagem, tarefa, handoff, conversa e base de conhecimento ganham auditoria pelo gatilho ou pelo log explícito de cada função, com o conteúdo da mensagem como "[oculto]" e HMAC.

## Correções desta verificação

Cada falha foi reproduzida antes da correção e ganhou teste que falha no código antigo.

1. **Comercial baixava um freio pela mesclagem (alta).** A família que sai em `bloqueio_total` (perda) passava o freio à que fica por `privado.acionar_freio`, que abre o "Desfazer" para quem acionou. Quem mesclou chamava `api.desfazer_freio` na família que ficou e ela voltava para `normal`: a Isadora voltaria a vender para uma família em luto, e só a coordenação ou a diretoria podem baixar o freio (PRD 8.3). Correção na 0017: o freio herdado guarda a data e o autor do freio original, o que fecha o "Desfazer" e a justificativa de quem mesclou, e a tarefa de justificativa aberta para ele é cancelada. Testes F1 em `017_api_crm.sql` (três asserções falham na versão anterior).
2. **`historico_sensivel` se perdia na mesclagem (média).** A família que fica não herdava a marca de complicação em gestação anterior, e a Isadora poderia perguntar de novo. Correção na 0017 e teste F2.
3. **Tela de duplicatas nunca mostrava o resultado do banco.** `src/modules/crm/deduplicacao/deteccao.ts` chamava `api.buscar_duplicatas_pipeline` e descartava a resposta, devolvendo sempre `indisponivelNoBanco`. Agora devolve os pares da função; `indisponivelNoBanco` só quando a função não existe. Teste novo `deteccao.supabase.test.ts` (dois de quatro casos falham no código anterior).
4. **`api.ultima_ingestao_base` não existia.** A tela da base de conhecimento chamava e recebia `funcao_pendente`. Criada na 0017 (comercial, coordenação e diretoria; regra do perfil), com grants, entrada no ADR 0002 e no teste 007, e seis asserções F4.
5. Documentação: ADR 0002 (contagem das funções de `api`, linha nova e a regra do freio herdado), ADR 0003 (pendência do P27 fechada), `n8n/IMPORTAR.md` (a rota de captura `/api/teste/uazapi` já existe e só responde em homologação) e o README de `src/modules/crm/deduplicacao`.

### O que foi atacado e ficou de pé

- Varredura das 14 funções da 0017 como `anon`, `service_role`, perfil sem papel, perfil inativo com diretoria, enfermeira, financeiro, marketing e coordenação em AAL1: todas recusam com 42501 (as duas exceções da varredura, `pode_enviar_mensagem` e `registrar_envio_tarefa` com enfermeira, financeiro e marketing, só passaram da porta porque a RLS escondeu o id e a função recebeu nulo; com id de família ou tarefa alheia, o teste 017 prova o 42501).
- IDOR: enfermeira fora da designação em `pode_enviar_mensagem` e `registrar_envio_tarefa`, tarefa de outra pessoa e de outro papel, financeiro sem contrato: recusados.
- `resolver_transferencia` não toca em `conversa`: em `humano_comercial` a conversa continua com o comercial depois de resolvida; só `api.retomar_agente` devolve. `retomar_pausa_conversa` limpa só a pausa.
- `base_conhecimento_aprovar`: só diretoria em AAL2, grava `aprovado_por` e `aprovado_em`; toda edição volta para rascunho sem aprovação.
- `mesclar_familias`: com oportunidade aberta nas duas, a escolhida fica e a outra vai para `perdido` (motivo `outro`, detalhe "mesclada em <id>") por `privado.transicionar`, antes de mover; recusas acontecem antes de qualquer escrita.
- `metricas_agente` devolve só números.

## Contratos conferidos

- `src/`: as 21 funções chamadas por `rpc` e `rpcPendente` existem com os mesmos nomes de parâmetro, e o que o código lê bate com o `jsonb` devolvido. Nenhuma chamada RPC responde mais `funcao_pendente` com o banco atualizado.
- `n8n`: as 43 consultas Postgres dos três JSON foram preparadas (`PREPARE`) no banco local como `n8n_agente`, sem erro; nome, ordem e tipos conferidos contra `pg_get_function_arguments`; `n8n_agente` executa todas; o número de valores de cada `queryReplacement` é o número de `$n` da consulta.

## Ficou de fora

- Preferências de notificação por pessoa (P18 item 3) continuam respondendo `funcao_pendente` ao gravar no modo Supabase: precisam de coluna ou tabela que o PRD 6 não tem. Mudança de modelo passa pelo PRD primeiro.
- Mesclagem com a oportunidade que sai em `nao_qualificado`, `fora_de_cobertura`, `nutricao` ou sessão de venda no pipeline 1: a máquina de estado não prevê a ida para `perdido` a partir desses estágios, então a mesclagem é recusada (22023, nada muda). Pelo PRD 6.10 regra 14 essas oportunidades contam como abertas. [confirmar: Leonardo, se a que sai nesses estágios pode ficar na família mesclada sem transição, como já acontece com `perdido` no pipeline 1]
- `resolver_transferencia` aceita transferência de destino coordenação clínica (saúde, perda) vinda do comercial, como a RLS de `handoff` já permitia (PRD 13: "Conversas do WhatsApp e handoffs", total para o comercial). [confirmar: Edilaine, se só a coordenação e a diretoria resolvem as clínicas]
- "Enviei" grava a mensagem humana sem `wa_message_id`; quando o n8n receber o eco do mesmo envio pelo celular, a conversa fica com as duas linhas. Não é falha de segurança; fica para a sessão do P18b.
- Itens `[confirmar]` do capítulo 22 do PRD: esta sessão não edita o PRD (regra do fechamento). Os três pontos acima e as listas do validador são os candidatos.

## Comandos para testar

```bash
# banco local sem Docker, do zero
PGPORT=54381 PGDATA=/tmp/kz-pg-fech-v supabase/sem-docker/scripts/iniciar.sh
PGPORT=54381 PGDATA=/tmp/kz-pg-fech-v supabase/sem-docker/scripts/testar.sh
KZ_PG_PORTA=54381 node --test n8n/build.test.mjs
PGPORT=54381 pnpm db:types:local   # types.ts sai idêntico ao do repositório

# app
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
PW_PORT=3791 PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e
PW_PORT=3791 PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e:offline
gitleaks detect --no-banner

# JSON de homologação com o config de exemplo, fora do repositório
cp n8n/config.example.json /tmp/kz-n8n-cfg/config-hml.json
node n8n/build.mjs --env hml --config /tmp/kz-n8n-cfg/config-hml.json --saida /tmp/kz-n8n-dist
# importação no n8n 2.40.6 com Node 24 (n8n/referencia/README.md, Validação local)
./validar.sh /tmp/kz-n8n-dist/*.json
node comparar.mjs "/tmp/kz-n8n-dist/kraamzorg-agente-isadora (HML).json"

PGPORT=54381 PGDATA=/tmp/kz-pg-fech-v supabase/sem-docker/scripts/parar.sh
```

Resultado desta rodada: pgTAP 19 arquivos e 2165 testes; n8n 335 de 335 (com a comparação da máscara contra o banco); Vitest 100 arquivos e 1318 testes; e2e 155 aprovados e 1 pulado de propósito (o teste de `humano_comercial` roda só no projeto do computador, estado compartilhado); e2e offline 3 de 3; build, lint (sem erro), Prettier e typecheck limpos; gitleaks sem vazamento. Os três JSON importaram no n8n 2.40.6 sem erro, e o export de volta não mudou nenhum parâmetro.

A prova final continua sendo `supabase test db` com Docker de verdade (CLAUDE.md).

## O que depende de contas de terceiros

- **GitHub (conta dona do repositório):** tornar o repositório privado, transferir para a organização da Kraamzorg, criar `hml` e `main` com proteção e ligar o Secret Scanning (CADEIA-01, `docs/seguranca/revisao-2026-09-25.md`).
- **Supabase (projetos de homologação e produção):** aplicar as migrations 0001 a 0017 e a 0045 depois da revisão humana, definir a senha do papel `n8n_agente` a partir do cofre, criar a chave do HMAC no Vault e rodar `supabase test db` com Docker.
- **n8n de homologação:** instância, credenciais (Postgres pelo pooler com `n8n_agente`, Redis, OpenAI, UAZAPI) e o config do ambiente com os ids reais, fora do git (`n8n/IMPORTAR.md`).
- **OpenAI da Kraamzorg:** modelos `gpt-5.1`, `gpt-4.1-mini` e `text-embedding-3-small` liberados; o teste de fumaça do P25 confirma `aceitaTemperatura`.
- **UAZAPI:** instância de teste (nunca o número real enquanto a conta estiver restrita, T-01) e o webhook apontado para o fluxo 3.
- **Meta (Cloud API):** credencial e modelos aprovados para o P18b; a produção da Isadora depende disso (PRD 22.1).
- **Storage de marketing:** URL pública do bucket para `storage.urlPublicaMarketing`, ou a `url` completa em `parametro.pdf_apresentacao`.
- **Vercel e Resend:** projeto de homologação com `NEXT_PUBLIC_APP_ENV=homologacao` (a rota de captura só responde assim) e a conta de e-mail de reserva das notificações.
