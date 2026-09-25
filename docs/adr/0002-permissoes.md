# ADR 0002 · Matriz de permissões, MFA e fronteira do schema `api`

Data: 25/09/2026
Situação: **proposta, pendente de aprovação escrita do Leonardo e da Edilaine (O-05)**. Vale o mais restritivo até a aprovação (PRD 22.4, O-05).
Relacionado: PRD 5.2, 6.9, 6.10 (regras 4, 6 e 11), 11.10, 13, 21.1, 21.2, 21.3, 22.4 (O-05, O-06, O-08); PROMPTS.md P07; migrations `0005_auditoria.sql`, `0006_maquinas_estado.sql`, `0007_permissoes.sql`, `0009_freio.sql`, `0010_score_dedup.sql` e `0011_ocupacao.sql`; testes `supabase/tests/007_permissoes.sql`, `009_freio.sql`, `010_score_dedup.sql` e `011_ocupacao.sql`.

## Contexto

O Kraamzorg OS guarda dado de saúde de gestantes e recém-nascidos (LGPD art. 11). O PRD 13 manda implementar as permissões por RLS no banco: filtro na aplicação é complemento, nunca a defesa. O PRD 13 traz a matriz por informação (linhas como "Lead e origem" ou "Registro assistencial") e cita no fim as tabelas que a matriz não cobre. Este ADR fecha a matriz tabela por tabela, diz onde vale MFA (AAL2), quais tabelas não têm `select` direto e qual função do schema `api` cobre cada leitura recortada.

Todo usuário do app chega ao banco como o papel `authenticated` do Supabase. Por isso:

- **RLS filtra linha, não coluna, e o privilégio de coluna vale para todos os usuários do app ao mesmo tempo.** Quando um papel de negócio pode ver a linha mas não uma coluna (por exemplo `familia.historico_sensivel` para o comercial), a coluna sai do `grant` de `authenticated` inteiro e quem pode vê-la lê por uma função do schema `api`.
- **"Sem acesso" aparece de dois jeitos no banco:** permissão negada (a tabela não tem `grant` para `authenticated`, ou a coluna não tem) ou zero linhas (há `grant`, mas nenhuma política deixa aquele papel ver a linha). Os dois são "sem acesso"; o teste 007 diz qual dos dois cada célula espera.

## Decisão

### 1. Princípios

1. **RLS ligada em toda tabela** de `public`, `agente`, `agente_n8n` e `privado`. Tabela sem política nega tudo, e isso é usado de propósito (ver "sem política" na matriz).
2. **Nenhum `grant` padrão do Supabase sobrevive.** A migration 0007 revoga tudo de `anon` e `authenticated` em tabelas, sequências, views e funções de `public`, e troca o `alter default privileges` do Supabase para que tabela nova de `public` nasça fechada para os dois. Cada tabela recebe de volta, para `authenticated`, só as operações e colunas da matriz abaixo. `service_role` continua com o padrão do Supabase (só roda no servidor, nunca no navegador nem no n8n, CLAUDE.md) e continua recusado pelos gatilhos de append-only, auditoria e máquina de estado.
3. **`anon` não recebe nada.** Nenhuma tabela, sequência, view ou função dos schemas do projeto. O PRD 11.10 diz, no mesmo parágrafo, que "anon não recebe execute em nada" e que o teste espera "nenhuma além de `public.ig`". Leitura adotada, a mais restritiva: `anon` não executa nem `public.ig`; o teste 007 confere que o conjunto de funções executáveis por `anon` está contido em {`public.ig`} e que, hoje, é vazio.
4. **O app chama por RPC só funções de `api`** (PRD 5.2). Cada uma é `security definer`, com `set search_path = ''`, confere usuário identificado, perfil ativo, papel e AAL, e só então lê ou chama `privado` e `assistencial`. `authenticated` recebe `usage` em `privado` e `api` e `execute` só na lista da seção 6.
5. **Tabela assistencial, `pessoa_dados_contrato` e sessão gravada não têm `select` direto** (PRD 6.10 regra 6): nenhum `grant` para `authenticated`, nenhuma política. Leitura só por função que grava `leitura` em `log_auditoria` antes de devolver. A escrita também passa por funções, que nascem com cada módulo.
6. **Mudança de estágio só por `privado.transicionar`**, que o app alcança por `api.transicionar` (PRD 7, invariante 1). Coluna de estágio fica fora dos `grant` de `update`, e o gatilho `privado.proteger_estado` recusa de novo.
7. **`criado_por` é do banco, não do app.** O gatilho `privado.carimbar_criado_por` (toda tabela de `public` com a coluna) grava `auth.uid()` na inclusão feita pelo usuário do app e mantém o valor antigo na alteração, mesmo que o `grant` de inclusão cite a coluna. Ninguém grava uma linha em nome de outra pessoa. Migrations, seed, funções `security definer` e `service_role` gravam o que informarem.

