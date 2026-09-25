# ADR 0003 · Fronteira do agente (papel n8n_agente e schema agente)

Data: 25/09/2026
Relacionado: PRD.md 11.7, 11.9, 11.10, 11.11, 19.1 a 19.5, 21.3 e Apêndice A (v4.2); ADR 0001 (D-14) e ADR 0002 (permissões); migrations `0013_agente_parte1.sql` e `0014_agente_parte2.sql`; testes `013_agente_parte1.sql` e `014_agente_parte2.sql`

## Contexto

O n8n roda fora do perímetro de autenticação do app e conversa com famílias pelo WhatsApp. Se ele tivesse a chave `service_role` ou acesso de leitura às tabelas, uma mensagem com instrução maliciosa, um fluxo mal montado ou uma credencial vazada exporiam o prontuário e as fichas comerciais de todas as famílias. O PRD fecha isso com a D-14: o n8n entra no banco só por um papel próprio, que executa um conjunto fechado de funções e lê e grava só as duas tabelas que os nós LangChain exigem. Este ADR registra como isso foi construído no P21 e no P22, o contrato de cada função com os fluxos que já existiam (P23 a P26) e o que ficou em aberto.

## Decisão

### 1. Papel `n8n_agente`

- Criado na migration de forma idempotente, `login noinherit nobypassrls`, sem senha. O `alter role` seguinte reafirma `nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication` a cada aplicação, para um papel criado à mão com outro atributo não passar despercebido.
- `search_path = agente_n8n, extensions`: os nós PGVector e Postgres Chat Memory usam `tableName` sem schema e os operadores do pgvector moram em `extensions`.
- **Senha (runbook):** definida à mão por quem tem acesso ao cofre da Kraamzorg, direto no SQL Editor do projeto, com `alter role n8n_agente password '<do cofre>';`. Nunca em migration, arquivo, variável de ambiente do app ou issue. Troca de senha segue o mesmo caminho e depois a credencial "Postgres Kraamzorg Agente" do n8n é atualizada.
- **Conexão:** pelo pooler do Supabase em modo sessão (porta 5432 do pooler, não 6543), usuário `n8n_agente.<ref do projeto>`, SSL obrigatório. Modo sessão porque os nós LangChain rodam `create table if not exists` e dependem do estado da sessão (o `search_path` do papel, instruções preparadas); o modo transação do pooler não garante esse estado entre uma instrução e outra.

### 2. Privilégios (exatamente o PRD 11.10)

| Objeto | Privilégio |
| :-- | :-- |
| schema `extensions` | `usage` |
| schema `agente` | `usage`; `execute` só nas 25 funções do Apêndice A (concedido função a função) |
| schema `agente_n8n` | `usage`, `create` |
| `agente_n8n.documentos`, `agente_n8n.chat_memoria` | `select`, `insert`, `delete`; `usage` na sequência; política `for all to n8n_agente using (true) with check (true)` em cada tabela |
| `public`, `privado`, `assistencial`, `api`, `auth`, `vault`, `net`, `cron` | nada (em `public` só o `usage` de schema que o Postgres dá a todo papel; nenhuma tabela, view, sequência ou função) |

Travas: a migration 0014 falha se `n8n_agente` executar qualquer função fora da lista; o teste 013 confere a lista com `set_eq`, confere que nenhuma tabela dos schemas do projeto é legível e tenta, como `n8n_agente`, ler `familia`, `conversa`, `registro_atendimento` e `parametro`, baixar o freio e chamar funções de `privado`, `assistencial` e `api` (todas recusadas com 42501). Um job diário (`privado.conferir_agente_n8n`, pg_cron 10:45 UTC) confere que `agente_n8n` tem exatamente as duas tabelas e notifica a diretoria (canal e-mail) se aparecer outra: o `create` do schema só existe para os nós LangChain, e um `tableName` errado criaria em silêncio uma tabela sem RLS e fora da eliminação do titular.

A política `using (true)` dá ao `n8n_agente` leitura de toda a `chat_memoria`, porque o nó de memória exige. O controle de qual sessão ele lê está no build (PRD 19.5): a `query` de todo nó Postgres é literal e começa por `select agente.`, e o `conversa_id` vem sempre do nó "Registrar Msg Família", nunca de `$fromAI()`.

### 3. Contrato comum das funções do schema `agente`

