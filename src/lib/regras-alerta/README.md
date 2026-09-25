# regras-alerta

Avaliador puro da condição em JSON das regras de alerta clínico (DOC 3, PRD 9.3
e Apêndice B). O mesmo código roda no aparelho (offline) e no servidor: nenhuma
função aqui chama rede, banco ou storage. Preenchido pelo P40 (motor de
alertas clínicos), parte de biblioteca.

## De onde vêm as regras

As regras avaliadas são as linhas de `regra_alerta` (PRD 6.6 e 15: "as regras
vêm de `regra_alerta` em cache local"). Quem chama lê as linhas, converte cada
uma com `regraDoBanco` e passa a lista em `catalogo`, que é obrigatório em
`avaliarCampo` e `avaliarRegistro`. Não existe catálogo padrão escondido: limite
clínico não mora no código (CLAUDE.md).

```ts
const cache = linhasDeRegraAlerta.map(regraDoBanco);
const problemas = validarCatalogo(cache); // regra ativa sem campo ou com condição inválida
const alertas = avaliarCampo({
  campo: "2.1.temperatura",
  registro, // registro da visita, com o campo recém salvo
  serieAnterior, // visitas anteriores, mais recente primeiro (PU-08, RN-13)
  contexto, // pesoNascimentoGramas, diaVidaAtual (RN-13)
  catalogo: cache,
});
```

`CATALOGO_REGRAS` é só referência: o Apêndice B escrito no formato do motor,
com os mesmos caminhos, JSON e ativação das linhas de `regra_alerta` do seed
(o teste `catalogo.test.ts` lê `supabase/seed.sql` e falha se divergirem). Serve
de base para a sessão de banco preencher as condições `[clínico]` depois da
aprovação da Edilaine.

## Formato da condição (`regra_alerta.condicao`)

O motor aceita dois formatos. Qualquer JSON fora deles é recusado por
`normalizarCondicao` e nunca dispara (e `validarCatalogo` aponta a regra).

### Formato curto (o que o seed grava hoje)

```json
{ "campo": "2.1.temperatura", "operador": ">=", "valor": 38 }
{ "campo": "3.1.temperatura", "operador": "fora_da_faixa", "min": 36, "max": 38 }
```

Operadores: `=`, `!=`, `>`, `>=`, `<`, `<=` (com `valor`), `entre` e
`fora_da_faixa` (com `min` e `max`; `fora_da_faixa` dispara abaixo de `min` ou
acima de `max`, nunca nas bordas).

### Formato completo (com `tipo`)

```ts
// Folha: compara um campo do registro do dia.
{ tipo: "comparacao", campo: "2.1.temperatura", operador: "maior_igual", valor: 38 }

// Série: a comparação precisa valer em N visitas seguidas, da mais recente
// para trás (a atual entra quando incluirAtual !== false). PU-08.
{ tipo: "serie", campo: "2.1.temperatura", operador: "entre",
  valorMinimo: 37.5, valorMaximo: 37.9, visitasConsecutivas: 2 }

// Curva de peso do RN (RN-13): perda percentual desde o menor peso observado
// (K-11) ou peso de nascimento não recuperado até o dia de vida limite.
{ tipo: "curva_peso", campoPeso: "3.1.peso", percentualPerdaMaximo: 10, diaVidaLimiteRecuperacao: 14 }

// Composição: "e" (todas), "ou" (alguma), "nao" (nega uma condição).
{ tipo: "ou", condicoes: [ /* ... */ ] }
```

Operadores de comparação: `igual`, `diferente` (campo sem resposta não
dispara), `maior`, `maior_igual`, `menor`, `menor_igual` (exigem `valor`
numérico), `entre` (`valorMinimo` e `valorMaximo`), `em` (`valores`), `contem`
(seletor de múltipla escolha: lista que contém o valor, ou o próprio valor),
`presente`, `ausente`.

### Valores e caminhos

- `campo` é um caminho pontuado. `obterValorPorCaminho` aceita a numeração do
  checklist guardada como chave literal (`{"2.1": {"temperatura": 38}}`) ou
  aninhada (`{"2": {"1": {"temperatura": 38}}}`), porque a definição do DOC 2
  no `instrumento` (P34) ainda não fixou uma.
- Número digitado como texto ("38,2" ou "38.2") conta como número; texto livre
  ("38,2 graus") não conta, e campo vazio nunca dispara.
- `avaliarCampo` liga a regra ao campo salvo pelo `campo` da regra (ou um
  subcampo dele) e por todo campo que a condição consulta. No seed, PU-04 tem
  campo `2.2.ferida_operatoria` e condição em `2.2.sem_sinais_infeccao`.

## Funções principais

- `regraDoBanco(linha)`: linha de `regra_alerta` para `RegraAlerta`; recusa
  grupo ou severidade fora do PRD 6.6 com erro.
- `validarCatalogo(catalogo)`: lista as regras ativas que o motor não consegue
  avaliar.
- `avaliarCampo(entrada)`: chamar quando a enfermeira salva um campo do
  checklist, mesmo offline. Devolve severidade, código, conduta, valor
  observado, versão do instrumento e se exige ocorrência privada.
- `avaliarRegistro(entrada)`: reavaliação completa de uma visita (na
  sincronização). Em gemelares, o bloco 3 é avaliado uma vez por bebê, com o
  registro daquele bebê; quem chama grava o `bebe_id`.
- `exigeOcorrenciaPrivada(regra)`: verdadeiro só para saúde mental imediata
  (SM-01 a SM-03), que cria ocorrência privada com prioridade máxima.
- `validarFechamentoAlerta(dados)`: os quatro campos obrigatórios para fechar
  um alerta (sinal identificado, hora do acionamento em ISO 8601 com fuso,
  orientação médica, conduta adotada).
- `SINAIS_SEM_CAMPO`: os sinais do DOC 3 sem campo no checklist (K-07), para o
  seletor manual. Todo item nasce com `pendenteAprovacaoClinica: true`.

## Ativação

Só as sete linhas com "Fonte: DOC 3" no Apêndice B ficam ativas: PU-01, PU-04,
RN-01, RN-03, RN-04, RN-07 e RN-08, iguais ao seed. `[clínico]`, "Fonte: v4.0"
(RN-10) e a linha sem fonte do seletor SM (bloco 7) ficam desligadas até a
aprovação do Apêndice B (P-1 item 18).