### 2. MFA (AAL2)

Duas regras, as duas escritas como política **restritiva** (`as restrictive`, somada com "e" às permissivas), para não repetir a condição em cada política:

- **Perfil com MFA** (`exige_mfa_do_perfil`, em toda tabela com `grant` para `authenticated`): quem tem papel `enfermeira`, `financeiro`, `coordenacao` ou `diretoria` só vê e só grava com sessão AAL2 (PRD 13: "perfis com acesso a dado assistencial ou financeiro exigem sessão AAL2"). Isso vale em qualquer tabela, inclusive para o Leonardo agindo como comercial, porque o perfil dele (diretoria, comercial e financeiro) tem acesso financeiro. Leitura adotada, a mais restritiva das duas possíveis (a outra seria exigir AAL2 só nas tabelas financeiras e assistenciais). Comercial e marketing puros trabalham em AAL1, fora das tabelas da regra seguinte.
- **Tabela com AAL2 para todos** (`exige_aal2`): financeiras (`contrato`, `cobranca`, `nota_fiscal`) e `fila_sincronizacao` (o payload carrega dado assistencial). As tabelas assistenciais, `pessoa_dados_contrato`, a sessão gravada e o log não têm `grant` nenhum; as funções `api` que as leem exigem AAL2.
- **Exceção única:** o próprio `perfil` e as próprias linhas de `usuario_papel` são legíveis em AAL1, para o middleware saber se precisa pedir o desafio do MFA.

O AAL vem só do claim `aal` do JWT (`privado.aal2()` = `(auth.jwt() ->> 'aal') = 'aal2'`), nunca de uma tabela.

### 3. Funções auxiliares das políticas

| Função | O que faz | Por que `security definer` |
| :-- | :-- | :-- |
| `privado.tem_papel(papel)` (P06) | Verdadeiro se `auth.uid()` tem o papel e o perfil está ativo | A política de `usuario_papel` chama a função; sem `security definer`, recursão |
| `privado.aal2()` | Verdadeiro se o JWT traz `aal = aal2` | Não precisa (só lê o JWT) |
| `privado.familias_atribuidas()` | Famílias com designação `aceita` (titular ou backup) da profissional ligada ao usuário (`profissional.usuario_id = auth.uid()`), com `profissional.ativa` e `perfil.ativo`, cujo acompanhamento não terminou, ou terminou há no máximo `parametro.acesso_enfermeira_pos_encerramento_dias` dias | Lê `designacao`, `acompanhamento` e `profissional` sem depender da RLS delas (evita recursão) |
| `privado.sem_acento(texto)` (P01) | Wrapper imutável de `unaccent` | Não precisa; `authenticated` executa porque o índice único de `cidade` calcula a expressão no insert (PRD 11.10) |

Regras de `familias_atribuidas`:
- "Terminou" = `encerrado`, `interrompido_familia` ou `interrompido_clinico` (leitura mais restritiva: interrupção também encerra o acesso depois do prazo). Estados anteriores (inclusive `pendencias`, `suspenso` e `intercorrencia`) dão acesso sem prazo.
- A data do término é `acompanhamento.encerramento`; sem ela, a data da transição para o estado final na linha do tempo (`evento_familia`). Sem nenhuma das duas, não há acesso.
- Conta em dias corridos no fuso `America/Sao_Paulo`. Com 7: até o 7º dia depois do término, acesso; no 8º, não.
- Parâmetro ausente ou inválido vale 0 (sem acesso depois do término). Nenhum prazo fixo no SQL.
- Profissional desativada (`ativa = false`) ou perfil desativado perde o acesso na hora.

### 4. Matriz tabela por tabela

Legenda: **L** leitura, **I** inclusão, **A** alteração, **X** exclusão. "Própria" e "atribuídas" são filtros de linha. "via `api.x`" = sem acesso à tabela, leitura pela função. Coluna **AAL**: "perfil" = regra do perfil com MFA (seção 2); "todos" = AAL2 para qualquer papel. Linhas marcadas **[O-05]** dependem da aprovação do Leonardo e da Edilaine.

#### Configuração e usuários