- `security definer`, `set search_path = ''`, nomes qualificados, `#variable_conflict use_column` (parâmetros sempre qualificados pelo nome da função).
- Devolvem `jsonb` com `ok` e, em erro, `erro` e `codigo`. Nenhuma devolve exceção ao n8n: o bloco `exception` desfaz o que a chamada gravou e devolve `{ok: false}`. Só as mensagens das validações do projeto chegam ao n8n; o resto vira `erro_interno`, para uma mensagem do Postgres com valor de chave única (telefone, por exemplo) nunca sair do banco.
- A primeira linha de toda função é `privado.agente_contexto()`: apaga `request.jwt.claims` e as marcas `app.transicao`, `app.eliminacao` e `app.retencao_log_ip` da transação e grava `app.origem = agente`. Um n8n comprometido que forjasse um JWT para se passar por um usuário do app continua sendo "sistema sem usuário": só transições automáticas da máquina de estado, só sobe o freio, nunca baixa (PRD 8.3).
- A chave de toda função, menos `registrar_mensagem`, é o `conversa_id` (Apêndice A [v4.2]). O jid só entra em `registrar_mensagem`, que resolve a conversa.
- Nenhuma função devolve dado assistencial. O teste 013 confere o código-fonte (nenhuma função do schema `agente` nem auxiliar `privado.agente_*` cita tabela ou função assistencial; o modo `cliente` só pergunta se existe acompanhamento) e o resultado (nada do registro, do alerta clínico nem das colunas assistenciais aparece no que o agente recebe sobre uma família em atendimento).

### 4. Funções

