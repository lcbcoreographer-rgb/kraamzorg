# Importar os fluxos do n8n em homologação

Passo a passo para colocar os três fluxos da Isadora na instância de homologação (PRD 19.5). Os JSON são gerados por `n8n/build.mjs` e nunca editados à mão nem montados pela interface. Nada aqui vale para produção: produção só depois do aceite em homologação e com o adaptador `cloud_api` (PRD 4.1, T-01).

Resumo da ordem: banco pronto, credenciais criadas, config do ambiente preenchido, build, **fluxo 2**, anotar o id, **rebuild do fluxo 3** com esse id, **fluxo 3**, **fluxo 1**, webhook da UAZAPI de teste, `agente_modo = teste`, ativação.

## 0. O que precisa existir antes

**n8n.** Versão 2.40.6 em homologação, a mesma da validação local (`n8n/referencia/README.md`, "Validação local"), com Node.js 24 ou mais novo. Anote a versão exata no relatório do P25: a resolução de `$('Registrar Msg Família')` dentro das ferramentas do agente precisa ser reconfirmada a cada troca de versão (PRD 19.1).

**Banco.** Os fluxos chamam só funções do schema `agente` pelo papel `n8n_agente`. Hoje as migrations do repositório criam as tabelas (`agente.base_conhecimento`, `agente_n8n.documentos`, `agente_n8n.chat_memoria`, `mensagem_modelo`, `termo_alerta`, `parametro`), mas ainda não criam as funções nem o papel. Veja a seção 9: sem o P21 e o P22 aplicados em homologação, os fluxos importam, mas não rodam.

**Serviços.** Redis acessível pelo n8n, conta da OpenAI em nome da Kraamzorg (contrato 2.6.1) com `gpt-5.1`, `gpt-4.1-mini` e `text-embedding-3-small` liberados, e uma instância **de teste** da UAZAPI (nunca o número real enquanto a conta estiver restrita, T-01).

## 1. Criar as quatro credenciais no n8n

Crie pela interface do n8n (Credentials, Add credential), com exatamente estes nomes. Os fluxos referenciam a credencial pelo id e pelo nome que estão no config; token e senha nunca entram no JSON.

| Nome no n8n | Tipo | Como preencher |
| :-- | :-- | :-- |
| `Postgres Kraamzorg Agente` | Postgres | Pooler do Supabase de homologação em modo sessão, usuário `n8n_agente.<ref do projeto>`, senha do cofre, banco `postgres`, SSL ligado. Nunca `service_role`, nunca `supabaseApi` (PRD 11.10) |
| `Redis Drop` | Redis | Host, porta, senha e banco do Redis de homologação. As chaves usam o prefixo `kz:` |
| `OpenAI Kraamzorg` | OpenAI API | Chave da conta da Kraamzorg |
| `UAZAPI Kraamzorg` | Header Auth | Nome do cabeçalho `token`, valor o token da instância de teste |

Depois de salvar cada uma, anote o id (é o trecho final da URL da credencial na interface, `.../credentials/<id>`). Importar sem erro não prova que a credencial existe ou funciona: só o teste de fumaça do P25 prova (seção 8).

## 2. Preencher o config de homologação, fora do repositório

1. Copie `n8n/config.example.json` para o lugar onde o config vai morar, **fora do repositório** (o cofre da Kraamzorg, ou uma pasta temporária sua). Se preferir o caminho padrão, `n8n/config.hml.json` também fica fora do git (`.gitignore`), mas o `--config` evita deixar o arquivo dentro do projeto.
2. Troque todo valor `EXEMPLO`:
   - `n8n.versao`: a versão instalada em homologação.
   - `credenciais.*.id` e `credenciais.*.name`: os ids anotados na seção 1 e os nomes exatos.
   - `uazapi.urlBase` e `uazapi.instancia`: URL base da UAZAPI e nome da instância de teste (o nó "Validar Origem" do fluxo 3 recusa evento de outra instância).
   - `webhooks.fluxo3Entrada` e `webhooks.fluxo1Reindexar`: dois segredos longos e aleatórios, por exemplo `openssl rand -hex 24`. Eles viram o caminho dos webhooks; quem tem acesso de edição à instância do n8n consegue ver (PRD 19.5).
   - `grupoFallbackJid`: o jid do grupo da coordenação, usado só quando `registrar_handoff` falha em saúde ou perda (PRD 19.1, ADR 0003).
   - `modelos.*`: confirme os modelos na conta. `aceitaTemperatura` diz se `options.temperature` vai no nó (armadilha 11 de `n8n/referencia/README.md`); o teste de fumaça confirma.
   - `homologacao.envioSimulado` e `homologacao.transcricaoSimulada`: com `true`, todo envio e toda transcrição vão para `homologacao.urlCaptura` (a rota `/api/teste/uazapi` do app). **Essa rota ainda não existe** (P25, item 5; `src/` fica para uma sessão do app). Enquanto ela não existir, use `false` nos dois e a instância de teste da UAZAPI de verdade.
