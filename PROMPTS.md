# PROMPTS.md · Kraamzorg OS

Sequência de sessões do Claude Code, do repositório vazio ao aceite final. Cada prompt é uma sessão (às vezes duas) com um objetivo só. A ordem respeita as dependências do PRD: banco antes de tela, freio antes de automação, fronteira do agente antes dos fluxos n8n.

Versão 1 · 24/09/2026 · acompanha o PRD v4.1

## Como usar

Em cada sessão nova do Claude Code, na raiz do repositório:

> Leia o CLAUDE.md e execute o P07 do PROMPTS.md.

Regras de uso:
- Um prompt por sessão. Limpe o contexto entre sessões (`/clear`).
- Nos prompts marcados com **plano primeiro**, peça o plano em modo de planejamento, revise e só então libere a execução.
- Todo prompt que cria migration para antes do `db push` e espera revisão humana do SQL (CLAUDE.md).
- A sessão termina com o relatório em `docs/sessoes/PNN.md`. A próxima sessão lê o relatório anterior antes de começar.
- Se o prompt pedir algo que o PRD não cobre ou contradiz, a sessão para e o PRD é atualizado primeiro.
- "Ler" lista o que a sessão precisa abrir antes de codar. "Fora de escopo" existe para a sessão não crescer.

Os três arquivos JSON do n8n saem dos prompts P24 (fluxo 2), P25 (fluxo 3) e P26 (fluxo 1), gerados por script a partir do repositório. Os fluxos da Enjoy em `n8n/referencia/` servem só como referência de formato de nó; a lógica é a do capítulo 19 do PRD.

## Calendário

O cronograma do contrato coloca o aceite das Fases 0 e 1 em 02/10. São 34 sessões até lá (P00 a P33), e entre 24/09 e 02/10 cabem umas 14, com duas pessoas trabalhando em paralelo e uma sessão por dia cada. Além disso, três itens de terceiros travam o aceite da Fase 1 do jeito que o PRD define (16.2: família fictícia do primeiro contato no WhatsApp até o pagamento confirmado): a conta do WhatsApp está restrita desde 24/09 (T-01), a credencial da InfinitePay ainda está em avaliação (T-06) e a Autentique precisa de conta em nome da Kraamzorg. A cláusula 3.4 do contrato prevê o ajuste quando item de terceiro atrasa.

A proposta abaixo mantém a entrega final em 19/11, move o aceite das Fases 0 e 1 para 21/10 e o da Fase 2 para 04/11. A Fase 3 tinha quatro semanas e cabe em duas com duas trilhas, porque os módulos dela dependem pouco uns dos outros.

| Semana | Datas | Cronograma do contrato | Prompts na proposta |
| :-- | :-- | :-- | :-- |
| S3 | 24 e 25/09 | Fases 0 e 1 | P-1, P00, P01 |
| S4 | 28/09 a 02/10 | Aceite das Fases 0 e 1 em 02/10 | P02 a P09 (banco) e P10 a P12 (interface) |
| S5 | 05 a 09/10 | Fase 2 | P13 a P20 (CRM) e P21 a P23 (agente) |
| S6 | 13 a 16/10 (curta) | Aceite da Fase 2 em 15/10 | P29 a P32 (venda) e P24 a P26 (fluxos n8n) |
| S7 | 19 a 23/10 | Fase 3 | P27, P28 e P33 (aceite das Fases 0 e 1 em 21/10), P34 a P36 |
| S8 | 26 a 30/10 | Fase 3 | P37 a P41 |
| S9 | 03 a 06/11 (curta) | Fase 3 | P42 a P44 (aceite da Fase 2 em 04/11), P45 e P46 |
| S10 | 09 a 13/11 | Congelamento em 13/11 | P47 a P52 |
| S11 | 16 a 19/11 | Aceite final em 19/11 | P53 e P54 |

Com uma pessoa só, a data final também escorrega. Vale decidir isso com o Leonardo agora, com o bloqueio do WhatsApp registrado por escrito.

Trilhas em paralelo (duas pessoas, ou duas sessões do Claude Code em branches separados):
- Depois do P07, a trilha de interface (P10 a P12) corre junto com o fim do banco (P08 e P09).
- Depois do P20, a trilha do agente (P21 a P28) corre junto com a trilha de venda (P29 a P32).
- Migrations de trilhas diferentes nunca vão para o banco ao mesmo tempo. Quem for aplicar faz rebase, roda `supabase db reset` local e só então pede revisão.

Caminho crítico e bloqueios externos:

| Bloqueio | Trava | Situação em 24/09 | Plano B |
| :-- | :-- | :-- | :-- |
| Conta do WhatsApp restrita (T-01) | Isadora em produção | Restrita desde 24/09 | Construir e homologar com número de teste. Avaliar API oficial num número novo só para o agente. |
| Credencial InfinitePay (T-06) | Baixa automática (P32) | Em avaliação | Adaptador pronto com `payment_check` simulado nos testes; baixa manual com comprovante até liberar. |
| Autentique em nome da Kraamzorg | Contrato (P31) | Não solicitado | Sandbox da Autentique em homologação. |
| Certificado A1 e provedor de NFS-e (T-05) | NFS-e (P43) | A Kraamzorg nunca emitiu A1; SP muda para o Emissor Nacional em 01/11 | Emissão manual pela contadora até homologar. |
| Parecer jurídico do registro (O-04) | Retenção e assinatura | Pendente | Padrão prontuário (PRD 21.3). |
| Aprovações da Edilaine ([clínico]) | Instrumentos e alertas (P34, P40) | Parcial | Itens clínicos entram desligados até aprovação. |

---

## P-1 · Antes da primeira sessão (checklist humano)

Responsável: Drop, com o Leonardo nos itens de conta. Nada aqui é tarefa do Claude Code.

Contas, todas em nome da Kraamzorg (D-12), com credenciais só no cofre de senhas:
1. GitHub: organização da Kraamzorg, repositório privado `kraamzorg-os`, Drop como colaboradora, proteção da `main` (pull request e CI verde).
2. Supabase: organização da Kraamzorg no plano Pro, projetos `kraamzorg-hml` e `kraamzorg-prod` na região `sa-east-1`, MFA ligado na conta.
3. Vercel: time da Kraamzorg no plano Pro, projeto ligado ao repositório, funções em `gru1`.
4. Cloudflare: zona do domínio (o site pode continuar na Hostinger), subdomínio do app definido [confirmar], chaves do Turnstile.
5. Resend: domínio de envio com SPF, DKIM e DMARC.
6. OpenAI: projeto em nome da Kraamzorg com limite de gasto; conferir acesso aos modelos do PRD 19.1.
7. Autentique: conta da Kraamzorg, token de API e acesso ao sandbox.
8. InfinitePay: InfiniteTag e confirmação de que o Checkout por API está liberado.
9. UAZAPI: instância de homologação com chip de teste. A instância do número oficial só depois do T-01.
10. n8n: acesso à instância, credenciais criadas com os nomes do PRD 19.1 ("Postgres Kraamzorg Agente", "Redis Drop", "OpenAI Kraamzorg", "UAZAPI Kraamzorg"), versões dos nós anotadas.
11. Sentry: projeto com limpeza de dados pessoais.

Material:
12. PDF leve da apresentação (até 3 MB), com o Gemelar Essencial em R$ 5.400 (T-04).
13. Logos oficiais em SVG e PNG, da pasta de identidade visual.
14. Confirmação da licença web das fontes Codec Pro e TT Drugs (T-07). Até lá, Jost e Inter.
15. Referência do n8n: exportar da instância um fluxo de amostra com um nó de cada tipo usado no capítulo 19 (Webhook, Code, If, Switch, Set, HTTP Request, Postgres, Postgres Tool, Redis, Wait, Split Out, Split in Batches, Schedule Trigger, Manual Trigger, Execute Workflow Trigger com entradas, Execute Workflow, Tool Workflow, AI Agent, OpenAI Chat Model, Embeddings OpenAI, PGVector nos modos inserir e recuperar como ferramenta, Default Data Loader, Postgres Chat Memory, Chat Memory Manager, Sticky Note). Salvar como `n8n/referencia/amostra-nos.json` junto com os três JSON da Enjoy, depois de conferir que nenhum deles tem token, URL de projeto ou ID de credencial real.

16. Perguntas da pesquisa de satisfação atual (Google Forms, item 9 do briefing) transcritas em `docs/referencia-pesquisa.md`, para o P42.

Decisões que destravam sessões:
17. Leonardo aprova `docs/aprovacao/ajustes-prompt-isadora.md` antes do P28.
18. Edilaine aprova os itens clínicos do mesmo documento (G, H, I, J e L) antes de a Isadora ir para produção. Os textos de internação e de sofrimento emocional ficam desligados por parâmetro até lá. O Apêndice B do PRD precisa da aprovação dela antes do P40.
19. Registrar por escrito os bloqueios de terceiros da tabela acima (cláusula 3.4).

---

# Fase 0 · Fundação

## P00 · Repositório, esqueleto e CI

Fase 0 · S3 · depende de P-1 (itens 1 a 4)
Ler: PRD 1, 4 e 5; CLAUDE.md

Objetivo: repositório pronto para as próximas sessões, sem nenhuma funcionalidade.

Fazer:
1. Next.js com App Router na versão estável mais recente, TypeScript estrito (com `noUncheckedIndexedAccess`), pnpm, ESLint, Prettier, Tailwind v4, shadcn/ui inicializado com cores em variáveis CSS, lucide-react.
2. Estrutura de pastas do PRD 5.3, com um README de três linhas em cada módulo dizendo o que mora ali.
3. Na raiz: PRD.md, CLAUDE.md e PROMPTS.md entregues. Em `docs/`: as análises, a referência clínica e a pasta `aprovacao/`, mais `docs/sessoes/` e `docs/adr/0001-stack.md` registrando D-13 e D-14. Em `n8n/prompts/`: os cinco prompts entregues.
4. Vitest com Testing Library; Playwright com projetos celular (390 × 844) e computador; scripts `test`, `e2e`, `e2e:offline` (vazio por enquanto), `lint`, `typecheck`, `format`.
5. GitHub Actions: lint, typecheck, test, build e gitleaks em todo pull request para `hml` e `main`. Um job de `supabase test db` entra desligado e é ligado no P01. Dependabot semanal. Branches `hml` (integração e homologação) e `main` (produção), as duas protegidas.
6. `.env.example` com todas as variáveis que o projeto vai usar (Supabase, Resend, OpenAI, Autentique, InfinitePay, Turnstile, Sentry, segredo interno de cron), sem valor. `.gitignore` cobrindo `.env*`, `n8n/config.*.json` (menos o example), `n8n/dist/` e `supabase/.temp`.
7. Página inicial provisória com o nome do sistema.

