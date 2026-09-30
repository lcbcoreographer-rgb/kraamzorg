# Congelamento do desenvolvimento

P52 (PROMPTS.md): a partir de 13/11/2026 o desenvolvimento congela. Só entra correção de defeito do que já existe, e cada correção volta para `hml`, nunca direto para `main`. A versão candidata recebe a tag `v1.0.0-rc.1`, e a homologação final (P53) e o treinamento (P54) trabalham em cima dela.

## De onde vêm a data e a tag

Os dois valores moram em `parametro.congelamento_desenvolvimento`, com a data e a tag da versão candidata. O painel executivo (`/painel`) lê esse parâmetro e mostra a contagem: "O desenvolvimento congela em 13/11/2026, com a tag v1.0.0-rc.1: faltam N dias." Para mudar a data ou a tag, edite o parâmetro pela tela de configurações; o código não guarda nenhum dos dois.

## Como congelar

1. Todas as sessões da Fase 3 (P45 a P51) já estão em `hml`, com os quatro invariantes verdes.
2. Ensaio, sem criar nada:

   ```bash
   scripts/congelar-desenvolvimento.sh --tag v1.0.0-rc.1 --data 2026-11-13 --com-testes
   ```

   O script confere o ramo (`hml`), a árvore limpa, que a tag ainda não existe, o gitleaks e, com `--com-testes`, `pnpm lint`, `pnpm typecheck` e `pnpm test`. Ele avisa que `supabase test db` (ou `supabase/sem-docker/scripts/testar.sh`) e `pnpm e2e:offline` precisam ser rodados à parte.

3. Com tudo verde, cria a tag anotada local:

   ```bash
   scripts/congelar-desenvolvimento.sh --tag v1.0.0-rc.1 --data 2026-11-13 --criar-tag
   ```

4. Publicar a tag é um passo à parte, controlado por uma pessoa: `git push origin v1.0.0-rc.1`. O script nunca faz push.

## O que o script nunca faz

- Não faz push, não mexe em `main` e não aplica migration.
- Não congela sozinho no dia: quem congela é a pessoa que roda o script, depois de olhar o painel.
- Não decide a data nem a tag: as duas chegam por argumento, vindas do parâmetro.

## Depois do congelamento

- Defeito encontrado na homologação vira branch `fix-nome-curto` a partir de `hml`, com teste que reproduz o defeito.
- Mudança de escopo ou de regra não entra. Vai para a lista de pendências do capítulo 22 do PRD, para depois da entrega.
- A promoção de `hml` para `main` só acontece depois do aceite final (P54), num passo controlado.