| Tabela | Comercial | Enfermeira | Financeiro | Marketing | Coordenação | Diretoria | AAL | Observação |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `perfil` | L própria | L própria | L própria | L própria | L todas | L todas, A | perfil (própria em AAL1) | Criado pelo gatilho de `auth.users` quando o convite traz `nome` em `raw_app_meta_data` (só o servidor grava esse campo); cadastro sem convite não vira perfil. A: `nome`, `email`, `telefone_e164`, `profissional_id`, `ativo` |
| `usuario_papel` | L próprias | L próprias | L próprias | L próprias | L próprias | L todas, I, X | perfil (próprias em AAL1) | Só a diretoria altera (P07 item 1) |
| `regiao`, `cidade` | L | nada | L | nada | L | L, I, A | perfil | Parâmetros e configurações: só a diretoria grava |
| `municipio` | L | nada | nada | nada | L | L | perfil | Carregada pelo seed; ninguém grava pelo app |
| `parametro` | nada | nada | nada | nada | nada | L, I, A | perfil | "Parâmetros e configurações": Total só na diretoria. O app lê os parâmetros de interface por `api.parametros_da_tela` (0015), com lista fechada de chaves por papel |
| `automacao` | nada | nada | nada | nada | nada | L, I, A | perfil | Trocar executor ou ativar é edição de dado (10.1) |
| `automacao_execucao` | nada | nada | nada | nada | L | L | perfil | Coordenação vê as execuções abortadas pelo freio (8.3) |
| `mensagem_modelo` | L | L | L | L | L, I e A só com destinatário `medico` | L, I, A | perfil | "Leitura geral, escrita da diretoria e da coordenação (destinatário medico)" (13) |
| `regua_faixa` | L | nada | nada | nada | L | L, I, A | perfil | |
| `termo_alerta` | nada | nada | nada | nada | L, I, A | L, I, A | perfil | "Termos de alerta e instrumentos" para a coordenação |
| `instrumento` | nada | L | nada | nada | L, I, A | L, I, A | perfil | A enfermeira lê a definição para gerar o formulário no aparelho |
| `regra_alerta` | nada | L | nada | nada | L, I, A | L, I, A | perfil | DOC 3 como dado, avaliado também no aparelho |

#### Família, comercial e conversa

| Tabela | Comercial | Enfermeira | Financeiro | Marketing | Coordenação | Diretoria | AAL | Observação |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `familia` | L, I, A | via `api.familias_do_dia` e `api.ficha_assistencial` | L só de família com contrato | nada (só `api.marketing_*`) | L | L, I, A | perfil | Coluna `historico_sensivel` fora de todo `grant`: ninguém lê nem grava direto; coordenação e diretoria veem em `api.ficha_assistencial` [confirmar: Edilaine, quem vê]. Colunas de origem do lead (`origem`, `codigo_origem`, `utm`, `indicacao_medico_id`, `indicacao_familia_id`) fora do `grant` de L: "Lead e origem" é sem acesso para financeiro e coordenação (13), que leem a mesma linha; comercial e diretoria leem por `api.lead_origem` (I e A continuam com eles). Financeiro: lead sem contrato não aparece ("Lead e origem" sem acesso; "Ficha comercial" leitura para cobrar). Fora do `grant` de I e A: `estado_sensivel*` (freio, P09), `mesclada_em_id` (deduplicação, P17), chave e carimbos |
| `familia_elegivel_marketing` (view) | nada | nada | nada | nada (só `api.marketing_*`) | nada | nada | | Lida só pelas funções `api.marketing_*` (6.9). `security_invoker`, então sem `grant` de `familia` para o marketing ela não serviria direto de qualquer jeito |
| `pessoa` | L, I, A | via `api.ficha_assistencial` | L só de família com contrato | nada | L | L, I, A | perfil | Sem X: remoção é `privado.eliminar_titular` (21.3) |
| `pessoa_dados_contrato` | via `api.dados_contrato` | nada | via `api.dados_contrato` | nada | nada | via `api.dados_contrato` | todos (completo) | **Sem política e sem `grant`** (6.10 regra 6). Escrita pelo formulário seguro (P30) por função própria |
| `bebe` | L, I, A | via `api.ficha_assistencial` | nada | nada | L, I, A | L, I, A | perfil | |
| `medico` | L, I, A | via `api.ficha_assistencial` | nada | nada | L, I, A | L, I, A | perfil | |
| `pacote`, `pacote_versao`, `condicao_comercial` | L | nada | L | nada | L | L, I, A | perfil | Preço é configuração: só a diretoria grava |
| `oportunidade` | L, I, A | nada | L só de família com contrato | nada (só `api.marketing_*`) | L | L, I, A | perfil | Estágio só por `api.transicionar`. Fora do `grant` de A: `estagio_p1`, `estagio_p2`, `pipeline` e `desconto_aprovado_por` (aprovação de desconto por função própria, P30). `score` e `classificacao` fora do `grant` de I e A desde a 0010: a pontuação é calculada pelo banco (`privado.calcular_score`, P17), nunca digitada |
| `sessao_venda` | L, I, A | nada | nada | nada | L, I, A | L, I, A | perfil | Agenda da conversa com a Edilaine. `conduzida_por` fora do `grant` de A: decide quem lê a gravação, e com a coluna editável um comercial se poria como condutor de uma sessão de outra pessoa e leria a transcrição. Nasce na inclusão e muda só por função (P29), com log |
| `sessao_venda_gravacao` | via `api.sessao_venda_gravacao`, só quem conduziu | nada | nada | nada | via `api.sessao_venda_gravacao`, só quem conduziu | via `api.sessao_venda_gravacao` | todos | **Sem política e sem `grant`** (6.10 regra 6). Adotado o mais restritivo do onboarding (13, divergência 1) [confirmar] |
| `contrato` | L, I, A | nada | L, I, A | nada | nada | L, I, A | todos | Financeira |
| `cobranca` | status via `api.status_cobranca` | nada | L, I, A | nada | nada | L, I, A | todos | "Parcial (status)" do comercial não cabe em RLS: função devolve só parcela, vencimento, status e data de pagamento |
| `nota_fiscal` | status via `api.status_cobranca` | nada | L, I, A | nada | nada | L, I, A | todos | |
| `conversa` | L, I, A | nada | nada | nada | L, I, A | L, I, A | perfil | I só com `canal`, `telefone_e164`, `familia_id`, `pessoa_id`, `classificacao` e `nome_contato_salvo` (contato registrado à mão); A só em `familia_id`, `pessoa_id` e `classificacao`; pausa e modo do agente só por função (`privado.retomar_agente`, P22) |
| `mensagem` | L | nada | nada | nada | L | L | perfil | Sem I direto: o texto precisa passar por `privado.mascarar_documentos` antes de gravar, então o "enviei" do app grava por função (P18). UPDATE, DELETE e TRUNCATE já revogados (P03) |
| `handoff` | L, A | nada | nada | nada | L, A | L, A | perfil | A só em `assumido_por`, `assumido_em`, `resolvido_em` e `status`; I só pelo agente e pelo sistema |
| `tarefa` | L, A se responsável | L, A se responsável | L, A se responsável | L, A se responsável | L, A se responsável | L, A todas | perfil | Responsável = `responsavel_id` do usuário, ou tarefa sem pessoa com `papel_responsavel` que o usuário tem (13). A só em `status`, `concluida_em`, `concluida_por` e `responsavel_id`. I pelo sistema |
| `notificacao` | L, A próprias | L, A próprias | L, A próprias | L, A próprias | L, A próprias | L, A todas | perfil | Própria = `usuario_id` do usuário, ou sem usuário com `papel` que ele tem. A só em `lida_em` |
| `evento_familia` | L não restrito | nada | L não restrito, só de família com contrato | nada | L não restrito | L não restrito | perfil | Evento `restrito` segue o registro assistencial: sem leitura direta, só por função com log (P16). Sem I direto: a linha do tempo é escrita pelas funções |