Fora de escopo: banco, autenticação, telas.

Aceite: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes local e na CI; gitleaks verde; estrutura igual ao PRD 5.3.

## P01 · Supabase local, extensões e testes de banco

Fase 0 · S3 · depende de P00 · **plano primeiro**
Ler: PRD 5.1, 5.5, 6.0 e 6.10 (regra 11)

Objetivo: banco local que sobe limpo e um jeito confiável de testar regra de banco.

Fazer:
1. `supabase init`. Configuração local com MFA TOTP habilitado. Anotar em `docs/runbooks/ambientes.md` o que só se configura no painel dos projetos hml e prod (tempo de sessão de 8 horas, MFA, backups).
2. Migration de extensões e schemas do PRD 6.0, incluindo `agente_n8n`, `assistencial`, o schema `api` e `privado.sem_acento()`. Conferir que nenhum papel além do dono tem `create` em `public`. Revogar o `execute` padrão de `public` em funções de todos os schemas (`alter default privileges`).
3. PostgREST expondo só `public` e `api` (configuração do Supabase local e anotação para hml e prod no runbook de ambientes), como manda o PRD 5.2.
4. pgTAP: `supabase/tests/000_harness.sql` com funções auxiliares para simular o JWT de cada papel e o nível de autenticação (`aal1` e `aal2`) e um teste de sanidade das extensões e schemas.
5. `src/lib/db/`: cliente de servidor (cookies e RLS) e cliente de serviço (`service_role`) protegido com `import 'server-only'`, mais o script `pnpm db:types`.
6. Ligar o job de `supabase test db` na CI.

Fora de escopo: tabelas.

Aceite: `supabase db reset` sobe limpo; `supabase test db` verde local e na CI. Parar para revisão do SQL.

## P02 · Migration 1: enums, configuração, usuários, família e pessoas

Fase 0 · S4 · depende de P01 · **plano primeiro**
Ler: PRD 5.2, 6.0 a 6.2 e 6.10

Objetivo: primeira metade do modelo de dados, igual ao PRD.

Fazer:
1. Todos os enums do 6.0 numa migration só.
2. Tabelas do 6.1 e 6.2 exatamente como no PRD, com `perfil` e `usuario_papel` criadas primeiro, porque `criado_por` aponta para `perfil`. Onde aparece `-- padrão`: `id uuid primary key default gen_random_uuid()`, `criado_em` e `atualizado_em` com `now()`, `criado_por uuid` com referência a `perfil`.
3. Função `privado.tocar_atualizado_em()` e gatilho em toda tabela com `atualizado_em`.
4. Índice em toda chave estrangeira.
5. RLS ligada em todas as tabelas, sem política. Tudo fica negado até o P07.
6. Função `public.ig(dpp date, data date)` imutável, que devolve semanas e dias como inteiros e o texto no formato `38s2d` (PRD 6.10, regra 7).
7. `comment on` em tabelas e colunas com o texto do PRD.

Fora de escopo: políticas de acesso, dados.

Aceite: pgTAP confere RLS ligada em toda tabela e colunas padrão em todas menos as exceções do PRD 5.2, e testa `ig()` com três casos, um deles com a DPP no passado. Parar para revisão do SQL.

## P03 · Migration 2: comercial, conversa, handoff, tarefas e linha do tempo

Fase 0 · S4 · depende de P02 · **plano primeiro**
Ler: PRD 6.3 e 6.4

Fazer:
1. Tabelas do 6.3 e 6.4 como no PRD, com a exclusão de vigência sobreposta em `pacote_versao` e o índice único parcial de `oportunidade`.
2. `evento_familia` append-only: `update` e `delete` revogados e recusados por gatilho.
3. Índices, comentários e RLS ligada, como no P02.

Aceite: pgTAP recusa duas versões vigentes do mesmo pacote na mesma data, duas oportunidades abertas para a mesma família e qualquer update em `evento_familia`. Parar para revisão do SQL.

## P04 · Migration 3: operação, assistencial, alertas, automações, auditoria, sincronização e agente

Fase 0 · S4 · depende de P03 · **plano primeiro**
Ler: PRD 6.5 a 6.9

Fazer:
1. Tabelas do 6.5 ao 6.8, na ordem que resolve as referências (`mensagem_modelo` antes de `regua_faixa` e `termo_alerta`).
2. Tabelas `agente_n8n.documentos` e `agente_n8n.chat_memoria` com os índices do PRD. Grants e políticas para o papel do n8n ficam para o P21.
3. Coluna `versao` com gatilho de incremento nas tabelas da regra 13 do PRD 6.10, e `sessao_venda_gravacao` separada de `sessao_venda`.
4. View `familia_elegivel_marketing` do 6.9. A `ocupacao_projetada` fica para o P19.
5. Índices, comentários e RLS ligada.

Aceite: `supabase db reset` limpo; pgTAP confirma que todas as tabelas do PRD existem com RLS ligada. Parar para revisão do SQL.

## P05 · Auditoria imutável, leitura auditada e máscara de documentos

Fase 0 · S4 · depende de P04
Ler: PRD 5.2, 6.10 (regras 4 e 6), 13 (regras de implementação) e 21.2

Fazer:
1. `log_auditoria` sem `update`, `delete` e `truncate` para todos os papéis, com gatilho de recusa como segunda barreira.
2. Gatilho genérico `privado.auditar()` em todas as tabelas de negócio: grava as colunas alteradas, `auth.uid()` e a origem lida de `app.origem`, com as colunas sensíveis (lista por tabela: CPF, endereços, fichas clínicas, `dados` do registro, transcrições, conteúdo de mensagem, resumo da sessão) trocadas por "[oculto]" e um hash (PRD 13). Ficam de fora `log_auditoria`, `fila_sincronizacao`, `mensagem`, `evento_familia` e o schema `agente_n8n`. Leitura do log só pela diretoria, por função.
3. `registro_atendimento` e `registro_adendo` sem `update` e `delete`, com gatilho de recusa.
4. Padrão de leitura auditada no schema `assistencial`: uma função de exemplo (`assistencial.ler_acompanhamento(familia_id)`) que grava `leitura` em `log_auditoria` antes de devolver, com teste. As outras nascem com cada módulo.
5. `privado.mascarar_documentos(texto)`: CPF com ou sem pontuação cujos dígitos verificadores batem vira "[CPF ocultado]"; número de 13 a 19 dígitos que passe no algoritmo de Luhn e não tenha formato de telefone (+55, DDD e 9 dígitos) vira "[cartão ocultado]". Essa é a definição de referência que o n8n copia (PRD 19.5).

Aceite: pgTAP mostra update e delete recusados em log e registro para `authenticated` e `service_role`; leitura pela função gera linha no log; o log de uma mudança de CPF mostra "[oculto]"; máscara testada com 12 casos (CPF formatado, CPF corrido válido, 11 dígitos com verificador errado, celular com DDD, telefone E.164, cartão válido, 16 dígitos que não passam no Luhn).

## P06 · Máquinas de estado (invariante 1)

Fase 0 · S4 · depende de P05 · **plano primeiro**
Ler: PRD 7 inteiro

Fazer:
1. Tabela `privado.transicao_permitida (maquina, de, para, automatica, papel_minimo)` com as transições do capítulo 7 para as máquinas `p1`, `p2`, `acompanhamento`, `visita` e `p4`, incluindo as regras especiais: desvios do P1, reabertura quando a família volta a escrever, passagem de `qualificado` e `nutricao` direto para `proposta_enviada` no P2, `bebe_nasceu` a partir de qualquer estado depois de `pagamento_confirmado` e saída de `intercorrencia` só com coordenação.
2. `privado.tem_papel(papel)` lendo `usuario_papel`, como `security definer` (senão a política de `usuario_papel` entra em recursão).
3. `privado.transicionar(maquina, entidade_id, para, motivo)`: valida transição e papel, liga `app.transicao` só naquela transação, grava o novo estado, registra `evento_familia` e auditoria.
4. Gatilho que recusa update direto em `oportunidade.estagio_p1`, `oportunidade.estagio_p2`, `acompanhamento.estado`, `visita.estado` e `pos_venda.estagio` quando `app.transicao` não veio da função.
5. Tabela do 7.1 (status do prompt e onde vivem no banco) em comentário da função.

Aceite: pgTAP do invariante 1 passa por todas as transições permitidas, recusa uma amostra das proibidas, recusa update direto e só deixa sair de `intercorrencia` com papel de coordenação.

## P07 · Autenticação, papéis, MFA e permissões (invariante 2)

Fase 0 · S4 · depende de P06 · **plano primeiro**
Ler: PRD 13, 21.1, 21.2 e 5.1 (autenticação)

Fazer:
1. `perfil` criado a partir de `auth.users`; papéis em `usuario_papel`, que só a diretoria altera.
2. `privado.aal2()` e `privado.familias_atribuidas()` (famílias com designação aceita da profissional logada, `security definer`).
3. `docs/adr/0002-permissoes.md` com a matriz tabela por tabela, incluindo as tabelas que o capítulo 13 cita no fim (consulta pré-natal, ocorrência privada, evento restrito, log, tarefa, notificação, mensagens, base de conhecimento, profissionais, fila de sincronização, gravação da sessão). O Leonardo aprova antes das políticas.
4. Políticas RLS para todas as tabelas conforme o ADR. AAL2 exigido em tabelas assistenciais, financeiras e em `pessoa_dados_contrato`. `sessao_venda_gravacao` só para quem conduziu e para a diretoria.
5. Schema `api` com os wrappers que o app chama por RPC (cada um `security definer`, checando papel e AAL) e as funções de recorte: `api.familias_do_dia()` e `api.ficha_assistencial(familia_id)` para a enfermeira, `api.marketing_*()` com agregados para o marketing.
6. Telas: login, cadastro do MFA com QR, desafio do MFA, esqueci a senha, convite de usuário pela diretoria. Middleware que exige AAL2 para os papéis que precisam.
7. Tela de sessões para a diretoria com revogação de todas as sessões de um usuário.
8. Um usuário de teste por papel, só no seed local.

