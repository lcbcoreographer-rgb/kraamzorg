# regras-alerta

Avaliador puro da condição em JSON das regras de alerta clínico (DOC 3, PRD 9.3
e Apêndice B). Mesmo código roda no aparelho (offline) e no servidor: nenhuma
função aqui chama rede, banco ou storage. Preenchido pelo P40 (motor de
alertas clínicos), parte de biblioteca.

## Formato da condição (`regra_alerta.condicao`)

Tipos completos em `tipos.ts`. Resumo:

```ts
// Folha: compara um campo do registro do dia.
{ tipo: "comparacao", campo: "secao_2_1.temperatura_c", operador: "maior_igual", valor: 38 }

// Série: a mesma comparação precisa valer em N visitas seguidas
// (a mais recente primeiro; a atual entra quando incluirAtual !== false).
// Cobre PU-08 (37,5 a 37,9 °C em duas visitas seguidas).
{
  tipo: "serie",
  campo: "secao_2_1.temperatura_c",
  operador: "entre",
  valorMinimo: 37.5,
  valorMaximo: 37.9,
  visitasConsecutivas: 2
}

// Curva de peso do RN (RN-13): dispara por perda percentual desde o menor
// peso observado, ou por não recuperação até um dia de vida limite.
{ tipo: "curva_peso", campoPeso: "secao_3_1.peso_gramas", percentualPerdaMaximo: 10, diaVidaLimiteRecuperacao: 14 }

// Composição: "e" (todas), "ou" (alguma), "nao" (nega uma condição).
{ tipo: "ou", condicoes: [ /* ... */ ] }
```

Operadores de comparação: `igual`, `diferente`, `maior`, `maior_igual`,
`menor`, `menor_igual`, `entre` (usa `valorMinimo`/`valorMaximo`), `em` (usa
`valores`), `contem`, `presente`, `ausente`.

`campo` é um caminho pontuado dentro do registro da visita, resolvido
segmento a segmento (`obterValorPorCaminho`, em `condicao.ts`); cada
segmento é uma chave literal do objeto, nunca um número com ponto decimal
por dentro. Por isso os nomes usam `secao_2_1` (não `"2.1"`) para os itens
numerados do checklist: um ponto dentro do próprio segmento seria lido como
mais um nível de aninhamento. O formato é provisório: a chave exata nasce
com o instrumento do P39 e pode mudar sem afetar o motor, só o catálogo.

## Funções principais

- `avaliarCampo(entrada)`: chamar quando a enfermeira salva um campo do
  checklist, mesmo offline. Avalia só as regras ativas ligadas àquele campo.
- `avaliarRegistro(entrada)`: reavaliação completa de uma visita (ex.: na
  sincronização), contra todo o catálogo ativo.
- `validarFechamentoAlerta(dados)`: os quatro campos obrigatórios para
  fechar um alerta (sinal, hora do acionamento, orientação médica, conduta).
- `exigeOcorrenciaPrivada(regra)`: true só para saúde mental imediata
  (SM-01 a SM-03), que cria ocorrência privada com prioridade máxima.
- `CATALOGO_REGRAS`: o Apêndice B ligado aos campos. Uma regra nasce ativa só
  quando a "Situação" do Apêndice B diz "Fonte: DOC 3"; regra com fonte
  "v4.0" (corte sem confirmação no texto vigente, caso do RN-10) ou marcada
  `[clínico]` entra parametrizada e desligada até a aprovação da Edilaine
  (CLAUDE.md, "Clínico").
- `SINAIS_SEM_CAMPO`: os sinais do DOC 3 sem campo no checklist (K-07,
  cefaleia com alteração visual, dor torácica, convulsão, sangue nas fezes
  etc.), para o seletor manual da enfermeira. Todo item nasce com
  `pendenteAprovacaoClinica: true`: o próprio K-07 está em aberto no PRD
  (22.3) e o texto de 9.3 marca a ideia do seletor como `[clínico: validar o
seletor]`.

## Pendências para quando o catálogo virar dado no banco (fora desta sessão)

- `RegraAlerta.id` aqui é o vínculo campo→regra (pode haver mais de um por
  código do DOC 3, como PU-04); `regra_alerta.id` no banco (PRD 6.6) é o
  próprio código, com chave primária `(id, instrumento_versao)`. A migration
  que materializar este catálogo precisa reconciliar isso (por exemplo,
  compondo os vínculos do mesmo código numa única `condicao` com `"ou"`, ou
  revendo a chave primária).
- K-03 (LATCH), K-04 (dor), K-05 (pressão arterial) e os cortes sem código do
  DOC 3 (sucções por dia, apoio percebido) ficam parametrizados e inativos
  até a validação clínica listada no PRD 22.3.
