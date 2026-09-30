# P41 · Evoluções aos médicos (telas, banco e envio)

Data: 30/09/2026
Branch: `worktree-wf_ee6c2935-920-6` (worktree isolado, criado a partir de `claude/kraamzorg-delivery-review-6kzd8q`). Migration `0024_evolucao_ocorrencia_nf.sql` (compartilhada com P42 e P43), teste `supabase/tests/024_evolucao_ocorrencia_nf.sql`.

Esta sessão é a onda B do P41: a parte de banco, de telas e de envio por e-mail, sobre a biblioteca `src/lib/pdf` que a sessão anterior entregou (`docs/sessoes/P41.md`, que não mudou). Ficam registradas juntas, num commit só, P41, P42 e P43 do lado do banco e da interface.

## Feito

### Banco (`0024`, seção 3)

1. `relatorio_medico` ganha `versao` de edição, `erros_validacao`, conteúdo `{ dados, conteudo }`, restrições de estado e de caminho do PDF (`evolucoes/<id>.pdf`). Continua **sem grant e sem política** (PRD 6.10 regra 6): leitura só por `assistencial.ler_*`, que grava `log_auditoria` antes de devolver; escrita só por funções `api`.
2. Funções `api`: `base_evolucao`, `evolucoes`, `evolucao`, `salvar_evolucao`, `enviar_evolucao_para_revisao`, `devolver_evolucao`, `aprovar_evolucao`, `dados_envio_evolucao`, `registrar_envio_evolucao`, `pdf_evolucao`. Todas `security definer`, `search_path = ''`, papel e AAL2 conferidos por dentro.
3. Aprovação exige `erros_validacao = []` e o e-mail do médico da especialidade certa (obstetra no puerperal, pediatra no neonatal). Conclusão incoerente entra como erro e trava a revisão e a aprovação.
4. Prazo em dias úteis (`parametro.feriados`): aviso em D+1 e escalada à coordenação em D+2, na etapa `privado.recalculo_prazo_relatorio` do recálculo diário. Nenhum prazo no código.
5. Registro do envio cria a tarefa de mandar a evolução à família (K-10) e o evento restrito na linha do tempo. Mensagem à família continua saindo só pelo adaptador de mensageria; o e-mail ao médico não é mensagem à família.

### Aplicação

1. `src/modules/assistencial/evolucao/`:
   - `agregar.ts`: do registro do checklist (DOC 2) e dos cadastros para a entrada dos geradores. Função pura. O que o checklist não registra (K-01) fica em branco, nunca presumido; textos-padrão vêm de `mensagem_modelo` (`evo_*`), rótulos de orientação vêm do instrumento.
   - `campos.ts`: descritores dos campos que a enfermeira confere (o que falta e o julgamento). Um campo novo entra num lugar só. Nenhum campo clínico foi criado: são os de `src/lib/pdf/tipos.ts`.
   - `montar.ts`: valida e monta; conclusão sugerida pelo período (aleitamento, ganho de peso, icterícia) que ela confirma ou troca.
   - `envio.ts`: imprime o PDF do conteúdo aprovado, guarda em `evolucoes/<id>.pdf` (storage privado), manda um e-mail por médico com o PDF em anexo e registra o resultado. Assunto vem de `mensagem_modelo`, conferido contra todos os nomes da família; anexo com o id no nome. Qualquer falha vira `erro_envio` com o motivo e botão de reenviar.
   - `acoes.ts`, `dados.ts`, `pdf-rota.ts` e os componentes de lista, editor e prévia.