Fora de escopo: telas de negócio.

Aceite: pgTAP do invariante 2 cobre cada linha do ADR com JWT simulado por papel, em `aal1` e `aal2`, inclusive a enfermeira sem acesso a coluna comercial e o marketing sem acesso à tabela `familia`; Playwright faz login com MFA no celular.

## P08 · Seed sintético, parâmetros e textos em rascunho

Fase 0 · S4 · depende de P07
Ler: PRD 3, 9.3, 10.1, 10.3, 11.3, 11.4, 11.11, 16.3 e 23; `docs/analise-evolucoes.md` (seção 3)

Objetivo: `supabase/seed.sql` com tudo o que as próximas sessões precisam ver funcionando. Só dado sintético.

Fazer:
1. Regiões e localidades do 3.3 com taxas em centavos. Localidades conhecidas viram linhas próprias em `cidade` com aliases: Alphaville (sem taxa), Granja Viana (R$ 350), Santo André, São Bernardo do Campo e São Caetano do Sul (R$ 350, `requer_confirmacao`), Apucarana (R$ 1.000), Arapongas (R$ 600). Barueri, Santana de Parnaíba e Cotia fora dessas localidades ficam com `requer_confirmacao`. Campinas e Sorocaba como não atendidas. Tabela `municipio` com a lista do IBGE e a região intermediária, gerada por `scripts/baixar-municipios.mjs` (API de localidades do IBGE) e guardada em `supabase/dados/municipios_ibge.csv`.
2. Os cinco pacotes reais com a versão vigente desde 01/03/2026 e uma versão anterior fictícia, encerrada, com valores claramente fictícios.
3. Condições comerciais: 3x sem juros e Pix 5% com `requer_aprovacao` (C-04).
4. Todos os parâmetros do PRD: os do agente (6.8, com `agente_modo = teste`, `pdf_reenvio_janela_horas = 0`, `taxa_visivel_agente`, `alerta_internacao_ativo` e `alerta_emocional_ativo` falsos, `validador_listas` com as listas de palavras evitadas, promessas e escassez do prompt da Isadora), `score_pesos`, cortes 70 e 40, capacidade 85%, janela de DPP de −21 a +14 dias, `handoff_matriz` com a tabela do 11.4, expediente comercial [confirmar], retenção de áudio de 90 dias (O-03), prazos do relatório.
5. `mensagem_modelo` com todos os textos do capítulo 23 e os textos padrão da evolução (seção 3 da análise), com variáveis listadas e chaves das evoluções com prefixo `evo_`. Status conforme o PRD 6.8: `alerta_saude`, `perda` e `fallback_confirmar` aprovados; o resto em rascunho; no seed de homologação, todos aprovados para os testes rodarem.
6. `regua_faixa` do 10.3 e `termo_alerta` do 11.11: os dez termos aprovados ativos, os sinônimos propostos inativos, com ação e mensagem.
7. `automacao` com o catálogo do 10.1: as de Fase 1 ativas, as de Fase 2 e 3 inativas.
8. `regra_alerta` com as regras do DOC 3 (PU-01 a AM-06) e condições só onde o Apêndice B cita o DOC 3 como fonte. As demais ficam com `condicao` nula e inativas até a Edilaine aprovar.
9. Dados do 16.3: cinco profissionais fictícias, doze famílias em todos os estágios (uma gemelar, uma em `bloqueio_total`, uma em `atencao`), um acompanhamento com seis visitas e registros, um alerta imediato fechado com conduta e conversas fictícias para cada modo do agente. Nomes do tipo "Família Teste Aurora" e telefones da faixa +55 11 90000-0000.
10. `pnpm seed:check`: falha se o seed tiver nome ou telefone fora do padrão fictício.

Fora de escopo: definições JSON dos instrumentos (P34).

Aceite: `supabase db reset` popula tudo; pgTAP confere uma versão vigente por pacote e que toda `mensagem_chave` de `regua_faixa` e `termo_alerta` existe; `seed:check` verde.

## P09 · Freio global (invariante 3, parte do banco)

Fase 0 · S4 · depende de P08 · **plano primeiro**
Ler: PRD 8 inteiro, 6.9 e 10 (introdução)

Fazer:
1. `privado.pode_executar(familia_id, automacao_id)` com a matriz do 8.2. No aborto, grava `automacao_execucao` com `abortada_freio` e o estado no motivo.
2. `privado.pode_enviar_mensagem(familia_id, categoria)` devolvendo `{pode, motivo}`: freio, `nao_contatar`, conversa iniciada pela família quando o canal for `uazapi`, uma mensagem de conteúdo por dia e janela de horário do parâmetro.
3. `privado.acionar_freio(familia_id, estado, motivo)`: qualquer papel com acesso à família aciona, motivo pode vir depois (cria tarefa de justificativa), reavalia na hora as execuções agendadas e registra evento restrito. `privado.reverter_freio(...)` só com coordenação ou diretoria e justificativa.
4. Conferir que `familia_elegivel_marketing` exclui estados sensíveis, `nao_contatar` e famílias mescladas.

Aceite: pgTAP do invariante 3 cobre as 16 combinações de categoria e estado, a execução agendada abortada quando o estado muda antes do envio e a reversão recusada sem papel.

## P10 · Casca do app e design system

Fase 0 · S4 · depende de P07 · trilha de interface
Ler: PRD 20 inteiro; CLAUDE.md (design e texto de interface)

Fazer:
1. Tokens do 20.2 no `@theme` de `globals.css`, tema do shadcn apontando para eles, fontes com `next/font` (Jost, Inter, IBM Plex Mono), logo de `/public/brand`.
2. Componentes base: botão, campos, seleção, caixa de marcação, cartão, selo de estado (com a cor `sensivel`), aviso, diálogo e painel lateral, tabela que vira lista no celular, estado vazio com próxima ação, indicador de sincronização de três estados, cabeçalho da família com espaço para o botão de freio, formatadores (R$, datas, `38s2d`).
3. Casca por papel: abas inferiores no celular (20.4) e barra lateral agrupada no computador (Comercial, Operação, Experiência, Gestão, Sistema). Rotas vazias com estado vazio.
4. Página `/design-system` só em desenvolvimento e homologação.
5. Acessibilidade: foco visível, área de toque de 44 px, contraste AA, teste com axe no Playwright.
6. Teste que falha se aparecer cor em hexadecimal fora de `globals.css`.

Aceite: Playwright no celular e no computador mostra a navegação certa por papel; axe sem violação grave; teste de cores verde.

## P11 · App instalável e instalação guiada

Fase 0 · S4 · depende de P10 · trilha de interface
Ler: PRD 4 (D-01 e D-02), 15 e 15.1

Fazer:
1. Serwist: manifest (nome, ícones da marca, tema marinho, fundo creme, `standalone`), service worker com página offline e espaço reservado para o cache do portal da enfermeira.
2. Tela `/instalar` que reconhece Android com Chrome, iPhone com Safari, iPhone em outro navegador (orienta abrir no Safari) e computador, com passo a passo curto e botão de instalar quando o navegador oferecer.
3. Pedido de armazenamento persistente depois do login da enfermeira.
4. Web Push com VAPID. Antes da migration, acrescentar ao PRD 6.7 a tabela `inscricao_push (usuario_id, endpoint, chaves, criado_em)`.
5. Guia de uma página para as enfermeiras em `docs/guias/instalar-app.md`.

Aceite: Lighthouse reconhece como instalável; teste manual em Android e iPhone registrado no relatório da sessão.

## P12 · Motor offline e sincronização (invariante 4)

Fase 0 · S4 · depende de P11 · trilha de interface · **plano primeiro**
Ler: PRD 4 (D-03), 15, 6.7 (`fila_sincronizacao`) e 16.1

Fazer:
1. `src/lib/sync` com Dexie: rascunho por campo, fila, cache das famílias do dia e das regras de alerta. Id gerado no aparelho. Salvar um campo grava local e entra na fila no mesmo instante.
2. Rota `POST /api/sync` idempotente pelo id do item, aplicada na ordem de criação, com conflito resolvido por versão, original preservado em `conflito` e origem `sync` no log. Registro assistencial nunca é sobrescrito: divergência vira adendo.
3. Estado de sincronização na interface (rascunho local, enviando, sincronizado) com reenvio e espera crescente; envio ao voltar a conexão ou o foco. Conflito comparado pela coluna `versao` (PRD 6.10, regra 13).
4. Cache do dia com validade de 24 horas, apagado no logout e quando a sessão foi revogada, depois de subir o que estiver na fila (PRD 15).
5. Formulário de demonstração em `/dev/sync`.
6. Testes do invariante 4: Vitest com IndexedDB falso (ordem, idempotência, conflito) e Playwright com a rede desligada (preenche offline, religa, confere no banco).

Aceite: invariante 4 verde local e na CI.

## P13 · Configurações

Fase 0 · S5 · depende de P10 e P08
Ler: PRD 5.2, 13 (parâmetros e configurações), 10.3, 11.3 e 23

Fazer (diretoria vê tudo; coordenação só termos de alerta e instrumentos):
1. Parâmetros, com validação por tipo de parâmetro e histórico vindo do log.
2. Pacotes e versões: preço novo sempre cria versão com vigência. Versão ligada a contrato não se edita.
3. Regiões e localidades: taxa, `requer_confirmacao`, aliases.
4. Condições comerciais.
5. Mensagens: lista por destinatário, edição com prévia das variáveis, contagem de caracteres, aviso e troca automática de travessão por vírgula, fluxo de rascunho para aprovado com registro de quem aprovou.
6. Termos de alerta (coordenação): ativar, desativar, ação e mensagem.
7. Faixas da régua.