| Função | Parâmetros | Retorno e efeito |
| :-- | :-- | :-- |
| `registrar_mensagem` | jid, direcao, enviado_por, conteudo, tipo, wa_message_id, nome_whatsapp, telefone, lid, nome_contato (todos `text`) | Resolve por LID, telefone e jid; cria ou atualiza a conversa (`wa_jid` sempre o chatid mais recente; uma conversa antiga com o mesmo jid perde o jid); liga conversa nova à família de quem tem o mesmo telefone; lê "paciente fechada" (cliente) e "paciente potencial" (lead) no nome salvo; grava a mensagem mascarada sem duplicar pelo `wa_message_id`. `{ok, conversa_id, mensagem_id, duplicada, primeira_mensagem, classificacao, numero_equipe, numero_plantao, agrupamento_segundos}` |
| `registrar_transcricao` | wa_message_id, texto | Único UPDATE em `mensagem` (coluna `transcricao`, mascarada) |
| `pode_responder` | conversa_id | `{ok, modo, motivo, agente_modo, na_whitelist, pausa, pausado_ate, humano_comercial, agente_encerrado_motivo, transferencia_aberta, alerta_internacao_ativo, alerta_emocional_ativo, alerta_saude_sensivel_ativo}`. Modos na precedência silencio, desligado, teste (fora da lista), humano_nominal, humano_comercial, nao_lead, pausado, cliente, vendas |
| `pode_enviar` | conversa_id, tipo, handoff_id | `{ok, pode, motivo}`. Tipo `resposta` ignora a pausa e o `humano_comercial` que o `handoff_id` desta execução criou (comparando com o que `registrar_handoff` gravou em `handoff.dados._agente`); bloqueia `bloqueio_total`, `encerrado_sensivel`, `humano_comercial` e pausa de outra origem; aplica a lista de teste; nunca a janela, `nao_contatar` nem o limite diário; vale sem família. `conteudo`, `operacional` e `marketing` seguem `privado.pode_enviar_mensagem` (exige família) mais pausa e modo. Falha nunca libera |
| `mensagem_sistema` | conversa_id, chave | Só `midia_recebida`, `fallback_confirmar`, `nao_lead_candidata`, `nao_lead_fornecedor`, `nao_lead_consultorio`, `audio_nao_transcrito` e `instrucao_sem_aviso`, aprovados, com o nome e a regra do nome vazio |
| `sincronizar_memoria` | conversa_id, papel, texto | Formato LangChain, `session_id = conversa.id`. `ia` troca o `content` da última fala `ai` da vez; `equipe` insere `ai` com o prefixo de `mensagem_modelo.memoria_prefixo_equipe`; `sistema` insere `system`; `followup` insere `ai`; `descartado` apaga a última fala `ai` da vez. "Da vez" = a última linha da sessão, gravada depois da última mensagem da família (nunca troca nem apaga a fala de uma resposta anterior) |
| `pausar` | conversa_id, horas, motivo | Horas nulo usa `agente_pausa_humano_horas`; nunca encurta uma pausa maior. `{ok, horas, pausado_ate}` |
| `contexto_conversa` | conversa_id, limite | `{ok, mensagens: [{de, texto, tipo, em}], iniciada_por, classificacao, posicao_ultima_resposta}`, `de` em familia, isadora, equipe, sistema |
| `checar_termos_alerta` | texto | `{ok, alerta, acao, termo, mensagem_chave, termos}`; sem acento, por palavra ou expressão inteira; `bloqueio_total` primeiro, `alerta_saude` antes de `alerta_internacao` |
| `mensagem_alerta` | conversa_id, acao, chave | Nunca devolve erro. Chaves com ativação (`alerta_internacao`, `alerta_emocional`, `alerta_saude_sensivel`) só com o parâmetro ligado e o texto aprovado; senão `alerta_saude` (ou `perda`); em último caso o texto do padrão mesmo sem aprovação, marcado `aprovado: false` |
| `ficha_para_agente` | conversa_id | Ficha no formato do cabeçalho de `isadora-system.md` (campos livres até 200 caracteres, sem colchetes nem quebra, `historico_sensivel` só sim ou não), `data_hora`, `planos`, `valores_permitidos`, `pdf_status`, `horarios_edilaine`, `valor.*`, `parcela.*`, `pagina.*`, `validador` e `pdf` |
| `planos_vigentes` | nenhum | Planos com versão vigente hoje |
| `verificar_cobertura` | cidade, bairro, uf | `{ok, status, praca, localidade, tem_taxa}`; valor da taxa só com `taxa_visivel_agente`. Localidade e alias (bairro primeiro), cidade, depois município pela região intermediária. Nunca usa DDD |
| `verificar_disponibilidade` | dpp (texto dd/mm/aaaa), cidade | `{ok, status}` com `disponivel` ou `confirmar_com_equipe` |
| `atualizar_lead` | conversa_id, dados | Chaves aceitas: nome, para_quem, dpp, semanas, cidade, bairro, uf, primeira_gestacao (primeiro_bebe), gemelar (gemeos), rede_apoio, principal_preocupacao, parceiro_participa, plano_interesse (plano), pagamento_preferido (pagamento), origem, historico_sensivel, quer_contratar, sem_interesse. O resto volta em `campos_ignorados`. Cria família, pessoa e oportunidade, deduplica pelo telefone, regra 12 (gestação nova de família atendida vira família nova com `familia_anterior_id`), move o pipeline 1 pela máquina de estado, recalcula o score |
| `registrar_marco` | conversa_id, marco, valor | pdf_enviado, sessao_interesse, quer_contratar (`oportunidade.qualificacao.quer_contratar_em`), proximo_contato (data ou semanas-alvo pela DPP), nao_contatar, sem_interesse (P1 para perdido, cancela follow-ups e retorno), nutricao |
| `registrar_handoff` | conversa_id, motivo, resumo, solicitacao, dados, origem, texto_familia | Ver seção 5 |
| `registrar_notificacao_handoff` | handoff_id, ok, erro | Falha: `notificacao_ok = false` (faixa vermelha) e notificação com canal e-mail ao papel do destino (e à diretoria em prioridade máxima) |
| `marcar_nao_lead` | conversa_id, tipo | Classifica, cancela o follow-up e devolve `texto_encaminhamento` e `instrucao_agente` aprovados. Nunca rebaixa cliente nem conversa com DPP na ficha |
| `followups_devidos` | nenhum | Reserva (`payload.reservada_em`) e devolve `{ok, itens, validador, enviados_hoje, limite_similaridade}` |
| `registrar_followup` | execucao_id, texto, ok | Saiu: executada, mensagem da Isadora, cadência 1. Não saiu: volta uma vez; na segunda, falhou e vira tarefa do comercial |
| `base_para_indexar` | nenhum | Linhas `(tipo, fonte_id, titulo, texto, pagina_pdf)`: itens aprovados, um documento por plano vigente sem valor, um por praça ativa sem taxa |
| `promover_lote`, `descartar_lote`, `registrar_ingestao` | lote_id e contagens | Troca atômica; lote vazio nunca apaga a base que está valendo |

Fora do schema `agente`, no mesmo P22: `privado.retomar_agente(conversa_id)` e `api.retomar_agente` (botão "Devolver à Isadora": comercial, coordenação ou diretoria; limpa pausa e `humano_comercial`, grava `log_auditoria` com ação `agente_retomado` e evento na ficha; "resolver" a transferência nunca chama esta função), e `privado.eliminar_titular(familia_id, motivo)` e `api.eliminar_titular` (PRD 21.3: só diretoria com AAL2; a exceção do gatilho de `evento_familia` vale só com `app.eliminacao` igual ao id da família, ligada pela própria função, e só para o dono).