2. Telas: `/evolucoes` (coordenação e diretoria), `/minhas-evolucoes` (enfermeira, só dos acompanhamentos dela), com documento por apelido (`puerperal`, `bebe-1`, `bebe-2`) e rota de PDF (enviado, por URL assinada de 60 s, ou prévia gerada na hora).
3. Fábrica de e-mail (`obterEmail`): demonstração guarda na caixa de saída local e aplica a mesma guarda de assunto e anexo; fora dela usa o Resend com `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.
4. `armazenamento/caminhos.ts` aceita `evolucoes/<id>.pdf` e `notas/<id>.<pdf|xml>` e nada mais.

## Ficou de fora (e por quê)

- Refazer o rascunho a partir do checklist depois de criado: o rascunho é uma foto do momento. Se uma visita for corrigida por adendo depois, a coordenação edita o documento; refazer é decisão de produto.
- Edição livre dos parágrafos montados: a enfermeira edita os campos (K-01 e julgamento), não o texto final. Texto clínico só muda em `mensagem_modelo`, com aprovação da Edilaine.
- Envio da evolução à família: a tarefa é criada para a coordenação (K-10); o envio é manual pelo canal de mensagens.
- Aviso push do prazo: a notificação interna existe (`notificacao`); o push depende do P18.
- Aprovação parcial (um documento por vez já é possível; aprovar os dois de uma vez não).

## Decisões tomadas

1. Controle de concorrência pela coluna `edicao`, não por `versao`: a regra 13 do PRD reserva `versao` às tabelas do registro offline (teste 004 confere). O campo da tela se chama "versão".
2. Nome de arquivo e URL só com ids: `evolucoes/<id>.pdf`, rota `/evolucoes/<acompanhamento>/<puerperal|bebe-N>/pdf`. Nome de família só aparece dentro da página, nunca em título de aba, URL, assunto, anexo ou metadado.
3. Envio sai da ação de servidor, não do banco, porque o banco não fala com terceiros. O conteúdo aprovado é o que o PDF imprime: a leitura de `dados_envio_evolucao` fica no log.
4. Falha antes do envio (contato da coordenação vazio, texto do e-mail faltando) também vira `erro_envio` com o motivo, para a tela mostrar por que e reenviar.

## Pendências novas

- [confirmar] Edilaine: revisão dos textos `evo_*` (todos em rascunho), do tratamento, da coordenação e do canal de contato do e-mail (`parametro.evolucao_email`; o envio só sai com coordenação e contato preenchidos).
- [confirmar] Edilaine: feriados que a equipe não atende (`parametro.feriados`, hoje vazio: conta só segunda a sexta).
- [clínico] Campos sem lugar no checklist (K-01): SpO2, aspecto dos lóquios, complemento em ml, intensidade da icterícia. Continuam opcionais e só saem quando informados.
- [confirmar] Bucket `documentos`: em produção, incluir `application/xml` nos tipos permitidos (o `supabase/config.toml` local já inclui; a nota manual aceita XML).

## Como testar

```sh
pnpm typecheck && pnpm lint && pnpm format:check
pnpm vitest run src/modules/assistencial/evolucao src/lib/pdf src/lib/dados
supabase/sem-docker/scripts/testar.sh          # inclui 024_evolucao_ocorrencia_nf.sql
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=3410 pnpm e2e:evolucao-ocorrencia-nf
```

Roteiro manual (demonstração, `KZ_DADOS=demonstracao NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm dev`):

1. Entre como Enfermeira, abra Hoje, "Evoluções para os médicos", Família Teste Aurora, "Evolução puerperal", "Montar o rascunho com o checklist".
2. Preencha o grau da lesão, o aleitamento observado, os sinais vitais na referência e a conclusão. Escolha "Exclusivo" na conclusão com "Misto" observado: o salvamento lista o ponto e trava o envio.
3. Corrija, salve, "Enviar para a revisão da coordenação".
4. Entre como Coordenação, abra a mesma evolução, "Ver como PDF" e "Aprovar e enviar ao médico".

## Aceite do prompt

- Seed do acompanhamento gera os PDFs certos: `evolucao.test.ts` (dois PDFs por id, conteúdo, gemelares) e pgTAP 024.
- Conclusão incoerente bloqueia a aprovação: `evolucao.test.ts` e `evolucao.spec.ts`.
- E-mail com anexo e assunto sem dado pessoal: `evolucao.test.ts`, `envio.test.ts` e `fabrica-email-nfse.test.ts`.

## Estado dos testes ao fechar (P41, P42 e P43)

- `pnpm lint` (um aviso antigo em `n8n/referencia/comparar.mjs`), `pnpm format:check`, `pnpm typecheck` e `pnpm test` (2.462 testes) passam. `gitleaks detect` sem achados.
- pgTAP: `024_evolucao_ocorrencia_nf.sql` passa inteiro (191 testes) e nenhum outro arquivo mudou de resultado. **`022_agenda_portal.sql` falha antes do fim quando a máquina passa da meia-noite de Brasília** (`equipe:fora_do_dia_da_visita`, teste da chegada de "hoje" dependente do relógio). Conferido sem a `0024` (banco só com as migrations anteriores e o seed do commit de partida): a mesma falha, no mesmo ponto. Não é desta sessão; fica registrado para a dona da P37 e P38.
- Playwright `pnpm e2e:evolucao-ocorrencia-nf`: 38 testes (19 no celular de 390 px e 19 no computador) passam, com axe sem violação grave e sem rolagem lateral. O e2e achou dois defeitos que os testes de unidade não pegavam e que estão corrigidos e cobertos: salvar o formulário com a lista de orientações em branco quebrava o montador, e botões com rótulo longo estouravam a largura do celular.
- O teste de e2e de "tela em construção" do acolhimento passou a usar `/financeiro` (a tela de notas deixou de ser placeholder).