Aceite: e2e em que a diretoria cria nova versão de preço e o contrato antigo continua na versão anterior; texto aprovado registra aprovador; coordenação não vê preços.

## P14 · Ambientes, deploy, domínio, backup e observabilidade

Fase 0 · S5 · depende de P13 (pode correr em paralelo a partir do P10)
Ler: PRD 5.5, 21.2, 21.3 e 21.4

Fazer:
1. Vercel com variáveis por ambiente, preview por pull request ligado ao Supabase de homologação, branch `hml` para homologação e `main` para produção. Promoção de `hml` para `main` só depois do aceite, com migrations revisadas.
2. Homologação com migrations (depois de revisadas) e seed sintético. Produção com migrations e só dados reais de configuração (pacotes, localidades, parâmetros, textos aprovados), por migration de dados separada e revisada.
3. Cloudflare: registro do app apontando para a Vercel em modo "DNS only", registros do Resend, Turnstile.
4. Cabeçalhos de segurança (CSP com nonce, HSTS, `frame-ancestors 'none'`, `referrer-policy`, `permissions-policy`).
5. Sentry com limpeza de nome, telefone, e-mail, CPF e conteúdo de mensagem.
6. Runbooks: `docs/runbooks/ambientes.md`, `restauracao.md` (teste mensal num projeto temporário) e `incidente.md` (comunicação em 24 horas, cláusula 10.4).
7. Rota `/api/saude` que confere o cron das 7h, os webhooks e as últimas falhas.

Aceite: preview de pull request abre em homologação com login e MFA; produção configurada sem nenhum dado de família; runbooks escritos.

---

# Fase 1 · Comercial e agente

## P15 · Pipelines 1 e 2

Fase 1 · S5 · depende de P06, P08 e P10
Ler: PRD 7.1, 7.2, 20.4 e 20.5

Fazer:
1. Tela de pipeline: lista agrupada por estágio no celular, kanban no computador. Filtros por região, responsável, classificação e semanas; busca por nome e telefone.
2. Mudança de estágio pela server action que chama `api.transicionar` (wrapper de `privado.transicionar`). Só aparecem as transições permitidas. Perda exige motivo (`motivo_perda`) e detalhe.
3. Cartão da oportunidade: nome, semanas calculadas, cidade, estágio, tempo no estágio, próximo contato e sinais (apresentação enviada, transferência aberta, estado sensível na cor própria).
4. Cadastro manual de lead pelo comercial: família, pessoa e oportunidade com origem.

Aceite: e2e leva um lead de `novo` a `sessao_venda_agendada` no celular; transição proibida não aparece na tela e o banco recusa se for forçada.

## P16 · Ficha 360º e estado sensível

Fase 1 · S5 · depende de P15 e P09
Ler: PRD 6.2, 6.10 (as quatro datas), 8.3 e 20.4

Fazer:
1. Ficha com resumo (as quatro datas com "estimativa" e "fato", semanas, cidade, pacote, estágio), linha do tempo (`evento_familia`, com os restritos só para quem pode), pessoas, comercial, conversas do WhatsApp (leitura para comercial, coordenação e diretoria) e estado sensível.
2. Botão de freio em um toque no cabeçalho de todas as telas da família: escolhe `atencao` ou `bloqueio_total`, sem justificativa prévia, cria a tarefa de justificativa. Reversão só com coordenação ou diretoria e justificativa. Cor `sensivel`.
3. Marcar "não contatar" com motivo.
4. Registro das datas de nascimento e alta (as automações delas chegam no P36).
5. Dados de contrato mascarados, com botão "mostrar" que exige AAL2 e grava a leitura no log.

Aceite: e2e no celular aciona o freio em um toque; a família some de `familia_elegivel_marketing`; a linha do tempo mostra o evento; comercial não vê evento restrito.

## P17 · Deduplicação, mesclagem e pontuação de leads

Fase 1 · S5 · depende de P16
Ler: PRD 6.10 (regra 2) e 7.1 (pontuação)

Fazer:
1. Duplicata certa por telefone normalizado; duplicata provável por similaridade de nome (`pg_trgm`, limiar em parâmetro) com DPP a até 14 dias.
2. Tela de mesclagem lado a lado. A mesclagem move conversas, mensagens, tarefas e oportunidades, marca `mesclada_em_id` e grava auditoria. Os eventos não se movem (`evento_familia` é append-only): a linha do tempo junta os da família mesclada por `mesclada_em_id`. Confirmação clara, porque não há desfazer. Mesmo telefone com DPP muito distante sugere vínculo de nova gestação (regra 12), não mesclagem.
3. `privado.calcular_score(familia_id)` com os pesos de `parametro.score_pesos` e os cortes de classificação, recalculado a cada dado novo e no cron diário.

Aceite: pgTAP da pontuação com três perfis (quente, morno, frio); e2e de mesclagem preservando o histórico.

## P18 · Mensageria, tarefas e notificações internas

Fase 1 · S5 · depende de P09 e P13
Ler: PRD 4.1 (D-08), 8.2, 6.4 (`tarefa`), 6.7 (`notificacao`), 23.2 e 23.3

Fazer:
1. `src/lib/messaging` com a interface do mensageiro e três implementações: `manual` (tarefa com link `wa.me` e texto pré-preenchido), `uazapi` (só em conversa iniciada pela família e para os grupos internos, com `track_source: "kraamzorg-app"`) e `cloud_api` (preparada, sem uso). Toda chamada passa por `pode_enviar_mensagem`.
2. Tela de tarefas no início do comercial, por prioridade e vencimento. A tarefa mostra o texto sugerido editável, o botão "Abrir no WhatsApp" e o botão "Enviei", que grava `mensagem` com `enviado_por = humano` e avança a régua ou a cadência.
3. Notificações internas: central no app, push, mensagem nos grupos da equipe pela UAZAPI com os modelos do 23.3 e e-mail pelo Resend como reserva. Preferências por usuário.
4. Rota interna `POST /api/interno/notificar` protegida por segredo, para o banco chamar via `pg_net`.

Aceite: tarefa da régua do seed aparece com o link certo; "Enviei" registra a mensagem; família em `bloqueio_total` não gera link.

## P19 · Ocupação projetada e recálculo diário

Fase 1 · S5 · depende de P08
Ler: PRD 3.4, 10.2 e 6.9

Fazer:
1. `ocupacao_projetada` (view ou função com `security_invoker`): para cada contrato ativo, início distribuído de forma uniforme na janela da DPP (parâmetros), dias de atendimento somados por semana e região, divididos pela capacidade (limite de famílias vezes dias). Saída: região, semana (segunda-feira), ocupação em %, famílias.
2. `privado.recalculo_diario()` no `pg_cron` às 10:00 UTC (7h em Brasília), com cada módulo registrando a própria etapa (o que ainda não existe fica como etapa vazia) e o resultado gravado.
3. `privado.disponibilidade(dpp, regiao)` devolvendo `disponivel` quando as semanas prováveis estão abaixo do limite de alerta, e `confirmar_com_equipe` no resto. É a base da ferramenta do agente.
4. Radar simples com as próximas 8 semanas por região para diretoria e coordenação.

Aceite: pgTAP com cenário sintético de São Paulo confere os percentuais; cron registrado e visível em `/api/saude`.

## P20 · Motor de automações e régua de nutrição

Fase 1 · S5 · depende de P18, P19 e P09 · **plano primeiro**
Ler: PRD 10 inteiro, 8.2 e 4.1

Fazer:
1. `privado.processar_automacoes()` a cada 5 minutos no `pg_cron`: materializa execuções devidas (tempo, evento, data), chama `pode_executar`, aplica as ações de banco (tarefa, transição, alerta, notificação) e manda as externas por `pg_net` para `/api/interno/automacao`, com segredo guardado no Vault do Supabase. A rota reconsulta o freio antes de sair.
2. Automações da Fase 1: `qualificacao`, `followup_d3_d14` (tarefas), `retorno_combinado`, `regua_nutricao` (uma tarefa por mudança de faixa, só para quem já escreveu), `lembrete_sessao` (tarefa), `prenatal_urgente`, `alerta_34s` (interna), `pagamento_atrasado`, e ganchos vazios de `contrato_fechado`, `pos_assinatura` e `pagamento_confirmado` que os prompts P30 a P32 preenchem. `contratar_sem_transferencia` e `sessao_sem_agenda` (10.1), que leem os marcos gravados pelo agente. `followup_d1` e `boas_vindas` são do agente: o motor só agenda, e o n8n consome por `agente.followups_devidos()`.
3. Tela de automações para a diretoria: ligar e desligar, ver execuções e abortos pelo freio.

Aceite: pgTAP mostra família em `atencao` sem tarefa de régua, uma tarefa só por mudança de faixa e execução externa abortada quando o estado muda entre o agendamento e o envio.

## P21 · Fronteira do agente, parte 1

Fase 1 · S5 · depende de P17, P18 e P19 · trilha do agente · **plano primeiro**
Ler: PRD 11.7, 11.9, 11.10, 11.11 e Apêndice A; `n8n/prompts/isadora-system.md` (formato da ficha no cabeçalho)