#### Operação e assistencial

| Tabela | Comercial | Enfermeira | Financeiro | Marketing | Coordenação | Diretoria | AAL | Observação |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `profissional` | nada | L própria | L | nada | L, I, A | L, I, A | perfil | "Cada enfermeira lê o seu" (13); financeiro lê para o pagamento da equipe ("Financeiro" Total) |
| `documento_profissional` | nada | L próprios | nada | nada | L, I, A | L, I, A | perfil | |
| `bloqueio_agenda` | L | L próprios | nada | nada | L, I, A, X | L, I, A, X | perfil | Agenda: comercial leitura, enfermeira própria |
| `acompanhamento` | L | L atribuídas | nada | nada | L, I, A | L, I, A | perfil | Agenda. Estado só por `api.transicionar`. Leitura auditada de exemplo em `assistencial.ler_acompanhamento` (P05), usada por `api.ficha_assistencial` |
| `designacao` | L | L próprias | nada | nada | L, I, A | L, I, A | perfil | A enfermeira vê as próprias ofertas; aceitar e recusar é função do P36 |
| `visita` | L | L próprias de família atribuída | nada | nada | L, I, A | L, I, A | perfil | Estado só por `api.transicionar`; check-in por função do P38 |
| `consulta_prenatal` | nada **[O-05]** | via `assistencial.ler_*` (atribuídas) | nada | nada | via função | via função, leitura com log | todos | **Sem política e sem `grant`**. Segue o registro assistencial (13) |
| `registro_atendimento`, `registro_adendo` | nada **[O-05]** | via função (atribuídas) | nada | nada | via função | via função, só leitura, com log **[O-05]** | todos | **Sem política e sem `grant`**; append-only (P03, P05). Diretoria lê, não escreve: a escrita segue o papel de cada pessoa |
| `anexo_audio`, `relatorio_medico` | nada **[O-05]** | via função (atribuídas) | nada | nada | via função | via função, só leitura, com log **[O-05]** | todos | **Sem política e sem `grant`** |
| `alerta_clinico` | nada | via função (atribuídas) | nada | nada | via função | via função | todos | **Sem política e sem `grant`** |
| `ocorrencia` | responsável, não privada | responsável, não privada | responsável, não privada | responsável, não privada | L, I, A | L, I, A | perfil | `privada` só coordenação e diretoria (13). Responsável altera só `status` e `historico` |
| `pos_venda` | nada | nada | nada | nada (NPS agregado em `api.marketing_*` futura) | L, A | L, A | perfil | Estágio só por `api.transicionar`. I pelo sistema (7.4) |
| `log_auditoria` | nada | nada | nada | nada | nada | via `api.log_auditoria` | todos | Sem `grant` (P05). A leitura do log vira linha de log |
| `fila_sincronizacao` | L, I próprias | L, I próprias | L, I próprias | L, I próprias | L, I próprias | L, I próprias | todos | "Só o próprio usuário" (13), e só usuário do app com perfil ativo e algum papel: cadastro sem convite ou perfil desativado não grava nem lê, mesmo em AAL2. Processamento pelo servidor |
| Candidaturas | nada | nada | nada | nada | Total | Total | perfil | Tabela ainda não existe (P51); nasce com esta regra |
| Financeiro da equipe | nada | próprios | Total | nada | nada | Total | todos | Tabelas do P46; nascem com esta regra |

