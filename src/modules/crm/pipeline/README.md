Pipeline 1 (entrada e qualificação) e pipeline 2 (venda e pré-atendimento), P15.

- `estagios.ts`: rótulos e a cópia local de `privado.transicao_permitida` (0006) usada para montar o menu "Mover para". Se a migration mudar as transições, este arquivo precisa acompanhar (fica fora da pasta do módulo).
- `idade-gestacional.ts`: `ig(dpp, data)` do lado da tela, para o cartão e o filtro de semanas. Nunca grava nada.
- `dados.ts`: usa `obterRepositorios().familias` (fundação) para listar, contar e transicionar; acrescenta motivo/detalhe da perda e o cadastro manual de lead (P15 item 4), que ainda não tem função `api.*` própria (0012 a 0014 são de outra trilha).
- `acoes.ts`: Server Actions chamadas pelos componentes de `componentes/`.
- `componentes/`: cartão da oportunidade, quadro (lista no celular, kanban no computador), menu "Mover para", folha de perda e o formulário de cadastro manual.

Dono: P15. Rota em `src/app/(app)/pipeline`.
