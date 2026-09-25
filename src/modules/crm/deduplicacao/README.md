Duplicatas e mesclagem, a parte de tela do P17 (PRD 6.10 regras 2 e 12).

- `normalizar.ts`: telefone normalizado, similaridade de nome (aproximação de `pg_trgm` em JavaScript, só para o modo demonstração) e diferença de DPP em dias.
- `deteccao.ts`: `listarDuplicatas()`. No Supabase chama `api.buscar_duplicatas_pipeline()` (migration 0017, mesma regra de `privado.buscar_duplicatas` da 0010) e devolve os pares como vêm; `indisponivelNoBanco` só quando a função não existe no banco. No modo demonstração calcula a mesma regra em memória.
- `mesclagem.ts`: `mesclarFamilias` (move pessoas, conversas e tarefas; se as duas têm oportunidade aberta, fecha a que não fica como `perdido` antes de mover) e `vincularNovaGestacao` (liga por `familia_anterior_id`, nunca mescla). No Supabase, os dois passam por `api.mesclar_familias` e `api.vincular_nova_gestacao` (migration 0017), que conferem papel, AAL e as regras do banco.
- `componentes/`: lista de duplicatas e a tela de mesclagem lado a lado.

Dono: a parte de tela do P17 (a pontuação, `privado.calcular_score`, é de outra trilha). Rotas em `src/app/(app)/pipeline/duplicatas` (este módulo não é dono da pasta de rota, só do conteúdo).