#### Schemas internos

| Tabela | Acesso de `authenticated` | Observação |
| :-- | :-- | :-- |
| `agente.base_conhecimento` | nenhum (`agente` sem `usage`) | Regra para o P27, pelas funções `api` da tela do agente: leitura do comercial e da coordenação, edição de rascunho pelos dois, aprovação só da diretoria (13) |
| `agente.ingestao_execucao` | nenhum | Diretoria vê pela tela do agente (P27) |
| `agente_n8n.documentos`, `agente_n8n.chat_memoria` | nenhum | Só `n8n_agente`, com a política `for all to n8n_agente using (true)` do PRD 11.10, criada junto com o papel no P21 |
| `privado.auditoria_coluna_sensivel`, `privado.transicao_permitida` | nenhum | Tabelas internas, RLS ligada e sem política |
| `privado.recalculo_execucao`, `privado.recalculo_etapa` (0011) | nenhum | Registro do recálculo diário (PRD 10.2). RLS ligada, sem política e sem `grant`; a leitura para `/api/saude` e para a tela da diretoria vem por função, na sessão da tela (P14, P19) |
| `ocupacao_projetada` (view de `public`, 0011) | nenhum | `security_invoker` (6.9). Sem `grant`: lida por `privado.disponibilidade`, pelo recálculo e pelo radar do P19, que publica o recorte por `api` com a regra "diretoria e coordenação" |

### 5. Funções do schema `api`

Todas `security definer`, `set search_path = ''`, `execute` só para `authenticated`. Todas exigem usuário identificado com perfil ativo e a regra do perfil com MFA (seção 2).