Fazer:
1. Papel `n8n_agente` criado na migration sem senha (a senha é definida à mão a partir do cofre, por runbook), sem `bypassrls`, `search_path = agente_n8n, extensions`, privilégios exatamente como no 11.10: `usage` em `extensions`, políticas `for all to n8n_agente` nas duas tabelas de `agente_n8n`, `execute` revogado de `public` em todas as funções de `agente`. Documentar a conexão pelo pooler em modo sessão (usuário `n8n_agente.<ref>`).
2. Funções do Apêndice A (parte 1), todas `security definer` com `set search_path = ''`, nomes qualificados, validação de parâmetros e retorno `jsonb`:
   - `registrar_mensagem`: resolve a conversa por LID, telefone e jid, nessa ordem; cria ou atualiza (E.164, LID, nome salvo, quem iniciou), mascara com `privado.mascarar_documentos`, deduplica por `wa_message_id`, lê "paciente potencial" e "paciente fechada" no nome salvo e devolve `conversa_id` e se o número é da equipe ou do plantão. `registrar_transcricao`.
   - `pode_responder`: modos do 11.7 a partir de `agente_modo`, lista de teste, pausa, transferência aberta, estado sensível e classificação; silêncio para números da equipe e do plantão. `pode_enviar(jid, categoria)`: a regra de `privado.pode_enviar_mensagem` mais pausa e modo, no instante do envio.
   - `pausar`, `contexto_conversa` (marca onde começa o pedido atual), `checar_termos_alerta` (sem acento, por palavra ou expressão, devolve ação e `mensagem_chave`), `mensagem_alerta(jid, acao, chave)` e `mensagem_sistema(jid, chave)`, só com textos aprovados e com a regra do nome vazio (capítulo 23). `sincronizar_memoria(jid, papel, texto)` sobre `agente_n8n.chat_memoria`, usando o id da conversa como sessão.
   - `ficha_para_agente`: texto no formato exato do cabeçalho do prompt (campos livres com até 200 caracteres, sem colchetes), mais planos vigentes, valor, parcela e página por plano (as variáveis `valor.*`, `parcela.*` e `pagina.*` do prompt), valores permitidos (sem taxas enquanto `taxa_visivel_agente` for falso), situação da apresentação, horários da Edilaine e data e hora de Brasília.
   - `planos_vigentes`, `verificar_cobertura` (localidade e alias, depois `cidade`, depois `municipio` pela região intermediária; devolve `tem_taxa` e só mostra o valor com `taxa_visivel_agente`; nunca usa DDD), `verificar_disponibilidade` (usa `privado.disponibilidade`, nunca expõe números), `atualizar_lead` (cria família, pessoa e oportunidade quando faltam, converte semanas em DPP pela data de hoje, move o pipeline pela máquina de estado, recalcula a pontuação, deduplica pelo telefone; se a família da conversa já terminou um atendimento e a pessoa fala de uma gestação nova, cria outra família ligada por `familia_anterior_id`, PRD 6.10 regra 12) e `registrar_marco` (inclui `quer_contratar`, `sem_interesse` e `proximo_contato` por data ou semanas-alvo). `atualizar_lead` grava a principal preocupação só como tema e `historico_sensivel` sem detalhe.
3. pgTAP da fronteira: `n8n_agente` não lê nenhuma tabela de `public`, `privado` ou `assistencial`, não executa função fora da lista, não baixa freio, e nenhuma função devolve campo assistencial. Testes de cada função com as conversas do seed.
4. `docs/adr/0003-fronteira-agente.md`.

Aceite: pgTAP verde. Parar para revisão do SQL.

## P22 · Fronteira do agente, parte 2

Fase 1 · S5 · depende de P21 · trilha do agente
Ler: PRD 11.4, 19.3, 23.3, 23.4 e Apêndice A

Fazer:
1. `registrar_handoff` (sete parâmetros, Apêndice A): matriz de `parametro.handoff_matriz` (destino, prioridade, SLA em horas úteis), família mínima quando a conversa ainda não tem família, freio (perda sobe para `bloqueio_total`, saúde para `atencao`), pausa, deduplicação de pedido igual em 10 minutos, `mensagem_grupo` montada a partir de `mensagem_modelo` com o resumo interno do banco, `grupo_jid` do destino, lista de plantão só na prioridade máxima, `instrucao_agente` e `pausa_horas`.
2. `registrar_notificacao_handoff` (falha deixa faixa vermelha no CRM e aciona e-mail), `marcar_nao_lead` (devolve o texto de encaminhamento), `followups_devidos` (reserva a execução e aplica freio, `nao_contatar`, pausa, transferência aberta, modo, lista de teste, conversa iniciada pela família, janela e uma mensagem de conteúdo por dia), `registrar_followup`.
3. `base_para_indexar` (itens aprovados, um documento por plano vigente e um por praça), `promover_lote`, `descartar_lote`, `registrar_ingestao`.
4. `privado.retomar_agente(conversa_id)`, usado pelo app quando alguém da equipe resolve a transferência e devolve a conversa à Isadora.

Aceite: pgTAP mostra perda subindo o freio e pausando (inclusive numa conversa sem família), pedido repetido em 10 minutos sem duplicar, `followups_devidos` sem família em `atencao`, com transferência aberta, fora da janela ou que já recebeu mensagem de conteúdo no dia, e `base_para_indexar` sem nada clínico nem em rascunho.

## P23 · n8n: build, configuração e testes

Fase 1 · S5 · depende de P22 e P-1 (item 15) · trilha do agente · **plano primeiro**
Ler: PRD 19.1 e 19.5; `n8n/referencia/`; `n8n/prompts/`

Objetivo: a máquina que gera os três JSON, com testes, antes de qualquer fluxo.

Fazer:
1. `n8n/config.example.json` (o único config no git): versão de cada tipo de nó (tirada da amostra exportada), ids e nomes das credenciais, URL base e instância da UAZAPI, segredos dos caminhos de webhook, modelos e se aceitam temperatura, id do fluxo 2 (preenchido depois do P24), prefixo do Redis e as opções `envio_simulado` e `transcricao_simulada` para homologação. Valores de negócio (tempo de agrupamento, pausa, PDF oficial) não vão no config: o fluxo lê de `parametro` pelas funções do agente.
2. `n8n/build.mjs`: lê o config do ambiente, monta os fluxos a partir de definições em `n8n/src/*.mjs` (nós e conexões declarados em código), embute o código dos nós Code a partir de funções puras em `n8n/src/code/*.js`, carrega os prompts de `n8n/prompts/` entre as marcas (procuradas no começo da linha, porque o cabeçalho de cada arquivo cita as marcas no meio do texto) e troca as variáveis por expressões do n8n, aplica as configurações do 19.1, coloca a nota de cabeçalho e grava `n8n/dist/*.json` (com "(HML)" no nome em homologação).
3. `n8n/build.test.mjs` (node:test) com tudo o que o 19.5 lista, mais: nenhum `$fromAI` preenchendo `jid`; nenhuma credencial `supabaseApi` nem `service_role`; todo nó Postgres com parâmetros em lista; toda ferramenta com descrição; toda chamada externa com tratamento de erro; `track_source` em todo envio; varredura de segredos nos JSON gerados e em `n8n/referencia/`.
4. Funções puras iniciais com testes: `mascararDocumentos` (o teste roda os mesmos casos contra a função SQL `privado.mascarar_documentos` no banco local e contra o código), `normalizarTexto`, `dividirEmBlocos`, `agrupamento`, `lerClassificacaoMensagem`, `lerClassificacaoPedido`.

Diferenças deliberadas em relação aos fluxos da Enjoy, para registrar no ADR 0003: banco por papel restrito e funções Postgres no lugar de RPC com credencial do Supabase; PGVector no lugar do vector store do Supabase; memória em Postgres no lugar do Redis com expiração; token da UAZAPI em credencial, nunca lido do corpo do webhook.

Aceite: `node n8n/build.mjs --env hml` gera três JSON de esqueleto válidos e `node --test n8n/build.test.mjs` passa.

## P24 · n8n: fluxo 2, Pausar IA e Notificar Equipe

Fase 1 · S6 · depende de P23 · trilha do agente
Ler: PRD 19.3, 11.4, 23.3 e 23.4; `n8n/prompts/classificar-pedido.md`; o fluxo de pausa da Enjoy em `n8n/referencia/` só como formato

Fazer:
1. Os 19 nós do 19.3 em `n8n/src/fluxo-2.mjs`, com as regras do "Pular Classificador?" e do "Ler Classificação" como funções puras testadas. O fluxo 2 é o único que envia o texto fixo de saúde ou de perda (`agente.mensagem_alerta`), quando `enviar_texto` vier verdadeiro, e devolve `instrucao_saude` ao agente.
2. Testes dos cenários: classificador pulado para motivos do sistema, `pediu_humano`, `reclamacao` e `bebe_nasceu`; classificador falhou; classificador subindo para saúde; `sem_aviso` recusado para `contratar` e aceito só para `duvida_sem_resposta` e `outro`; não lead preservado; pedido duplicado sem novo aviso; banco fora do ar em saúde avisando o grupo com a marca "não registrado no sistema"; texto de alerta enviado só com `enviar_texto`.
3. Build de `n8n/dist/kraamzorg-pausar-ia-notificar-equipe.json`, importação em homologação e id do fluxo anotado no config.

Aceite: o JSON importa sem erro; chamadas de teste com payloads de exemplo (registradas no relatório) põem a mensagem no grupo de teste e a pausa no Redis e no banco.

## P25 · n8n: fluxo 3, Agente Isadora

Fase 1 · S6 · depende de P24 · trilha do agente · **plano primeiro** · pode levar duas sessões
Ler: PRD 11 inteiro, 19.1 e 19.4; `n8n/prompts/isadora-system.md`, `classificar-mensagem.md`, `reescrever-resposta.md` e `isadora-followup.md`; o fluxo de entrada da Enjoy em `n8n/referencia/` só como formato