3. Deixe `fluxo.idFluxo2` como está por enquanto; ele é conferido na seção 4.

## 3. Build

```sh
node n8n/build.mjs --env hml --config /caminho/do/config.hml.json --saida /pasta/temporaria/n8n-hml
```

Sai com três arquivos com "(HML)" no nome e no nome do fluxo. Antes de importar, rode a suíte (`node --test n8n/build.test.mjs`); ela confere, entre outras coisas, a ordem de segurança do fluxo 3, as consultas literais e a ausência de segredo nos JSON gerados com o config de exemplo.

## 4. Fluxo 2, depois o id

1. Importe `kraamzorg-pausar-ia-notificar-equipe (HML).json`:
   - pela linha de comando do servidor: `n8n import:workflow --input="kraamzorg-pausar-ia-notificar-equipe (HML).json"`; ou
   - pela interface: Workflows, Import from File.
   Importe com o **mesmo usuário (ou projeto)** que vai importar o fluxo 3: o fluxo 2 aceita só chamadas de fluxos do mesmo dono (`callerPolicy: workflowsFromSameOwner`).
2. Anote o id do fluxo importado (URL `.../workflow/<id>`, ou `n8n list:workflow`). O build grava um id estável (`0ceff455-b8e4-48c9-8fa1-50c079a4f857`) e o `import:workflow` costuma mantê-lo; a importação pela interface pode trocar.
3. Se o id for diferente do `fluxo.idFluxo2` do config, troque no config.

O fluxo 2 não tem gatilho próprio: é chamado pelo fluxo 3 e pelas ferramentas do agente, e não precisa ser ativado.

## 5. Rebuild e fluxo 3

1. Rode o build de novo (mesmo comando da seção 3) se o `idFluxo2` mudou. Os nós "Caminho de Alerta", "Mídia Recebida", `transferir_para_equipe`, `acionar_equipe_saude` e os demais que chamam o fluxo 2 passam a apontar para o id novo.
2. Importe `kraamzorg-agente-isadora (HML).json`, com o mesmo usuário do fluxo 2.
3. **Ainda não ative.** A ativação é a seção 7.

## 6. Fluxo 1

Importe `kraamzorg-ingestao-rag (HML).json`. Ele tem três gatilhos: manual, a cada 6 horas e o webhook de reindexação (`POST /webhook/<webhooks.fluxo1Reindexar>`). Só indexa itens com `status = 'aprovado'` em `agente.base_conhecimento`; a base inicial do P26 (`supabase/dados/base_conhecimento_seed.sql`) entra toda em rascunho e precisa da aprovação do Leonardo e da Edilaine antes da primeira ingestão.

Depois de importar os três, **apague os JSON gerados** da máquina: eles carregam os segredos dos caminhos de webhook e não ficam como anexo em lugar nenhum (PRD 19.5).

## 7. Webhook da UAZAPI de teste, `agente_modo = teste` e ativação

1. No banco de homologação, deixe o agente em teste e só com os números da equipe na lista, antes de qualquer ativação (pela tela do P27 quando existir; até lá, por quem administra o banco):
   ```sql
   update public.parametro set valor = '"teste"'::jsonb where chave = 'agente_modo';
   update public.parametro set valor = '["+55DDDNUMERO1", "+55DDDNUMERO2"]'::jsonb where chave = 'agente_whitelist';
   ```
   (os números ficam só no banco, nunca no repositório). Em `teste`, número fora da lista não recebe resposta, mas o filtro de saúde continua valendo e gera o aviso interno (PRD 11.7).
