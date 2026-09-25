Duplicatas e mesclagem, a parte de tela do P17 (PRD 6.10 regras 2 e 12).

- `normalizar.ts`: telefone normalizado, similaridade de nome (aproximação de `pg_trgm` em JavaScript, só para o modo demonstração) e diferença de DPP em dias.
- `deteccao.ts`: `listarDuplicatas()`. No Supabase chama a função `api.*` de detecção, que ainda não existe (0012 a 0014, outra trilha; o banco já tem `privado.buscar_duplicatas`, migration 0010, revogada de `authenticated` de propósito, à espera do wrapper). No modo demonstração calcula a mesma regra em memória.
- `mesclagem.ts`: `mesclarFamilias` (move pessoas, conversas e tarefas; se as duas têm oportunidade aberta, fecha a que não fica como `perdido` antes de mover) e `vincularNovaGestacao` (liga por `familia_anterior_id`, nunca mescla). No Supabase, o merge também depende da função pendente; o vínculo de nova gestação já escreve direto na coluna, que tem grant.
- `componentes/`: lista de duplicatas e a tela de mesclagem lado a lado.

Dono: a parte de tela do P17 (a pontuação, `privado.calcular_score`, é de outra trilha). Rotas em `src/app/(app)/pipeline/duplicatas` (este módulo não é dono da pasta de rota, só do conteúdo).