Fazer:
1. Entrada A (nós 1 a 35) e entrada B (nós 36 a 41) exatamente como no 19.4, em `n8n/src/fluxo-3.mjs`. A ordem é a regra de segurança do fluxo: termos e classificador (nós 17 a 20) antes do "Decidir Modo" e do desvio de mídia, e o alerta chega ao fluxo 2 em todos os modos menos `desligado`. O teste do build confere essa ordem pelas conexões.
2. `validarResposta` como função pura com todas as regras do 11.11 (itens 3 a 8): valores em reais em qualquer forma ("R$ x", "x reais", "3x de x") contra a lista permitida e contra o plano citado na mesma frase; percentual perto de palavras de condição; promessas; escassez; palavras que a marca evita por palavra inteira (`parametro.validador_listas`, lido pela ficha); pedido de documento ou dado pessoal; negar ser assistente virtual; travessão trocado por vírgula; markdown removido com um negrito do WhatsApp permitido por bloco; nenhum emoji em bloco com valor; no máximo uma exclamação e um emoji por bloco; marca `precisa_pdf`.
3. `prepararEnvio`: até três blocos de cerca de 280 caracteres sem quebrar frase; apresentação antes do primeiro bloco com valor, com a janela de `pdf_reenvio_janela_horas` (zero por padrão, ou seja, sempre) e sempre que o modelo pedir `[ENVIAR_APRESENTACAO]`; `[SILENCIO]` encerra. Se a reescrita devolver `transferir`, o fluxo abre a transferência antes do envio.
4. Eco reconhecido por `wasSentByApi` ou `track_source`; agrupamento de 20 segundos com a chave do Redis vencendo em 5 minutos; texto mascarado já no "Extrair Dados"; `jid` sempre do nó "Extrair Dados"; memória em `agente_n8n.chat_memoria` com o id da conversa como sessão; `agente.sincronizar_memoria` depois do envio, para a memória guardar o texto que de fato saiu; `agente.pode_enviar` imediatamente antes de cada envio; banco fora do ar no "Pode Responder?" para o fluxo sem responder.
5. Com `envio_simulado` ligado, os envios vão para a rota de captura `/api/teste/uazapi`, criada nesta sessão no app e recusada fora de homologação. Com `transcricao_simulada`, o download e a transcrição de áudio devolvem o texto que o teste mandar. É o que o P28 usa.
6. Teste de fumaça na conta real da OpenAI em homologação: uma chamada do modelo de conversa e uma do classificador com os parâmetros do config.
7. Build de `n8n/dist/kraamzorg-agente-isadora.json`, importação em homologação e webhook da instância de teste da UAZAPI apontando para o fluxo.

Aceite: testes do build verdes; em homologação, com `agente_modo = teste` e os números da equipe na lista, uma conversa real do "Olá" até o pedido de conversa com a Edilaine funciona, com a apresentação chegando antes do primeiro valor.

## P26 · n8n: fluxo 1, Ingestão RAG, e base de conhecimento inicial

Fase 1 · S6 · depende de P22 e P23 · trilha do agente
Ler: PRD 19.2, 6.8 e 11.9; `n8n/prompts/isadora-system.md` (seção "O que a Kraamzorg é")

Fazer:
1. Os 11 nós do 19.2 em `n8n/src/fluxo-1.mjs` e o build de `n8n/dist/kraamzorg-ingestao-rag.json`, com o Data Loader no modo personalizado (divisor de 2.000 caracteres, um item vira um documento) e os documentos de plano sem valor.
2. Seed da base de conhecimento em `agente.base_conhecimento`, tudo em rascunho, um assunto por item, até 1.500 caracteres e com a fonte preenchida: institucional, método, quatro frentes, amamentação, equipe, para quem é, reserva, o que a Kraamzorg não oferece, evidências com a fonte, perguntas frequentes (como funciona, atende minha região, 6 ou 12 dias, substitui doula, quando começa, e se o bebê nascer antes, a enfermeira dorme aqui, posso parcelar, nota fiscal), objeções do prompt, contatos oficiais e as conversas-modelo do treinamento de 24/09 com nomes fictícios. Depoimentos entram em rascunho até existir autorização de uso do nome. Nada clínico.
3. Rota do app que chama o webhook de reindexação (o botão vem no P27).

Aceite: com itens aprovados em homologação, a ingestão cria o lote, promove e a ferramenta devolve o item certo para cinco perguntas de teste; uma falha no meio mantém a base anterior.

## P27 · Tela do agente no CRM

Fase 1 · S7 · depende de P22, P26 e P18
Ler: PRD 11.3, 11.4, 11.12 e 20.5

Fazer:
1. Conversas: lista com modo, pausa, última mensagem e transferência aberta. Na conversa: mensagens com quem enviou, pausar e retomar a Isadora, assumir e resolver a transferência (resolver devolve à Isadora), marcar como não lead, abrir a ficha.
2. Transferências: fila por prioridade e prazo, com cores; faixa vermelha quando o aviso ao grupo falhou.
3. Modo do agente (diretoria): desligado, teste ou produção, e a lista de números de teste.
4. Base de conhecimento: cadastro com status, aprovação pelo Leonardo, botão "Reindexar" e última ingestão.
5. Métricas do 11.12, com as consultas SQL documentadas.

Aceite: e2e com transferência aparecendo com o prazo; assumir pausa a Isadora; resolver retoma.

## P28 · Homologação automatizada da Isadora

Fase 1 · S7 · depende de P25, P26, P27 e da aprovação do item 16 do P-1
Ler: PRD 11.5, Apêndice C e 16.2 (Fase 1)

Fazer:
1. Roteiro automatizado (`tests/agente/roteiro.spec.ts`) que manda ao webhook do fluxo 3 em homologação payloads iguais aos da UAZAPI (texto, áudio com `transcricao_simulada`, foto com legenda, CPF, figurinha) a partir de números da lista de teste, uma conversa nova por caso, com `envio_simulado` ligado, e confere as mensagens capturadas, o estado no banco (transferências, marcos, pausa, freio) e o conteúdo (valores permitidos, apresentação antes do valor, sem travessão, sem pedido de documento).
2. Os 24 casos do Apêndice C (13 e 15 em dois turnos, 14 com horários da Edilaine cadastrados) e os casos extras, inclusive saúde com a IA pausada, foto com legenda de sintoma e perda de gestação anterior. Avaliação de tom por modelo pode entrar como informação, nunca como critério único.
3. Relatório em `docs/homologacao/isadora-AAAA-MM-DD.md` com o resultado e as transcrições.

Aceite: 24 de 24. Falha em saúde, valor sem apresentação, promessa ou dado sensível reprova a versão (PRD 11.5).

## P29 · Sessão de venda

Fase 1 · S6 · depende de P16 e P22 · trilha de venda
Ler: PRD 4 (D-04 e D-15), 6.3 (`sessao_venda`), 13 (sessão gravada) e 14 (transcrição)

Fazer:
1. A partir da transferência `reuniao`: tela para o comercial com as opções que a família passou, escolha da data e hora, link da reunião, estado e transições do P1.
2. Estados: agendada, realizada, não compareceu, remarcada, cancelada. Tarefas de lembrete na véspera, de "não compareceu" e de retorno 48 horas depois da conversa, com os textos do 23.2.
3. Consentimento de gravação com versão do termo; envio do áudio ou colagem da transcrição; resumo estruturado por IA (dúvidas, objeções ditas, plano de interesse, próximos passos, sem inventar), com o prompt em `src/modules/crm/prompts/resumo-sessao.md`. Tudo isso mora em `sessao_venda_gravacao`.
4. Agenda da sessão visível para o comercial e a coordenação; gravação, transcrição e resumo só para quem conduziu e para a diretoria, com leitura registrada.

Aceite: e2e com a sessão agendada movendo o P1; comercial que não conduziu não vê a gravação.

## P30 · Proposta, condições comerciais e formulário seguro

Fase 1 · S6 · depende de P29 · trilha de venda
Ler: PRD 4 (D-16), 6.2 (`pessoa_dados_contrato`), 6.3, 21.3 (formulários públicos) e 22.2 (C-04, C-05 e C-10)

Fazer:
1. Proposta: pacote e versão vigente, condição da tabela (desconto só com aprovação registrada da diretoria), taxa da localidade, pagador diferente de quem recebe o cuidado, parcelas dentro da condição.
2. Formulário seguro em `/formulario/[token]`: token de uso único guardado como hash no contrato, expiração em parâmetro, Turnstile e limite de tentativas. Campos: dados da gestante (nome completo, CPF, data de nascimento, e-mail, endereço residencial e de atendimento), pagador quando for presente, parceiro como testemunha [confirmar]. Consentimento LGPD com versão do termo. Validação de CPF. Grava em `pessoa_dados_contrato`.
3. Link enviado pela tarefa com o texto `formulario_contrato`.

Aceite: token funciona uma vez e expira; CPF nunca aparece em log, URL ou Sentry; e2e do formulário no celular.

## P31 · Contrato e assinatura eletrônica

Fase 1 · S6 · depende de P30 · trilha de venda
Ler: PRD 6.3 (`contrato`), 14 (Autentique) e 22.2 (C-10 e C-11)

Fazer:
1. Modelo provisório do contrato (C-11) em `@react-pdf/renderer`: contratante, pagador, pacote (dias vezes horas e total, enfermeira obstétrica ou neonatal, as quatro frentes, pré-natal online), valor, taxa, parcelas e as cláusulas do modelo atual, com `template_versao`. Variante de presente sem valores para quem recebe o cuidado.
2. Geração pelo celular, revisão e envio à Autentique (`createDocument` com upload; gestante e Kraamzorg assinam, parceiro como testemunha). Sandbox em homologação.
3. Webhook `/api/webhooks/autentique`: segredo no caminho e reconsulta do documento pela API antes de mudar qualquer estado; PDF assinado no storage privado com nome pelo id.
4. Transições `contrato_gerado`, `aguardando_assinatura` e `assinado`, e disparo de `pos_assinatura`.

Aceite: fluxo completo no sandbox; webhook forjado não muda nada.

## P32 · Cobrança pela InfinitePay

Fase 1 · S6 · depende de P31 · trilha de venda
Ler: PRD 14 (InfinitePay), 6.3 (`cobranca`), 7.2 e 10.1

Fazer:
1. Cobrança criada depois da assinatura, com `order_nsu` igual ao id da cobrança; link pela API de links com itens em centavos, `redirect_url`, `webhook_url` e dados do cliente; texto `link_pagamento` na tarefa.
2. Webhook `/api/webhooks/infinitepay`: não confia no corpo, confirma com `payment_check` antes de qualquer baixa, é idempotente, grava método, parcelas, valor pago e recibo, e responde 200 rápido.
3. Baixa move para `pagamento_confirmado`. Acima de 34 semanas, `prenatal_urgente` (tarefa máxima e aviso imediato à coordenação). Tarefa com `pagamento_confirmado` ou `pagamento_confirmado_34s`. A nota fiscal fica pendente para o P43.
4. Baixa manual pelo financeiro para Pix recebido fora do sistema, com comprovante e motivo.

