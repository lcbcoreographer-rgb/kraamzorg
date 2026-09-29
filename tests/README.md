Testes que atravessam módulo (integração) e o invariante 4 fora do Playwright.
Testes unitários vivem junto do código; Vitest e Playwright configurados no P00.
Preenchido a partir do P12 (motor offline e sincronização).

## tests/agente: roteiro de homologação da Isadora (P28)

O roteiro do Apêndice C do PRD (24 casos, mais os extras) em três camadas:

- `lib/`: os casos (`casos.ts`), as regras de conferência (`regras.ts`), o SQL de leitura e de preparo, os payloads da UAZAPI e o relatório. Tudo o que os dois executores compartilham.
- `roteiro.spec.ts` com `hml/`: o executor do ambiente real. Manda os payloads ao webhook do fluxo 3 de homologação e lê a captura da UAZAPI e o banco. Sem as variáveis do ambiente, é pulado com a lista do que falta. `pnpm e2e:homologacao`.
- `local/`: o simulador do fluxo 3 sobre o Postgres de `supabase/sem-docker`, com o modelo roteirizado (`pnpm agente:local`, precisa de `KZ_HOMOLOG_PGPORT`), e o servidor de homologação simulado que exercita o `roteiro.spec.ts` inteiro na própria máquina (`pnpm e2e:homologacao:simulada`).

Como rodar, o que cada caso confere e como ler o relatório: `docs/homologacao/isadora-MODELO.md`.