| Função | Quem | AAL2 | Log de leitura | O que devolve |
| :-- | :-- | :-- | :-- | :-- |
| `api.transicionar(maquina, entidade_id, para, motivo)` | p1: comercial e diretoria (corrigido na integração da 0015: é o que a 0007 faz; esta linha dizia também financeiro e coordenação); p2: comercial, financeiro, coordenação, diretoria; acompanhamento e visita: coordenação, diretoria e enfermeira da família atribuída (visita: só a própria); p4: comercial, coordenação, diretoria | sim, menos p1 | não (a transição já grava `evento_familia` e `log_auditoria`) | Chama `privado.transicionar`, que confere a transição e o `papel_minimo` |
| `api.familias_do_dia(dia)` | enfermeira (as próprias visitas do dia, famílias atribuídas), coordenação e diretoria (todas) | sim | uma linha por família devolvida | Endereço de atendimento, bairro, cidade, datas, gemelar, estado sensível, visita do dia e contato principal. Nada comercial |
| `api.ficha_assistencial(familia_id)` | enfermeira (atribuída), coordenação, diretoria | sim | sim (e `assistencial.ler_acompanhamento` grava a sua) | Família (endereço, datas, idade gestacional calculada, gemelar, estado sensível; `historico_sensivel` só para coordenação e diretoria), pessoas, bebês, médicos e acompanhamentos. Nada comercial: sem origem, UTM, código de origem, indicação, oportunidade, preço, `primeira_gestacao` nem motivos de estado |
| `api.dados_contrato(pessoa_id, completo)` | comercial, financeiro, diretoria | só com `completo = true` (e sempre pela regra do perfil) | sim, nos dois modos (leitura mais restritiva; o PRD exige só no completo) | `completo = false`: CPF `***.456.789-**`, endereço sem `numero` e `complemento`, sem data de nascimento. `true`: tudo |
| `api.status_cobranca(familia_id)` | comercial, financeiro, diretoria | sim | não | Parcela, vencimento, status e data de pagamento de cada cobrança, e status da nota |
| `api.sessao_venda_gravacao(sessao_id)` | quem conduziu (comercial ou coordenação) e diretoria | sim | sim | Consentimento, caminho da gravação, transcrição e resumo |
| `api.status_equipe(regiao_id, semana)` | coordenação e diretoria (todas da região), enfermeira (só a própria) | sim | não | Estado calculado de cada dia da semana por `privado.status_profissional` (6.5, O-08) |
| `api.marketing_leads_por_origem(desde, ate)` | marketing, diretoria | pela regra do perfil | não | Por origem: leads, qualificados e ganhos. Lê só `familia_elegivel_marketing` |
| `api.marketing_funil(desde, ate)` | marketing, diretoria | pela regra do perfil | não | Por pipeline e estágio: quantidade de oportunidades. Lê só `familia_elegivel_marketing` |
| `api.lead_origem(familias)` | comercial, diretoria | pela regra do perfil | não | Por família (todas, com `familias` nulo): `origem`, `codigo_origem`, `utm`, `indicacao_medico_id` e `indicacao_familia_id` ("Lead e origem", 13) |
| `api.log_auditoria(entidade, entidade_id, desde, ate, limite)` | diretoria | sim | sim (a própria leitura) | Linhas do log (P05) |
| `api.acionar_freio(familia_id, estado, motivo)` (P09) | comercial, enfermeira, financeiro, coordenação, diretoria, e só em família que o usuário vê (`privado.tem_acesso_familia`: a mesma regra de linha da RLS de `familia`; enfermeira pelas atribuídas) | pela regra do perfil (comercial puro em AAL1, botão de um toque) | não (grava `log_auditoria` com ação `freio_acionar` e evento restrito) | Só sobe o freio. Sem motivo, cria a tarefa de justificativa para quem acionou. Devolve `desfazer_ate` (PRD 8.3 [v4.2]) |
| `api.desfazer_freio(familia_id)` (P09) | quem acionou, dentro de `freio_desfazer_segundos`, enquanto o acionamento for a última mudança do freio | pela regra do perfil | não (log `freio_desfazer`) | Volta ao estado anterior e cancela a tarefa de justificativa; execuções abortadas não voltam. Nunca vale para freio do agente ou do termo de alerta |
| `api.justificar_freio(familia_id, motivo)` (P09) | quem acionou por último, coordenação, diretoria | pela regra do perfil | não (log `freio_justificar`, motivo como "[oculto]" e HMAC) | Grava o motivo e conclui a tarefa de justificativa |
| `api.reverter_freio(familia_id, estado, justificativa)` (P09) | coordenação, diretoria | sim | não (log `freio_reverter`) | Só desce, com justificativa obrigatória. O agente e o sistema nunca revertem |
| `api.retomar_agente(conversa_id)` (P22) | comercial, coordenação, diretoria | pela regra do perfil | não (log `agente_retomado` e evento na ficha) | Botão "Devolver à Isadora": chama `privado.retomar_agente`, que limpa a pausa e o `humano_comercial` (PRD 11.7 [v4.2]). Ver ADR 0003 |
| `api.eliminar_titular(familia_id, motivo)` (P22) | diretoria | sim | não (log `eliminacao_titular` só com id e motivo) | Chama `privado.eliminar_titular` (PRD 21.3 [v4.2]). Ver ADR 0003 |
| `api.revogar_sessoes(usuario_id)` (0015, P07 item 7) | diretoria | sim, sempre | não (log `revogar_sessoes` com o id e as contagens, nada pessoal) | Apaga `auth.sessions` do usuário (os refresh tokens caem em cascata; os avulsos do formato antigo saem pelo `user_id`). Usuário inexistente: `P0002`. O access token já emitido vale até expirar (`jwt_expiry`) |
| `api.transicoes_permitidas(maquina, de)` (0015, P15) | os mesmos papéis de `api.transicionar` para a máquina | como `api.transicionar` (p1 pela regra do perfil; demais sim) | não | Linhas de `privado.transicao_permitida` (origem, destino, automatica, papel_minimo) e `pode`: o papel de quem pede passaria na conferência de papel de `privado.transicionar` (diretoria substitui qualquer papel menos saindo de `intercorrencia`; coordenação cobre enfermeira). Não substitui a conferência na hora de mover |
| `api.parametros_da_tela(chaves)` (0015, P16 e P27) | lista fechada por chave: `freio_desfazer_segundos` (comercial, enfermeira, financeiro, coordenação, diretoria); `comercial_resposta_no_app`, `agente_pausa_humano_horas` e `agente_followup_horas` (comercial, coordenação, diretoria) | pela regra do perfil | não | `chave`, `valor`, `atualizado_em`. Chave fora da lista ou do papel: `42501`. `plantao_telefones`, `agente_whitelist`, `agente_modo`, preços, textos e listas de termos ficam fora. A tabela `parametro` continua só da diretoria ("Parâmetros e configurações", PRD 13). Mudar a lista é migration nova |