Aceite: teste automatizado com `payment_check` simulado cobre webhook duplicado e forjado; em homologação, um pagamento de valor mínimo percorre o fluxo quando a credencial existir.

## P33 · Aceite das Fases 0 e 1

Fase 1 · S7 (21/10 na proposta) · depende de P00 a P32
Ler: PRD 16.1 e 16.2

Fazer:
1. Roteiro em `docs/aceite/fases-0-1.md`: login de cada papel pelo celular conferindo a matriz; toda ação no log; formulário preenchido offline sincronizando; família fictícia do primeiro contato no WhatsApp de teste até o pagamento confirmado, com contrato gerado e enviado pelo celular, sem mexer no banco; 24 de 24 da Isadora.
2. Rodar o roteiro em homologação e corrigir o que falhar em sessões curtas.
3. Listar o que depende de terceiros (T-01, T-06) e o que fica condicionado.

Aceite: termo de aceite do validador ou lista de ajustes com prazo.

---

# Fase 2 · Operação e registro assistencial

## P34 · Instrumentos versionados e gerador de formulários

Fase 2 · S7 · depende de P12 e P08 · **plano primeiro**
Ler: PRD 9 (introdução e 9.1 a 9.4) e Apêndice B; `docs/analise-entrevistas.md`; `docs/referencia-materiais-clinicos.md`

Fazer:
1. Esquema do instrumento em `src/lib/instrumentos/schema.ts` (zod): blocos, campos (texto, texto longo, sim ou não, sim ou não com texto, escala de 0 a 10, opção única, múltipla escolha, número com unidade e faixa, data, hora, bloco repetido por bebê), obrigatoriedade, condição para aparecer, texto de ajuda e regra de alerta ligada.
2. Definições v1 dos quatro instrumentos exatamente como no PRD 9.1 a 9.4, em `supabase/dados/instrumentos/*.json`, carregadas por migration de dados com `vigente = false` até a Edilaine aprovar na tela.
3. Gerador de formulário para celular: uma etapa por bloco, salvamento por campo pelo motor offline, estados de sincronização, bloco repetido por bebê em gemelares.
4. Tela de instrumentos para a coordenação: ver versão, aprovar, comparar versões. As propostas do DOC 1 v2 ficam num rascunho separado.
5. Regras do Apêndice B ligadas aos campos. Só as que têm o DOC 3 como fonte nascem ativas; as marcadas `[clínico]` ficam inativas.

Fora de escopo: nenhum campo clínico novo, nenhum nome de campo alterado.

Aceite: o DOC 2 renderiza os blocos do 9.2 com os tipos certos; aprovar uma versão nova não muda os registros antigos, que continuam apontando para a versão usada.

## P35 · Consulta pré-natal (DOC 1) e alerta de 34 semanas

Fase 2 · S7 · depende de P34 e P32
Ler: PRD 9.1, 7.2, 10.1 (`alerta_34s` e `prenatal_urgente`) e 4 (D-10)

Fazer:
1. Tarefa `agendar_prenatal` quando o pagamento é confirmado, urgente acima de 34 semanas; agenda da consulta.
2. Preenchimento do DOC 1 pelo celular. Toda entrevista começa em branco e não existe opção de duplicar outra família.
3. Médicos do bloco H gravados em `medico`; preferência de período em `consulta_prenatal.periodo_preferido`; plano de cuidado.
4. `alerta_34s` diário, só interno.
5. Transições `consulta_prenatal_agendada` e `consulta_realizada`.

Aceite: e2e com família sintética; entrevista nova sempre vazia; família com 34 semanas gera aviso só para a coordenação.

## P36 · Designação, radar de nascimentos, nascimento e alta

Fase 2 · S7 · depende de P35 e P19
Ler: PRD 3.4, 7.2, 7.3 e 10.1 (`checkin_dpp`, `dpp_sem_confirmacao`, `dpp_sem_contato`, `nascimento`, `alta`)

Fazer:
1. Designação por oferta e aceite (titular e backup) com prazo de resposta; atribuição direta pela coordenação em urgência.
2. Radar de nascimentos: famílias pela janela da DPP, confirmadas, sem contato, com titular e backup.
3. Check-in de DPP como tarefa; avisos de DPP mais 3 e mais 10 dias.
4. Registro do nascimento (data, bebês, peso, tipo de parto) recalcula a agenda e avisa a operação. Registro da alta ativa o acompanhamento, gera as visitas de D1 a D6 ou D12 no mesmo período, cria a tarefa do guia e avisa a profissional.

Aceite: e2e em que nascimento e alta geram 6 ou 12 visitas no período certo; recusa da titular aciona backup e avisa a coordenação.

## P37 · Agenda, escalas e equipe

Fase 2 · S8 · depende de P36
Ler: PRD 3.4 (duas visitas por dia, mesmo período), 6.5 (`profissional`, `documento_profissional`, `bloqueio_agenda`) e 10.1 (`documento_vencendo`)

Fazer:
1. Cadastro de profissionais (conselho e UF, regiões, vínculo, valor da hora, ajuda de deslocamento), documentos com validade e aviso 30 dias antes, bloqueios de agenda.
2. Agenda por profissional e geral, por dia e por semana.
3. Conflitos: mais de duas visitas no dia, período diferente do D1, bloqueio, sobreposição.
4. Reagendamento em cascata quando nascimento ou alta mudam, mantendo o período.
5. Escala semanal.

Aceite: conflito aparece na tela antes de salvar; a cascata mantém o período.

## P38 · Portal da enfermeira

Fase 2 · S8 · depende de P37 e P12
Ler: PRD 20.4 (Enfermeira), 15 e 13 (famílias atribuídas)

Fazer:
1. Abas Hoje (visitas do dia com endereço, período, chegada e saída com hora), Famílias (só as atribuídas, sem dado comercial), Alertas e Perfil.
2. Cache offline das famílias e visitas do dia, com a validade e a limpeza do P12; fichas pendentes em destaque.
3. Leituras pelas funções `assistencial.ler_*`, com registro no log.

Aceite: enfermeira só vê as famílias atribuídas; o dia funciona sem conexão; chegada e saída gravadas.

## P39 · Checklist diário (DOC 2), registro append-only e adendos

Fase 2 · S8 · depende de P38 e P34 · **plano primeiro**
Ler: PRD 9.2, 6.5 (`registro_atendimento`, `registro_adendo`, `anexo_audio`), 7.3 (contatos dos médicos) e 15; `docs/referencia-materiais-clinicos.md`

Fazer:
1. DOC 2 offline por visita, com o bloco do recém-nascido repetido por bebê.
2. Obrigatórios para concluir a visita (PRD 9.2) e resumo descritivo.
3. Assinatura: hash sha256 de dados, resumo, profissional e hora, calculado no aparelho na hora de assinar e conferido no servidor. Registro final por `assistencial.registrar_atendimento()`, append-only. Correção por adendo com motivo.
4. Último dia: contatos do obstetra e do pediatra obrigatórios, com justificativa quando faltar. Sem contato, a visita encerra, a tarefa `obter_contato_medico` nasce e a evolução fica bloqueada.
5. Curva de peso automática: perda percentual, menor peso, ganho absoluto e ganho médio diário com uma casa decimal, a partir do menor peso (K-11).
6. Áudio anexado à visita, no storage privado com URL assinada de 60 segundos. A transcrição fica desligada por parâmetro até a aprovação do L-04; a retenção vem do parâmetro.

Aceite: registro não aceita update; divergência offline vira adendo; visita sem obrigatórios não conclui; invariante 4 roda com o DOC 2.

## P40 · Motor de alertas clínicos (DOC 3) e apoio do DOC 4

Fase 2 · S8 · depende de P39 e da aprovação do item 17 do P-1
Ler: PRD 9.3, 9.4, Apêndice B e 8; `docs/referencia-materiais-clinicos.md`

Fazer:
1. `src/lib/regras-alerta`: avaliador puro da `condicao` em JSON, o mesmo código no aparelho e no servidor.
2. Avaliação no momento em que o campo é salvo, mesmo offline, com aviso na tela da enfermeira mostrando a conduta. Seletor dos sinais do DOC 3 que não têm campo.
3. Na sincronização, o servidor reavalia e cria `alerta_clinico`. Imediato: push para a coordenação, mensagem no grupo clínico e sugestão de ligação na tela da enfermeira. Prioritário: push e grupo. Saúde mental imediata cria ocorrência privada com prioridade máxima.
4. Fechamento do alerta só com sinal identificado, hora do acionamento, orientação médica e conduta.
5. Janelas de apoio com as tabelas LATCH e NTS; ILIB como vermelho.

Aceite: registro de teste com temperatura de 38,2 °C dispara PU-01 sem conexão e, ao sincronizar, avisa a coordenação; alerta não fecha sem os quatro campos.

## P41 · Evoluções em PDF e envio aos médicos

Fase 2 · S8 · depende de P40 · **plano primeiro**
Ler: PRD 9.5 inteiro; `docs/analise-evolucoes.md`

Fazer:
1. Rascunho da evolução puerperal e da neonatal (uma por bebê) a partir dos dados agregados e dos textos padrão aprovados (`mensagem_modelo` com destinatário `medico`), com concordância de gênero.
2. Validações antes da aprovação: datas dentro do período; conclusão coerente com os achados (aleitamento exclusivo contra complemento, ganho contra perda de peso, icterícia); ferida operatória só em cesárea; contato médico presente; conselho e UF vindos do cadastro da profissional.
3. Edição pela enfermeira dos trechos de julgamento clínico; aprovação pela Edilaine.
4. PDF em A4 com logo, rodapé com paginação e aviso de confidencialidade (LGPD art. 11), metadados controlados em pt-BR e nome de arquivo pelo id.
5. Envio por e-mail ao obstetra e ao pediatra com o texto do 23.5, sem nome da paciente no assunto; arquivo na ficha; envio registrado. Envio à família como tarefa manual (K-10).
6. Prazo: aviso à enfermeira em D+1 e escalada para a coordenação em D+2.