### 5. `registrar_handoff`

1. `dados._fluxo3.acrescentar_ao_aberto` (modo `humano_comercial`): o texto novo vai para `dados.acrescimos` da transferência aberta mais recente, sem aviso novo (`duplicado: true`).
2. Família mínima quando a conversa não tem família: sempre para saúde, perda, estado sensível e áudio não transcrito (o freio precisa de onde ficar); para as demais, só em conversa de lead, cliente ou ainda não classificada (candidata, fornecedor e consultório não viram família). Motivo comercial de lead ganha também a oportunidade.
3. Matriz de `parametro.handoff_matriz`. Novas chaves opcionais por linha, semeadas para `midia_recebida` e `audio_nao_transcrito` (11.4 [v4.2]): `se_atendimento` (pipeline 3 em curso), `se_cliente` e `se_nao_cliente` sobrepõem destino, prioridade e SLA. Saúde e perda sem linha na matriz ainda são registradas como coordenação clínica, máxima, imediato (regra de segurança, com aviso). `dados._fluxo2.prioridade_minima` só sobe.
4. SLA: prioridade máxima é sempre imediata; `sla_horas_uteis` pelo `parametro.expediente_comercial`; `sla_horas`, `sla_horas_corridas`, `sla_dias` corridos.
5. Deduplicação só de motivos comerciais: mesma conversa, mesmo motivo, mesmo hash da solicitação normalizada, dentro de `parametro.handoff_dedup_minutos`. Saúde, perda e estado sensível nunca são deduplicados: dentro da mesma janela reaproveitam a transferência aberta (o motivo sobe para o mais urgente), acumulam `textos_familia` e sempre devolvem o aviso ao grupo e o plantão de novo, com o prefixo de `grupo_prefixo_atualizacao`.
6. Freio: perda para `bloqueio_total`, saúde para `atencao`, por `privado.acionar_freio` como sistema; só sobe. Falha do freio ou da família mínima nunca impede o registro nem o aviso.
7. Pausa com `agente_pausa_handoff_horas` (nunca encurta uma maior) ou `humano_comercial`: `reuniao`, `contratar` e `condicao_comercial` sempre, e qualquer transferência ao comercial com a oportunidade em `qualificado` ou adiante (motivo gravado `qualificado`).
8. Texto do grupo pelo motivo final (23.3), com o resumo interno montado pelo banco, `{mensagem_enviada}` de `dados._fluxo2` (ou `grupo_mensagem_nao_enviada`), `{observacao}` de perda anterior, `{opcoes}` (e `manter_opcoes` quando o modelo não tem a variável), `{link_ficha}` de `parametro.link_ficha_modelo` e o rodapé (`grupo_rodape_pausa` ou `grupo_rodape_humano_comercial`). A barra vira quebra de linha. Plantão só em prioridade máxima. Instrução ao agente pela chave do 23.4, só aprovada.

### 6. Leituras adotadas onde o PRD deixa margem (a mais segura)

- **Texto ao grupo interno em rascunho sai, marcado `mensagem_grupo_aprovada: false`.** O 6.8 diz que as funções do agente só devolvem texto aprovado; o 11.4 e o 8.2 dizem que saúde e perda sempre avisam a coordenação. Um aviso interno em rascunho não chega à família; silenciar o grupo por falta de aprovação seria o erro caro. Texto para a família e instrução ao agente: só aprovados, sempre.
- Número da equipe = telefone de perfil ativo ou de profissional ativa.
- Modo `cliente` também para conversa marcada "paciente fechada" e para oportunidade em distrato ou intercorrência depois da assinatura.
- `agente_modo` ausente ou inválido vale `desligado`.
- Transferência "aberta" = `aberto` ou `assumido`.
- Janela de deduplicação em parâmetro (`handoff_dedup_minutos`, 10 no seed); sem o parâmetro, nada é deduplicado.
- `followups_devidos`: fora da janela e com conteúdo já enviado no dia, a execução fica agendada; os demais motivos cancelam com o motivo gravado (inclusive agente desligado e fora da lista de teste, para não disparar follow-up velho quando o agente for ligado). Só sai follow-up quando a última fala foi da Kraamzorg. `privado.agendar_followup_d1` (0012) passou a deduplicar por qualquer status, para uma execução abortada ou cancelada não ser recriada a cada 5 minutos.
- `eliminar_titular` inclui as famílias mescladas na eliminada, esvazia a qualificação comercial e as opções da sessão de venda, marca `nao_contatar` e cancela as execuções agendadas.
- Formato da ficha (legendas e limite de 200 caracteres), o prefixo "[eliminado]", "Titular eliminado" e as convenções "paciente fechada"/"paciente potencial" são formato definido pelo PRD, não texto nem regra ajustável. Os textos que o PRD define para o grupo e para a memória viraram chaves de `mensagem_modelo` (rascunho no seed): `grupo_rodape_pausa`, `grupo_rodape_humano_comercial`, `grupo_prefixo_atualizacao`, `grupo_mensagem_nao_enviada`, `grupo_observacao_perda_anterior`, `resumo_ia_fora_do_ar` e `memoria_prefixo_equipe`.