2. Ative o fluxo 3 no n8n. A URL de produção do webhook é `https://<host do n8n de homologação>/webhook/<webhooks.fluxo3Entrada>` (a `/webhook-test/...` só vale com o editor aberto).
3. Na instância de teste da UAZAPI, aponte o webhook para essa URL, com o evento de mensagens. Mantenha as mensagens enviadas pelo próprio número (`fromMe`): é por elas que o fluxo percebe quando alguém da equipe digitou no celular e pausa a Isadora. O eco das mensagens da própria Isadora é reconhecido por `wasSentByApi` e `track_source: "kraamzorg-agente"`.
4. Ative o fluxo 1 só depois de haver itens aprovados na base (ou rode manualmente uma vez para conferir o caminho "Nada a Indexar").

## 8. Primeiros testes em homologação (aceite do P24 ao P26)

- Teste de fumaça do P25: uma chamada do modelo de conversa e uma do classificador, com os parâmetros do config; se a conta recusar `temperature`, ajuste `aceitaTemperatura` e refaça o build.
- Duas conversas concorrentes (dois jids da lista) que chamem pelo menos um `postgresTool` cada; confira no banco que cada chamada usou o `conversa_id` da própria conversa. Falha aqui bloqueia a ativação (PRD 19.1, 11.10).
- Fluxo 2 com payloads de teste: a mensagem chega ao grupo de teste e a pausa aparece no Redis (`kz:pausa:<conversa_id>`) e no banco.
- Roteiro do Apêndice C do PRD, uma conversa nova por teste, incluindo os casos extras [v4.2].
- Fluxo 1: com itens aprovados, a ingestão cria o lote, promove e a ferramenta `base_conhecimento` devolve o item certo para cinco perguntas; uma falha no meio mantém a base anterior.

## 9. O que ainda depende do banco estar no ar

Os três JSON importam hoje (validado num n8n 2.40.6 local), mas nenhum fluxo roda de ponta a ponta sem o que segue, que é do P21 e do P22:

- O papel `n8n_agente` com senha (definida à mão a partir do cofre), `search_path` `agente_n8n, extensions`, os grants e as políticas RLS das duas tabelas de `agente_n8n` (PRD 11.10).
- Todas as funções do Apêndice A no schema `agente`, com os contratos que os nós Code esperam (descritos no topo de `n8n/src/code/estado-handoff.js`, `entrada-mensagem.js`, `modo-agente.js`, `contexto-agente.js` e `followup.js`). Os pontos que vão além do texto do Apêndice A e o P21 e o P22 precisam cobrir:
  - `registrar_mensagem` devolve `agrupamento_segundos` (lido de `agente_debounce_segundos`), `numero_equipe` e `numero_plantao`;
  - `pausar` aceita `horas` nulo (usa `agente_pausa_humano_horas`) e devolve `horas`;
  - `pode_responder` devolve `alerta_internacao_ativo`, `alerta_emocional_ativo`, `alerta_saude_sensivel_ativo` e `agente_encerrado_motivo`;
  - `ficha_para_agente` devolve `valor`, `parcela`, `pagina`, `validador.listas` e `pdf` estruturados;
  - `followups_devidos` devolve `itens`, `validador`, `enviados_hoje` e `limite_similaridade`;
  - `mensagem_sistema` aceita `instrucao_sem_aviso` e `audio_nao_transcrito`;
  - `sincronizar_memoria` aceita o papel `followup` (insere uma fala nova da IA);
  - `registrar_handoff` lê `dados._fluxo2` (`prioridade_minima`, `manter_opcoes`, `mensagem_enviada`) e `dados._fluxo3.acrescentar_ao_aberto`;
  - `promover_lote`, `descartar_lote` e `registrar_ingestao` devolvem `jsonb` com `ok` (o fluxo 1 descarta o lote quando `promover_lote` não confirma).
- Os parâmetros do agente em `parametro` (PRD 5.2): `agente_modo`, `agente_whitelist`, `agente_debounce_segundos`, `agente_pausa_humano_horas`, `grupo_whatsapp_por_destino`, `plantao_telefones`, `pdf_apresentacao`, `validador_listas` e os de ativação dos textos clínicos.
- Os textos de `mensagem_modelo` do capítulo 23 aprovados, os termos de `termo_alerta` e a matriz `parametro.handoff_matriz`.
- A rota de captura `/api/teste/uazapi` do app, se for usar `envioSimulado` ou `transcricaoSimulada`.