Aceite: o acompanhamento do seed gera os PDFs certos; conclusão incoerente bloqueia a aprovação; e-mail com anexo e assunto sem dado pessoal.

## P42 · Ocorrências, pesquisa e NPS

Fase 2 · S9 · depende de P41
Ler: PRD 6.6 (`ocorrencia`, `pos_venda`), 7.4, 10.1 (`pesquisa`, `classificacao_nps`) e 22.3 (K-12)

Fazer:
1. Ocorrências com tipo, prioridade, prazo, responsável, histórico e marcação de privada.
2. Pesquisa nativa em `/pesquisa/[token]`, com as perguntas do formulário atual transcritas em `docs/referencia-pesquisa.md` (P-1, item 16), uma pergunta NPS de 0 a 10 e as autorizações de depoimento e de imagem. Disparo quando a enfermeira conclui o protocolo do último dia, como tarefa de envio.
3. Classificação e ações do 7.4: promotor recebe tarefas de depoimento e de indicação em dias diferentes; neutro, tarefa de escuta; detrator vira ocorrência privada com aviso à coordenação e nunca recebe pedido de avaliação pública.
4. Pipeline 4 e exclusão pelo freio.

Aceite: família em `encerrado_sensivel` não recebe pesquisa; detrator gera ocorrência privada.

## P43 · Nota fiscal de serviço (NFS-e)

Fase 2 · S9 · depende de P32 e dos itens de terceiros (certificado A1, provedor escolhido pela contadora)
Ler: PRD 14 (emissor de NFS-e), 6.3 (`nota_fiscal`), 22.1 (T-05) e 4 (D-07)

Fazer:
1. Adaptador do provedor escolhido, com emissão disparada pelo pagamento confirmado e padrão nacional (São Paulo exige o Emissor Nacional para o Simples a partir de 01/11/2026).
2. Tomador é quem paga (C-10); descrição "cuidado domiciliar pós-parto"; código de serviço do cadastro.
3. Estados, novas tentativas, PDF e XML no storage privado, tela do financeiro.
4. Emissão manual assistida enquanto a homologação não sai.

Aceite: nota de teste autorizada na homologação do provedor; erro mostra o motivo e permite reenviar.

## P44 · Aceite da Fase 2

Fase 2 · S9 (04/11 na proposta) · depende de P34 a P43
Ler: PRD 16.2 (Fase 2)

Fazer: roteiro em `docs/aceite/fase-2.md` com uma enfermeira real usando dados sintéticos em homologação: um dia inteiro pelo celular, com um trecho sem sinal, um alerta clínico de teste, a evolução gerada e a pesquisa enviada. Treinamento curto antes; ajustes depois.

Aceite: termo do validador.

---

# Fase 3 · Inteligência

## P45 · Capacidade probabilística e sobrevenda

Fase 3 · S9 · depende de P19 e P36
Ler: PRD 10.2, 3.4 e 12 (Fase 3)

Fazer: trocar a distribuição uniforme por uma distribuição do nascimento em relação à DPP (enquanto não houver histórico próprio, uma distribuição de referência parametrizada e documentada), incluir a cobertura de backup, alerta de sobrevenda para a diretoria e capacidade das próximas 8 semanas no painel. A ferramenta do agente continua devolvendo só `disponivel` ou `confirmar_com_equipe`.

Aceite: testes com cenários sintéticos; alerta dispara acima do limite.

## P46 · Financeiro, DRE e pagamento da equipe

Fase 3 · S9 · depende de P32 e P41
Ler: PRD 3.4 (remuneração e liberação), 12 e 13 (Financeiro)

Fazer:
1. Receitas a partir das cobranças; despesas por categoria (equipe assistencial, marketing e anúncios, deslocamento, contabilidade, tecnologia, pró-labore, outros).
2. DRE gerencial mensal, inadimplência e previsão de recebimentos.
3. Pagamento da equipe: horas por visita vezes valor da hora mais ajuda de deslocamento, liberado só depois do envio das evoluções.
4. Conferência com o extrato do banco por importação de arquivo. Nunca gatilho de baixa.

Aceite: DRE do mês sintético fecha com os lançamentos; pagamento fica bloqueado sem evolução enviada.

## P47 · Marketing, atribuição e página de captação

Fase 3 · S10 · depende de P21 e P46
Ler: PRD 14 (captura de leads), 22.1 (T-02 e T-03) e 6.2 (`origem`, `codigo_origem`, `utm`)

Fazer:
1. Gerador de links `wa.me` por canal, com um código de origem no texto pré-preenchido. `agente.registrar_mensagem` passa a ler o código na primeira mensagem e gravar a origem (alterar a função e o teste; rebuild do fluxo 3 só se precisar).
2. Página de captação `/c/[canal]` com UTM, Turnstile e botão para o WhatsApp, sem pedir dado sensível.
3. Receita por origem e custo por canal (vindo do financeiro); exportações só a partir de `familia_elegivel_marketing`.

Aceite: lead que chega com código cai com a origem certa; relatório de receita por origem confere com os dados sintéticos.

## P48 · Copiloto interno

Fase 3 · S10 · depende de P46
Ler: PRD 12, 13 e 21.3

Fazer: assistente para diretoria e comercial que responde em linguagem natural sobre pipeline, conversão, receita e ocupação usando um conjunto fechado de funções SQL de leitura (o modelo escolhe a função e os parâmetros, nunca escreve SQL), sempre com as permissões de quem pergunta. Sem dado assistencial. Perguntas registradas no log e custo do mês visível.

Aceite: dez perguntas de teste com resposta certa; pergunta sobre registro assistencial recusada para o comercial.

## P49 · Portal da família

Fase 3 · S10 · depende de P41 e P42
Ler: PRD 12, 13, 20.3 e 22.3 (K-10); `docs/referencia-materiais-clinicos.md` (tom com a família)

Fazer: acesso por link mágico no e-mail; próximos passos e datas, enfermeira designada (nome e foto só com autorização), guia de início, contato da equipe, evoluções quando o K-10 for decidido e a pesquisa. Em `bloqueio_total` o portal mostra só o contato de uma pessoa da equipe.

Aceite: família sintética acessa só o próprio portal; RLS testada.

## P50 · Indicações e parceiros médicos

Fase 3 · S10 · depende de P47
Ler: PRD 12 (nota sobre contrapartida financeira) e 6.2 (`medico` sem família)

Fazer: cadastro de médicos parceiros sem nenhuma contrapartida financeira (aviso visível sobre a vedação ética, validar com o jurídico da Kraamzorg), registro das indicações recebidas, relatório por médico e tarefas de relacionamento. Indicação feita por família promotora registrada com a origem.

Aceite: indicação registrada aparece no relatório por origem.

## P51 · Tarefas, manuais, treinamentos e banco de talentos

Fase 3 · S10 · depende de P37
Ler: PRD 12 (banco de talentos); `docs/referencia-materiais-clinicos.md` (seção 7)

Fazer:
1. Visão de tarefas por equipe.
2. Manuais e protocolos internos com versão e confirmação de leitura; trilha de treinamento das enfermeiras.
3. Banco de talentos: cadastro de candidatas, roteiro de 26 perguntas, 10 critérios de 1 a 5, notas, observações e estado. Página pública de candidatura existe, mas fica desligada por parâmetro (o onboarding pediu para não abrir agora).

Aceite: página pública desligada por padrão; avaliação com os critérios registrada.

## P52 · Painel executivo e congelamento

Fase 3 · S10 · depende de P45 a P51
Ler: PRD 16.2 (Fase 3, as cinco perguntas) e 11.12

Fazer: painel da diretoria que responde as cinco perguntas executivas (comercial, marketing, operação, experiência, financeiro) com números que batem com as telas de origem, e as metas da Kraamzorg (18 contratos e 18 famílias por mês, R$ 75.600 de faturamento, NPS 90). Congelamento do desenvolvimento em 13/11 com a tag da versão candidata.

Aceite: cada número do painel tem consulta documentada e teste.

---

# Homologação e entrega

## P53 · Testes finais, segurança e restauração

Homologação · S11 (16/11) · depende de P52
Ler: PRD 16 e 21

Fazer:
1. e2e de ponta a ponta de todas as fases em homologação.
2. Revisão de RLS com tentativa de leitura cruzada (cada papel tentando ver família de outra pessoa), avisos de segurança do Supabase, cabeçalhos, gitleaks em todo o histórico, auditoria de dependências.
3. Teste de restauração de backup documentado.
4. Carga básica no webhook do agente (20 mensagens simultâneas de números diferentes).
5. Plano de virada para produção: migrations, dados reais de configuração, fluxos n8n de produção, webhook da UAZAPI de produção só com o T-01 resolvido, `agente_modo = desligado` até a liberação.

Aceite: `docs/homologacao/final.md` sem pendência crítica.

## P54 · Treinamento, transferência e aceite final

Homologação · S11 (16 a 19/11) · depende de P53
Ler: PRD 4 (D-12) e 21.4

Fazer:
1. Manual de uso por papel em `docs/manual/`.
2. Apoio aos treinamentos: instalação do portal no celular de cada enfermeira (16/11), diretoria e coordenação (17/11), enfermeiras (17/11).
3. Conferência de que repositório, projetos, domínio e contas estão em nome da Kraamzorg; exportação dos fluxos n8n com instruções de migração da instância (cláusula 2.6.2).
4. Lista final dos itens `[confirmar]` que continuam abertos, com responsável.

Aceite: termo de aceite final em 19/11.

---

## Anexo: modelo do relatório de sessão

`docs/sessoes/PNN.md`

```
# PNN · título do prompt

Data:
Branch e commits:

## Feito
## Ficou de fora (e por quê)
## Decisões tomadas nesta sessão
## Mudanças no PRD
## Pendências novas ([confirmar], [clínico], terceiros)
## Como testar
## Resultado dos invariantes
```