`privado.status_profissional(profissional_id, dia)` segue a precedência do enum `status_profissional` (6.0, 6.5):
`em_visita` (hoje, visita com check-in e sem check-out), `em_atendimento` (designação titular aceita em acompanhamento `ativo` ou `em_execucao` com visita na semana do dia), `reservada` (titular aceita, acompanhamento `aguardando`, bebê ainda não nasceu e janela da DPP cruzando a semana), `backup` (backup aceita, família na janela), `oferta_pendente` (designação `oferecida`), `folga` (bloqueio de agenda no dia) e `livre`. A janela da DPP vem de `parametro.janela_dpp_dias` (`{"antes": 21, "depois": 14}`, a semear no P08); sem o parâmetro a função recusa, para nunca mostrar como livre uma enfermeira reservada. A regra de "em atendimento" fora do horário de visita segue pendente [confirmar: Edilaine, O-08].

### 6. Funções executáveis por papel (conferidas pelo teste 007)

Nos schemas do projeto (`public`, `privado`, `assistencial`, `agente`, `api`):

- **`anon`:** nenhuma.
- **`authenticated`:** `privado.tem_papel`, `privado.familias_atribuidas`, `privado.aal2`, `privado.sem_acento` e as vinte funções de `api` da seção 5 (`api.transicionar`, `api.familias_do_dia`, `api.ficha_assistencial`, `api.dados_contrato`, `api.status_cobranca`, `api.sessao_venda_gravacao`, `api.status_equipe`, `api.marketing_leads_por_origem`, `api.marketing_funil`, `api.lead_origem`, `api.log_auditoria` e, desde o P09, `api.acionar_freio`, `api.desfazer_freio`, `api.justificar_freio` e `api.reverter_freio`; desde o P22, `api.retomar_agente` e `api.eliminar_titular`; desde a 0015, `api.revogar_sessoes`, `api.transicoes_permitidas` e `api.parametros_da_tela`). As funções do freio, da pontuação, da deduplicação, da ocupação e do recálculo em `privado` (0009 a 0011) não entram: o app chega a elas pelos wrappers, e o agente pelo schema `agente` (P21).
- `service_role` mantém o padrão do Supabase em `public` e nada nos demais schemas; `n8n_agente` executa exatamente as funções do Apêndice A no schema `agente` (P21 e P22, ADR 0003, conferido pelo teste 013).

Toda função nova de `api` entra nesta lista, no teste 007 e no `grant` explícito da migration que a cria.

### 7. Colunas pessoais ou sensíveis no log de auditoria

Lista usada por `privado.auditar()` (P05, tabela `privado.auditoria_coluna_sensivel`): o valor vira "[oculto]" mais HMAC-SHA256 com chave no Vault.

- Lista mínima do PRD 13: `pessoa` (nome, telefone_e164, email, idade, ocupacao, consentimentos); `pessoa_dados_contrato` (cpf, data_nascimento, endereco_residencial, preenchido_via); `familia` (nome_exibicao, endereco_atendimento, bairro, dpp, data_nascimento, data_alta, data_inicio_efetivo, estado_sensivel_motivo, nao_contatar_motivo, historico_sensivel, cidade_informada); `bebe` (nome, data_nascimento, peso_nascimento_g, peso_alta_g, tipo_parto); `medico` (nome, telefone_e164, email); `oportunidade` (qualificacao, desconto_motivo); `handoff` (resumo, solicitacao, dados); `alerta_clinico` (valor_observado, sinal_identificado, orientacao_medica, conduta_adotada); `ocorrencia` (descricao, historico); `consulta_prenatal` (ficha, plano_cuidado, periodo_preferido, urgente); `registro_atendimento` (dados, resumo_descritivo); `registro_adendo` (motivo, conteudo); `relatorio_medico` (conteudo); `pos_venda` (respostas); `sessao_venda_gravacao` (transcricao, resumo); `anexo_audio` (transcricao); `mensagem` (conteudo, transcricao); `conversa` (nome_whatsapp, nome_contato_salvo, telefone_e164).
- Acréscimos da sessão P05 (leitura mais segura): `bebe.sexo`, `oportunidade.motivo_perda_detalhe`, `ocorrencia.titulo`, `relatorio_medico.destinatarios`, `pos_venda.pesquisa_token_hash`, `conversa.wa_jid` e `wa_lid`, `perfil` (nome, email, telefone_e164), `profissional` (nome, telefone_e164), `tarefa` (titulo, payload), `notificacao` (titulo, corpo), `automacao_execucao.payload`, `contrato.formulario_token_hash`.
- Mudar a lista é migration nova.

## Consequências