### 7. Diferenças deliberadas em relação aos fluxos da Enjoy (P23)

- Banco por papel restrito e funções Postgres no lugar de RPC com credencial do Supabase: o n8n nunca tem `service_role` nem chave anônima.
- PGVector (`agente_n8n.documentos`) no lugar do vector store do Supabase.
- Memória em Postgres (`agente_n8n.chat_memoria`) no lugar do Redis com expiração, para caber na retenção (`retencao_diaria`) e na eliminação do titular.
- Token da UAZAPI em credencial do n8n, nunca lido do corpo do webhook.
- Exceção à regra "nenhum destino no fluxo": `grupo_fallback_jid` no config do build, usado só quando `registrar_handoff` falha em saúde ou perda (PRD 19.1).

## Consequências

- Todo campo novo que o agente precisar ler é uma função nova ou uma mudança de função neste schema, com teste; nunca um `grant` de tabela.
- Mudança no formato da ficha, do resumo interno ou da memória precisa acompanhar `n8n/prompts/` e os nós Code.
- O teste de duas conversas concorrentes do P25 (a expressão `$('Registrar Msg Família')` dentro de ferramenta) continua sendo a garantia de que o `conversa_id` não se mistura; o banco não tem como saber que conversa originou a chamada.

## Divergências entre os fluxos gerados e as funções (para o n8n ajustar)

As funções seguem o PRD; estes pontos precisam de ajuste no n8n:

1. `registrar_mensagem.classificacao` devolve o enum (`nao_classificado` quando a conversa ainda não foi classificada). O fluxo 3 (`aplicarClassificacaoMensagem`) testa `!classificacao_conversa`, então nunca reconhece a conversa como "ainda não classificada" e o nó 22 (não lead no início) não dispara. O fluxo deve tratar `nao_classificado` como não classificada.
2. `sincronizar_memoria` com o papel `descartado` (Apêndice A [v4.2], nós 27, 29 e 35) não é chamado em nenhum caminho do fluxo 3: quando nada sai para a família (saúde, perda, `[SILENCIO]`, violação que persiste), a fala do modelo continua na memória.
3. A descrição da ferramenta `atualizar_ficha` não diz as chaves que o banco aceita (seção 4); o modelo inventa nomes e o que não bate volta em `campos_ignorados`. Pôr as chaves na descrição ou no `$fromAI`.
4. `parametro.pdf_apresentacao` tem `path` (caminho no bucket), não a URL pública; `ficha_para_agente.pdf.url` devolve `url` se existir e senão o `path`. O envio do nó 34 precisa da URL: acrescentar `url` ao parâmetro por ambiente ou montar a URL no fluxo a partir do config.
5. `parametro.validador_listas` do seed traz só `palavras_evitadas`, `promessas` e `escassez`; o validador também lê `pedido_dado`, `pedido_verbos`, `negar_assistente` e `palavras_condicao` (PRD 11.11 item 5). Dado a completar, sem mudança de função.

## Pendências

| Item | Padrão adotado | Quem |
| :-- | :-- | :-- |
| Lista exata de motivos que põem a conversa em `humano_comercial` | PRD ao pé da letra (seção 5, item 7) | Leonardo |
| Textos novos de `mensagem_modelo` (seção 6) | Rascunho no seed; os do grupo saem mesmo assim, marcados | Leonardo |
| Destino e SLA de mídia e áudio de cliente | `se_cliente`, `se_atendimento` e `se_nao_cliente` na matriz | Edilaine |
| `api.pausar_conversa`, `api.retomar_pausa_conversa`, `api.resolver_transferencia` (desfecho), wrappers da base de conhecimento e `api.metricas_agente`, pedidos pelo P27 | Fora do escopo do P21 e P22 | Próxima sessão de banco |
| Código de origem do link na primeira mensagem (P47) | Não lido ainda | P47 |
