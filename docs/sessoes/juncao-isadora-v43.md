# Junção da Isadora v4.3 com a Onda C

Data: 30/09/2026. Branch `isadora-v43` (PRD v4.3, prompt 4.3-rc1, agenda da Isadora no Google Calendar, P25b e P28 com 28 casos) juntado no branch principal por cima da Onda C (P31 a P40).

## Conflitos e como ficaram

- `supabase/seed.sql`: os parâmetros das duas frentes entraram inteiros; os da Onda C (P35 a P38) e os da agenda da Isadora (`agente_cadencia_dias`, `agenda_*`) ficaram em blocos separados.
- `supabase/tests/007_permissoes.sql`: a lista de funções `api` que `authenticated` executa ganhou as duas funções novas da Isadora (`api.consultas_equipe`, `api.responder_consulta_equipe`) depois das da Onda C.
- `src/lib/db/types.ts`: regenerado do banco local depois do reset (`pnpm db:types:local`), nunca à mão.

## Defeitos que a junção revelou e foram corrigidos

1. A 0028 refazia a trava `auditoria_coluna_sensivel_fonte_check` com uma lista fixa e apagava a fonte `sessao_p36` que a 0021 acrescentou. Agora a 0028 reconstrói a lista a partir das fontes que já existem mais a dela. A 0028 não foi aplicada em ambiente nenhum, então a correção foi feita nela mesma.
2. `supabase/tests/019_contrato_cobranca.sql` comparava o vencimento da cobrança com `current_date` (UTC), mas a função usa a data de São Paulo. Entre 21h e meia-noite de São Paulo o teste falhava. Agora compara com `(now() at time zone 'America/Sao_Paulo')::date + 3`.

## Fragilidade anotada para a revisão final (P53)

`supabase/tests/022_agenda_portal.sql` registra chegada e saída com horários de até 20 minutos atrás (`now() - interval '20 minutes'`). Nos primeiros 30 minutos depois da meia-noite de São Paulo, esse horário cai no dia anterior e a função recusa com `equipe:fora_do_dia_da_visita`, que é o comportamento certo. O código está correto; o teste precisa de um jeito de fixar o relógio ou de montar a visita no dia do horário usado. Outros testes com `now()` e cadência (028) também oscilaram exatamente na virada do dia.

## Comandos rodados na junção

```bash
PGPORT=54460 PGDATA=/tmp/kz-pg-juncao-isa supabase/sem-docker/scripts/testar.sh
PGPORT=54460 pnpm db:types:local
pnpm typecheck && pnpm lint && pnpm format:check
KZ_HOMOLOG_PGPORT=54460 pnpm test          # 165 arquivos, 2369 testes
KZ_PG_PORTA=54460 node --test n8n/build.test.mjs   # 395 de 395
```

Os e2e rodam na junção da Onda D, que vem por cima desta.
