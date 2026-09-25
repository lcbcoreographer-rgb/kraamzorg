Motor offline: rascunho por campo, fila de sincronização e cache do dia com Dexie.
Base do invariante 4: nada se perde sem conexão. Preenchido pelo P12.

- `tipos.ts`: tipos compartilhados (item de fila, entidade, conflito).
- `db.ts`: banco Dexie (rascunhos, fila, cache do dia, cache de regras).
- `motor.ts`: `salvarCampo` (grava local e enfileira no mesmo instante,
  com instante de criação crescente e `versaoBase` encadeada),
  `enfileirarRegistroAssistencial` (registro assistencial inteiro),
  `processarFila` (sobe a fila pendente inteira na ordem, espera crescente,
  um processamento por vez) e os gatilhos de envio.
- `cache.ts`: cache do dia (24 horas); no logout e na sessão revogada apaga
  o cache e o que já subiu, mantendo só a fila pendente.
- `protocolo.ts`: lógica de `POST /api/sync`, com idempotência, ordem,
  conflito por versão e adendo do registro assistencial. Chamada pela rota
  em `src/app/api/sync/route.ts` e testada direto (sem HTTP) pelo invariante 4.
- `repositorio.ts` e `repositorio-memoria.ts`: porta de gravação no banco.
  A implementação real (Supabase, via `api.*`) fica para quando `src/lib/db`
  (P01) e os formulários assistenciais (P34 a P39) existirem; ver o
  comentário em `repositorio.ts` e `docs/sessoes/P12.md`.

Demonstração manual em `/dev/sync` (fora de produção). Testes do
invariante 4 em `*.test.ts` (Vitest, fake-indexeddb) e em
`tests/e2e-offline/` (Playwright, rede desligada).