- Tela que precisar de uma coluna fora do `grant` ou de uma tabela sem `grant` pede função nova em `api`, com a mesma checagem de papel e AAL, entrada na seção 6 e no teste 007. Nunca se reabre `grant` direto em tabela assistencial.
- Tabela nova de `public` nasce fechada para `anon` e `authenticated` (default privileges da 0007) e com o gatilho de auditoria (teste 005). A migration que a cria escreve o `grant`, as políticas e a linha neste ADR.
- Com privilégio por coluna em `familia`, o `select *` do PostgREST (sem `select=`) é negado para todo usuário do app: as telas pedem as colunas pelo nome (`select=id,nome_exibicao,...`), inclusive no `return=representation` de inclusão e alteração. A origem do lead vem de `api.lead_origem`.
- `service_role` continua passando por cima da RLS (Supabase). A defesa contra ele são os gatilhos (append-only, auditoria, estágio) e a regra de uso só no servidor.
- O PostgREST precisa expor `api` além de `public` (configuração do projeto no P14).
- Sessão de 8 horas é configuração do Supabase Auth (`supabase/config.toml`, `[auth.sessions] timebox`, e o painel de hml e prod, `supabase/LIGAR.md`). A revogação das sessões de um usuário pela diretoria é `api.revogar_sessoes` (0015); a tela é do P07 (parte de app).

## Pendências (O-05 e relacionadas)

| Item | Padrão adotado até a aprovação | Quem |
| :-- | :-- | :-- |
| Matriz inteira (O-05) | Esta, a mais restritiva | Leonardo e Edilaine |
| Registro assistencial, áudio e relatório médico para o comercial (onboarding marcou Total) | Sem acesso; o Leonardo lê pelo papel de diretoria | Leonardo e Edilaine |
| Diretoria no assistencial | Só leitura, por função, com log e AAL2; escrita segue o papel de cada pessoa | Leonardo e Edilaine |
| Sessão gravada | Só quem conduziu e a diretoria, por função com log; `conduzida_por` só muda por função (P29). A função do P29 que liga a gravação à sessão confere quem conduziu de fato | Leonardo |
| "Lead e origem" para financeiro e coordenação (13) | Colunas de origem fora do `grant` de `familia` (comercial e diretoria por `api.lead_origem`); financeiro sem linha de lead sem contrato em `familia`, `pessoa`, `oportunidade` e `evento_familia`. Coordenação continua vendo a linha do lead, porque conduz a sessão de venda | Leonardo |
| `historico_sensivel` na ficha | Só coordenação e diretoria, por `api.ficha_assistencial` | Edilaine |
| Prazo de acesso da enfermeira depois do encerramento | `acesso_enfermeira_pos_encerramento_dias` = 7 (P08 semeia); interrupção conta como encerramento | Edilaine |
| AAL2 pelo perfil (inclusive para o Leonardo como comercial) | Adotado | Leonardo |
| Regra de "em atendimento" e janela da DPP em `api.status_equipe` (O-08) | Seção 5; parâmetro `janela_dpp_dias` novo, a semear no P08 | Edilaine |
| Contagens pequenas nos agregados de marketing | Sem supressão por enquanto (nenhum dado pessoal sai, só contagem) | Leonardo e jurídico |
| Execução de funções de extensão (`pgcrypto`, `pg_trgm` etc.) por `anon` e `authenticated` no schema `extensions` | Padrão do Supabase mantido; fora dos schemas do projeto | Drop |
| Freio: quem aciona (P09, 8.3) | Quem vê a família pela matriz (comercial, coordenação e diretoria todas; financeiro com contrato; enfermeira as atribuídas); marketing não aciona. Acionar só sobe, para todo chamador; descer é reversão ou "Desfazer" | Leonardo e Edilaine |
| "Desfazer" do freio (O-07) | Só quem acionou, até `freio_desfazer_segundos` (parâmetro ausente ou 0: sem Desfazer), e só se nada mudou no freio depois. Freio do agente ou do termo de alerta nunca tem Desfazer | Leonardo e Edilaine |
| Justificativa do freio | Quem acionou por último, coordenação ou diretoria gravam o motivo depois; a tarefa de justificativa nasce só para usuário que acionou sem motivo | Edilaine |
| Parâmetros que o comercial e a coordenação leem (0015) | `api.parametros_da_tela` com quatro chaves (`freio_desfazer_segundos`, `comercial_resposta_no_app`, `agente_pausa_humano_horas`, `agente_followup_horas`); `plantao_telefones` fica de fora (telefone pessoal da plantonista), e a tela do comercial não mostra o "Ligar para a coordenação" até decisão | Leonardo |
| Quem move o P1 | Comercial e diretoria (0007 e `api.transicoes_permitidas`); coordenação não move o P1 mesmo conduzindo a sessão de venda | Leonardo |
| Revogação de sessões (0015) | Só diretoria em AAL2, com log; o access token já emitido vale até expirar (`jwt_expiry`, 1 hora no padrão do Supabase) | Leonardo |
| `pode_enviar_mensagem` (P09) | `interna` nunca autoriza mensagem à família; janela de horário para todas as categorias; conversa iniciada pela família exigida em todo canal menos `cloud_api` | Leonardo |
