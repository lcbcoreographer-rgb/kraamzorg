# P17 · Deduplicação, mesclagem e pontuação de leads (parte de banco)

Data: 25/09/2026 (relatório escrito na integração da trilha de banco)
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`. `0010_score_dedup.sql` e `supabase/tests/010_score_dedup.sql` entraram no commit de segurança `905fc88`. A parte de tela está em `docs/sessoes/p15-p17-pipeline.md`.

## Feito

1. **`privado.telefone_normalizado(telefone)`**: só dígitos; celular
   brasileiro com e sem o nono dígito viram a mesma chave.
2. **`privado.buscar_duplicatas(familia_id)`**: duplicata certa por telefone
   normalizado; duplicata provável por similaridade de nome (`pg_trgm` pela
   função qualificada `extensions.similarity`, sem operador, limiar em
   `parametro.deduplicacao`) com DPP a até `dpp_dias`; mesmo telefone com
   data muito distante vira sugestão de nova gestação (regra 12), nunca de
   mesclagem. Família mesclada fica de fora.
3. **`privado.vincular_nova_gestacao(familia_id, familia_anterior_id)`**:
   o vínculo da regra 12, com papel, ciclo e ordem das datas conferidos e
   evento na linha do tempo.
4. **`privado.calcular_score(familia_id)`**: pesos de `parametro.score_pesos`
   (eixos 40, 35 e 25 do PRD 7.1, componentes de 0 a 1) e cortes de
   `parametro.score_cortes` (70 e 40); grava `score` e `classificacao` na
   oportunidade aberta.
5. **Recálculo a cada dado novo**: gatilhos nas tabelas que alimentam a
   pontuação; o recálculo diário entra como etapa de
   `privado.recalculo_diario` (0011) por `privado.recalculo_score()`.
6. `score` e `classificacao` saíram dos `grant` de `insert` e `update` de
   `authenticated` (pendência que o P07 tinha deixado no ADR 0002).
7. Teste `010_score_dedup.sql` (43 asserções): três perfis (quente 92, morno
   53, frio 9) e o bebê já nascido (65), com a conta conferida à mão; sem
   parâmetro a função recusa e a escrita que alimenta a ficha não falha;
   deduplicação certa, provável e nova gestação; vínculo; privilégios.

## Ficou de fora (e por quê)

- Tela de mesclagem lado a lado, o movimento de conversas, mensagens,
  tarefas e oportunidades, e os e2e de mesclagem: parte de tela do P17. As
  funções `api.buscar_duplicatas_pipeline`, `api.mesclar_familias` e
  `api.vincular_nova_gestacao` que a tela já chama por `rpcPendente` ainda
  não existem (`docs/sessoes/CRM-integracao.md`); ficam para a próxima
  sessão de banco, com a regra do P17 item 2 (a oportunidade que sai passa
  para `perdido` por `privado.transicionar` antes de mover).

## Decisões tomadas nesta sessão

- Parâmetro ausente ou inválido: a função recusa (`22023`) em vez de chutar
  número; o gatilho engole a recusa para a escrita da ficha nunca falhar
  pela pontuação, e o recálculo diário registra a etapa como erro.
- Critérios de cada componente também em parâmetro (engajamento, faixas de
  trimestre, proximidade da DPP), nada fixo no SQL.
- Mesmo telefone com DPP muito distante (`nova_gestacao_dias`) sugere
  vínculo de nova gestação, nunca mesclagem.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- Pesos internos e critérios de `score_pesos`; `limiar_nome` e
  `nova_gestacao_dias` [confirmar: Leonardo].
- Funções `api` da mesclagem para a tela do P17.

## Como testar

Sem Docker (esta máquina), na raiz do repositório:

```bash
cd supabase/sem-docker
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/iniciar.sh    # sobe o Postgres 16 local (idempotente)
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/testar.sh     # reset do zero + seeds do config.toml + pg_prove
PGPORT=54342 PGDATA=/tmp/kz-pg-final scripts/parar.sh
cd ../..
node supabase/checar-seed.mjs
```

Um arquivo só, depois de um `scripts/resetar.sh` (o `000_harness.sql` cria o
schema `testes` que os outros usam):

```bash
sudo -u postgres pg_prove --host 127.0.0.1 --port 54342 --dbname kraamzorg --username postgres \
  supabase/tests/000_harness.sql supabase/tests/ARQUIVO.sql
```

Com Docker (prova final antes de qualquer `db push`, `supabase/LIGAR.md`):

```bash
supabase start
supabase db reset     # migrations + [db.seed] de supabase/config.toml
supabase test db
```

## Resultado dos invariantes

Reset do zero e suíte inteira na integração da trilha de banco (porta 54342,
`PGDATA=/tmp/kz-pg-final`, seeds de `[db.seed]`): `Files=17, Tests=1971,
Result: PASS`. Invariante 1 (máquinas de estado): `006_maquinas_estado.sql`
verde. Invariante 2 (permissões): `007_permissoes.sql` e `015_crm_apoio.sql`
verdes. Invariante 3 (freio): `009_freio.sql` verde. Invariante 4
(sincronização offline) é do app (P12, `pnpm e2e:offline`) e não foi rodado
nesta integração, que só mexeu no banco.
