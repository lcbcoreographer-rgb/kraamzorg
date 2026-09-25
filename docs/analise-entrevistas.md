# Análise das fichas de entrevista pré-natal (DOC 1)

Base do formulário digital da consulta pré-natal (PRD 9.1) e das propostas do DOC 1 v2 para a Edilaine aprovar. Leitura dos três modelos em branco e de 24 fichas preenchidas, feita em 24/09/2026. O relatório não traz dado pessoal; as contagens se referem às 24 fichas únicas. A lista dos arquivos com texto herdado de outra paciente foi entregue à Kraamzorg em separado e não entra no repositório.

**Resumo:** os três modelos têm o mesmo conteúdo. Nenhum tem caixa de seleção real: as opções são "( )" digitados, marcados com "x". As fichas foram preenchidas em pelo menos 4 layouts diferentes, e só 1 das 24 usa exatamente o modelo atual. O ponto mais grave é de LGPD: os três modelos "em branco" contêm trechos de uma ficha real, e 8 fichas mostram texto herdado de ficha de outra paciente. As fichas novas eram criadas copiando o arquivo anterior.

---

## 1. Campos do modelo atual, na ordem do documento, comparados com a spec 9.1

O documento tem 10 tabelas e um logotipo no cabeçalho ("Entrevista" / "C O L E T A  D E  D A D O S"). Rótulos e opções estão transcritos literalmente. **≠** marca diferença em relação à spec.

| # | Rótulo literal | Opções literais | Bloco | Comparação com a spec |
|---|---|---|---|---|
| 1 | "Como foi que vocês chegaram até a Kraamzorg?" | "Instagram ( )" · "Indicação amigo( )" · "( )Indicação médica" · "( ) presente" | A | Mesmas opções. ≠ rótulo "Indicação amigo" (sem "de"). Faltam nos dois "Internet/site" e "Outro/qual" (ver seção 3). |
| 2 | "Data da entrevista pré-natal:" | texto | B | = |
| 3 | "Hora início:" | texto | B | = |
| 4 | "Data provável do parto:" | texto | B | = |
| 5 | "LOCAL:" | texto | B | ≠ o modelo não diz "maternidade" |
| 6 | "IG Atual:" | texto livre | B | ≠ a spec pede semanas e dias; o modelo é texto livre |
| 7 | "Percentil:" | texto | B | = |
| 8 | "Ganho de peso:" | texto | B | = |
| 9 | "Tipo de parto esperado(data):" | "( )Vaginal" · "( )Cesárea" · "data:" | B | = (tipo + data agendada). Não tem hora nem "a definir/indução" |
| 10 | "ILA:" | "( )normal" · "( )diminuído" · "( )aumentado" | B | = |
| 11 | "Coletador:" | texto; a célula ao lado ficou vazia (era "Número do questionário:" nas versões antigas) | B | = |
| 12 | "Nome da Gestante:" | texto | C | = |
| 13 | "Idade: a" (o "a" é de "anos") e "Ocupação:" | texto | C | = |
| 14 | "Nome do Companheiro:" | texto | C | = |
| 15 | "Idade: a" e "Ocupação:" | texto | C | = |
| 16 | "Gestação Planejada" | "( ) Sim" · "( ) Não" | C | = |
| 17 | "Sexo do bebê:" | "( ) masculino" · "( )feminino" | C | A spec não define opções. Não há "não sabe" nem gêmeos |
| 18 | "Nome:" (do bebê) | texto | C | = |
| 19 | "Crença Religiosa:" | texto | C | = |
| | Cabeçalho de tabela "Informações de Interesse" / "Opções de Resposta" | | | |
| 20 | "Situação conjugal" | "1 ( ) Solteira" · "2 ( ) Casada (civil e/ou religioso)" · "3 ( ) União estável / Vive em união" | C | ≠ na spec os rótulos são mais curtos (solteira/casada/união estável) |
| 21 | "Escolaridade" | "1 ( ) Sem instrução ou < 1 ano de estudo" · "2 ( ) Ensino fundamental incompleto" · "3 ( ) Ensino fundamental completo" · "4 ( ) Ensino médio incompleto" · "5 ( ) Ensino médio completo" · "6 ( ) Ensino superior incompleto" · "7 ( ) Ensino superior completo" | C | = sete níveis. É um campo único, não um por pessoa. Não há pós-graduação |
| 22 | "Ocupação" | "1 ( ) Autônoma" · "2 ( ) Empregadora" · "3 ( ) Empregada" | C | = (campo único) |
| 23 | "Endereço completo" | uma célula livre | C | = |
| 24 | "Telefones" | "Gestante:" · "Acompanhante:" | C | = |
| 25 | "Gestações anteriores" | "1 ( ) Nenhuma" · "2 ( ) 1 gestação" · "3 ( ) 2 gestações" · "4 ( ) ≥ 3 gestações" | D | = |
| 26 | "Filhos vivos" | "1 ( ) Nenhum" · "2 ( ) 1 filho" · "3 ( ) 2 filhos" · "4 ( ) ≥ 3 filhos" | D | A spec não define opções |
| 27 | "Partos vaginais anteriores" | "1 ( ) Nenhum" · "2 ( ) 1 parto" · "3 ( ) 2 partos" · "4 ( ) ≥ 3 partos" | D | A spec não define opções |
| 28 | "Cesáreas anteriores" | "1 ( ) Nenhuma" · "2 ( ) 1 cesárea" · "3 ( ) 2 cesáreas" · "4 ( ) ≥ 3 cesáreas" | D | A spec não define opções |
| 29 | "Número de consultas pré-natal" + "Intercorrências gestação atual" (as duas linhas no mesmo rótulo) | "1 ( ) < 6 consultas" · "2 ( ) ≥ 6 consultas" | D | ≠ **no modelo "Intercorrências" não tem espaço de resposta próprio**; a spec separa, e está certa |
| 30 | "Orientações sobre aleitamento materno por algum profissional de saúde no pré-natal" | "1 ( ) Sim" · "2 ( ) Não" | D | ≠ a spec pede "sim com detalhe"; o modelo não tem espaço para o detalhe |
| 31 | "Amamentou anteriormente" | "1 ( ) Sim" · "2 ( ) Não" · "3 ( ) Não se aplica" | E | = |
| 32 | "Número de filhos amamentados" | "1 ( ) 1 filho" · "2 ( ) 2 filhos" · "3 ( ) ≥ 3 filhos" | E | A spec não define opções |
| 33 | "Qual o maior tempo de amamentação" | "1 ( ) < 1m" · "2 ( ) Entre 2 e 3m" · "3 ( ) Entre 4 e 6m" · "4 ( ) Entre 7m e 1a" · "5 ( ) > 1a" | E | = spec, mas **o modelo e a spec têm um buraco entre 1 e 2 meses**. As fronteiras 3→4 m, 6→7 m e "exatamente 1 ano" também ficam ambíguas |
| 34 | "Dor/lesão mamilar em amamentação anterior" | "1 ( ) Sim" · "2 ( ) Não" | E | = |
| 35 | "Motivo do desmame" | "1 ( ) Dor/lesão mamilar" · "2 ( ) Naturalmente" · "3 ( ) Relacionado ao contexto/desejo" · "4 ( ) Indesejado/insucesso da AM" | E | ≠ na spec a opção 4 perde "insucesso da AM" |
| 36 | "O que vocês pensam/sabem sobre a amamentação?" | texto | F | = |
| 37 | "Qual a disponibilidade para o processo de amamentar?" | texto | F | = |
| 38 | "O que te motiva para amamentar?" | texto | F | = (é a única pergunta no singular, "te") |
| 39 | "O que vocês sabem sobre o período puerperal?" | texto | F | = |
| 40 | "Existe algum medo/ receio/ temor?" | texto | F | = |
| 41 | "Vocês terão alguma ajuda prevista para esse período?" | "( ) Não" · "( ) Sim" | F | No modelo são dois campos (41 e 42) |
| 42 | "Quem ajudará?" | texto | F | |
| 43 | "Quais as expectativas de vocês para essa primeira semana?" | texto | F | = |
| 44 | "O que vocês esperam do nosso cuidado?" | texto | F | = |
| 45 | "TEMAS ESSENCIAIS ABORDADOS:" | "( ) Golden Hour" · "( ) Apojadura" · "( ) Complemento" · "( ) Chupeta e mamadeira" · "( ) Benefícios LM e Malefícios LV" · "( ) Necessidade de aviso do nascimento" | G | = (a spec escreve LM/LV por extenso) |
| 46 | "Nome Obstetra:" e "Telefone:" | texto | H | = |
| 47 | "Nome Pediatra:" e "Telefone:" | texto | H | = |
| 48 | "Querem fazer alguma recomendação/pedido em especial?" | texto | H | = |
| 49 | "Têm preferência por algum período?" | "Tarde( )" · "Noite( )" · "Manhã ( )" · "(ordem de preferência)" | H | ≠ **a ordem no modelo é Tarde/Noite/Manhã** |
| 50 | "Hora término:" (última tabela) | texto | B | ≠ fica no fim do documento, não no bloco B |

Outras observações sobre o modelo:
- Os blocos G e H dividem a mesma célula.
- Nem o modelo nem a spec têm: consentimento/LGPD, e-mail, CPF ou data de nascimento. Nenhuma ficha registrou esses dados.
- **Os três modelos contêm três trechos de uma ficha real.** Eles ficam depois de "Casada (civil e/ou religioso)", depois de "Ensino superior completo" e depois de "1 ( ) Sim" em Orientações sobre aleitamento. Não reproduzo o conteúdo. Esses trechos não devem ir para a spec e precisam ser apagados dos arquivos.

## 2. Diferenças entre as três versões do modelo

- **"1 DOC - KRAAMZORG_ENTREVISTA.docx" e "... - Copia.docx" são idênticos byte a byte** (mesmo SHA-256, 50.210 bytes).
- **A cópia da pasta Instrumentos tem o mesmo conteúdo.**
  - A única diferença de texto é um espaço duplo em "pensam/sabem  sobre", que só existe nos outros dois.
  - Tem a mesma estrutura: 10 tabelas, 26 linhas e 48 células. O logotipo é idêntico e a página é A4 com as mesmas margens.
  - Foi regravada no Microsoft Word 16 com 6 arquivos de fonte embutidos, o que explica os 3,8 MB. O carimbo de criação é o mesmo.
  - Não é uma versão mais nova.
- Nenhum dos três tem controle de formulário, revisões rastreadas ou comentários.

As fichas usam versões mais antigas, que dá para agrupar em 4 gerações. Isso importa para migrar as fichas antigas:

| Geração | Fichas | O que distingue |
|---|---|---|
| G1 | 4 | Cabeçalho só com data, hora e IG (uma sem IG; outra tem DPP e local, mas não IG). Em 2 fichas, "Hora início/término" é um campo só. Têm "Número do questionário", "Telefones Fixo/Celular/Outros", linha de consultas sem "Intercorrências" e "Assinatura". Em 3 fichas as perguntas abertas vêm em outra ordem. A mais antiga tem o companheiro sem idade, opções de "maior tempo" diferentes ("< 1m / Entre 1 e 2m / Entre 3 e 6m / Entre 7m e 1a / > 1a") e só 5 temas (sem "Necessidade de aviso do nascimento"). Uma ficha tinha "( ) desconhecido" em Sexo do bebê. |
| G2 | 8 | Entram DPP, LOCAL, IG Atual e Percentil (2 também com Ganho de peso). Em 7 a linha de consultas ganha "Intercorrências gestação atual". Ainda sem origem (há uma linha pontilhada no lugar), sem tipo de parto, sem ILA e sem preferência de período. |
| G3 | 7 | Origem como pergunta aberta, sem opções. "Tipo de parto esperado(data):" e "ILA:" sem opções, respondidos em texto. "Têm preferência por algum período?" sem opções. "Número do questionário" existe mas fica vazio. Em 2 já aparece "Gestante/Acompanhante". |
| G4 | 5 | Origem, tipo de parto, ILA e período passam a ter opções. Saem "Número do questionário" e "Assinatura". A opção "presente" só aparece em 2. **Só 1 ficha usa o modelo atual inteiro**, com "O que te motiva" e "pensam/sabem" fundidas. Uma usa a variante "O que motivam vocês sobre a amamentação?". |

## 3. Como os campos são preenchidos na prática

**Como as opções são marcadas:** sempre com "x" digitado dentro de "( )". As variações são "(x )", "( X)" e um erro de digitação "( x0 )"; no ranking de período usam números. Conferi o XML: nenhuma ficha marca opção com realce ou negrito, então "vazio" é vazio mesmo. Todas as 24 fichas têm texto livre escrito ao lado de opções fechadas.

**Formatos encontrados:**
- **Data da entrevista:** dd/mm/aa (11), dd/m/aa com o mês sem zero (9), dd/mm/aaaa (4). O ano tem 2 dígitos em 20 de 24.
- **Hora de início:** "HH:MMh" (10), "HH:MM" (7), só a hora "Hh" (5), início e término no mesmo campo (2).
- **Duração da entrevista** (23 válidas): de 30 min a 2 h, mediana de cerca de 65 min. Em 18 fichas fica entre 50 e 80 min. Uma ficha tem término antes do início (resíduo de cópia).
- **DPP:** o campo existe em 21 fichas e está preenchido em todas. Em 7 vem uma IG entre parênteses: "(40s)" em 4; em outras 3 aparece outra IG, porque a data registrada era a do parto programado (em 1 delas a IG não bate com a IG atual).
- **IG:** o campo existe em 22 fichas. Formatos "NNsNd" (6, uma com "+"), "NNsemNd" e variantes (8), e **só semanas em 8**. Vai de 31 a 39 semanas; 18 fichas estão entre 35 e 37.
- **Percentil:** o campo existe em 19 fichas.
  - Só o percentil em 12 (um deles decimal).
  - Percentil mais peso fetal em 2.
  - **Peso fetal no lugar do percentil em 3.**
  - Três valores separados por "/" em 1.
  - Em 1 gestação gemelar, nome, peso e percentil de cada bebê.
  - **O peso fetal estimado aparece em 9 fichas**, espalhado por vários campos, embora não exista campo para ele.
- **Ganho de peso:** o campo existe em 14. Inteiro em "kg" (9), decimal com vírgula (1), vazio (3), valor impossível para ganho (1, provavelmente o peso atual).
- **Tipo de parto:** preenchido em 10 de 11 (7 vaginal ou "parto normal", 3 cesárea). **O campo "data" tem uma data real em só 1 de 5**, e sem ano; os outros têm "?", um prazo máximo, "retorno médico / provável indução" ou uma data ambígua.
- **ILA:** "normal" nas 8 fichas que têm o campo. Uma ficha anotou o ILA como número nas intercorrências.
- **Idade:** "NNa" ou "NN a" (19), "NN anos" (2), só o número (3). Uma idade do companheiro está com dígito faltando.
- **Telefones:** pelo menos 5 formatos, com e sem parênteses ou espaços, e com "(0NN)". Há 3 números incompletos e DDDs de vários estados.
- **Situação conjugal:** casada 22, união estável 2, solteira 0. **O tempo de união foi anotado em 18** (6 separam "casados há / juntos há"); 1 anotou a data do casamento.
- **Escolaridade:** o nível 7 aparece nas 24. O nível 6 aparece em 2, marcado para a outra pessoa do casal. Os níveis 1 a 5 nunca foram usados. Curso ou formação foram anotados em 15, e pós-graduação em 2.
- **Ocupação (categoria):**
  - Autônoma em 16 fichas, Empregada em 14, **Empregadora em nenhuma**.
  - Duas marcas (uma por pessoa) em 7; atribuição por pessoa (ELE/ELA/ambos) em 11; vazio em 1; "PJ" anotado junto a "Empregada" em 1.
  - "Empresário(a)" aparece no texto de ocupação de 9 fichas.
  - O nome do empregador aparece em 9.
- **Endereço:** CEP em só 1 de 24; cidade em 4; ponto de referência em 4; torre, andar ou edifício em 6; 1 incompleto. **Em 1 ficha o endereço é o da casa dos avós**, onde a família vai ficar no pós-parto.

**Campos quase sempre vazios ou sem variação:**
- Telefone "Fixo": vazio em 16 de 17, e o único preenchido tem um celular.
- Telefone do pediatra: vazio em 15 de 24 (mais 1 só com DDD).
- Telefone do obstetra: vazio em 10 de 24.
- "Número do questionário": vazio em 6 de 18.
- Nas gestantes sem filhos, o branco é usado no lugar de "Nenhum": "Filhos vivos" em branco em 8 de 16, "Partos vaginais" em branco em 9 fichas e "Cesáreas" em 12.
- "Recomendação/pedido": vazio em 5 e "nada/nenhum" em 8.
- Consultas pré-natal: "≥ 6" em todas as 22 marcadas.
- Temas essenciais: todos marcados em 21 de 24, parcial em 1, nenhum em 2.
- Perguntas abertas: estão quase sempre preenchidas. "O que sabem a respeito?" ficou vazia em 3 de 23; "disponibilidade" em 2.

**Campos com texto longo:**
- "Quem ajudará?" está preenchido em todas as 24, muitas vezes com várias pessoas, períodos e frequências.
- Intercorrências tem conteúdo em 14 de 19; 8 são médias ou longas e 5 citam remédios, às vezes com dose.
- Medos, expectativas e o que esperam do cuidado ocupam de 1 a 5 frases, até uns 500 caracteres.
- A linha de filhos vivos traz nomes, idades e dados de nascimento em 8 fichas.
- As respostas misturam citação em 1ª pessoa e resumo da entrevistadora. Em 7 fichas a resposta separa o que "ela" e "ele" disseram.

**Campos usados de um jeito diferente do rótulo:**
- "Amamentou anteriormente" foi marcado "Não" em todos os 15 casos sem parto anterior, quando o certo seria "Não se aplica" (esta aparece em só 1 ficha).
- **"Ajuda prevista: Não" aparece em 6 fichas, e todas descrevem ajudantes em "Quem ajudará?"** (marido de férias, avó, diarista, funcionárias). Na prática "Não" quer dizer "sem ajuda dedicada". Uma ficha marcou "Sim" com "o próprio casal".
- "Filhos vivos" registrou enteados ou filhos do companheiro em 2 fichas.
- Em 1 ficha, o bloco de amamentação inteiro foi preenchido sobre a ex-companheira do parceiro.
- Onde a versão não tinha campo próprio, a informação foi para outro lugar: preferência de período em "Recomendação" (4), intercorrências, percentil e ganho de peso na linha de consultas (2), tipo de parto em "Cesáreas anteriores" ou em intercorrências (2), data da cesárea e dados de USG em "Recomendação" (1).
- "Recomendação" guardou restrições de agenda (3), pedido de sigilo (1) e pedidos práticos (2).
- "Expectativas" foi usada para outros assuntos em 3 fichas, e "puerpério" teve resposta fora do tema em 1.
- O campo "Fixo" guardou um celular, e "Celular" guardou um telefone comercial.
- A sigla "DPP" foi usada com outro sentido clínico em 2 fichas, o que conflita com Data Provável do Parto.
- **Uma entrevista foi feita depois do nascimento.** O rótulo virou "pós-natal" e ganhou data de nascimento e peso ao nascer; a intercorrência registrada foi a do parto e os temas ficaram em branco.
- **Uma gestação gemelar não coube no modelo:** sexo em branco, um só nome de bebê e o percentil de cada bebê dentro de um único campo.
- Uma ficha anotou que o companheiro não participou da entrevista, com observação sobre nacionalidade e idioma. Uma ficha está sem coletador.

**Anotações fora dos campos:**
- 4 parágrafos soltos, fora de qualquer campo: animais de estimação e arranjo de sono (2), privacidade nos cuidados (1), pedidos da família com o combinado da profissional (1).
- Animais de estimação aparecem em 4 fichas no total.
- Em 6 fichas, observações ou orientações da própria entrevistadora estão dentro de respostas da família. Exemplos: "percebi que...", reação emocional, orientações dadas.
- **7 fichas usam realce amarelo para destacar trechos de resposta.** Os campos mais realçados são rede de apoio (5), medos (5), período (4), intercorrências (3), disponibilidade (3) e pedidos (3).

**Outras inconsistências:**
- Número do questionário escrito à mão com **3 pares duplicados** entre as 12 fichas numeradas.
- A opção "Não" foi apagada de "Gestação Planejada" em 2 fichas.
- "Gestações anteriores" em branco com 2 filhos (1).
- "Maior tempo" sem opção marcada, mas com as durações escritas ao lado da opção errada (1).
- "Amamentou" em branco com os detalhes preenchidos (1).
- **Uma resposta real (desmame por volta de 1,5 mês) não cabe em nenhuma opção do modelo atual.**

**Contaminação entre fichas (LGPD):**
- Os 3 modelos "em branco" têm os trechos de ficha real descritos na seção 1.
- **4 fichas contêm com certeza texto de outra paciente.** Num caso é uma anotação obstétrica de outra paciente numa opção não marcada; noutro, um parágrafo com o primeiro nome de outra paciente e a hora de término copiada.
- **Outras 4 têm indícios fortes:** trechos idênticos, nome do bebê incoerente e formação que contradiz a ocupação registrada.
- 9 das 24 fichas têm exatamente o mesmo carimbo de criação dos modelos. Ou seja, a ficha nova era feita copiando a anterior e escrevendo por cima.
- 22 guardam o nome do último editor nos metadados. As revisões por arquivo vão de 2 a 67 (mediana 5). 22 foram salvas no Word com fontes embutidas (cerca de 3,8 MB cada).

## 4. Implicações para o formulário digital

**Estrutura:**
- Origem com escolha múltipla: acrescentar **"Internet/Google/site"** (6 das 12 fichas que tinham essa pergunta), "Outro (qual)" e o campo **"Quem indicou/presenteou"**.
- **Número de fetos**, com sexo, nome, percentil e peso repetidos para cada bebê. Opção "ainda não sabe" no sexo do bebê.
- Campos numéricos separados para **percentil** e **peso fetal estimado (g)**, mais a data da USG.
- ILA como categoria e também como número opcional.
- Tipo de parto com as opções vaginal, cesárea programada, indução prevista e "ainda não definido". Data e hora opcionais e uma observação.
- **Separar a DPP (40 semanas) da data programada do parto.**
- Idade, profissão, vínculo de trabalho, escolaridade e crença **para cada pessoa**, e "companheiro presente na entrevista?".
- Rever as categorias de ocupação: "Empregadora" nunca foi usada, e PJ, servidor, empresário e licença aparecem no texto.
- "Tempo de união" como campo opcional, porque é anotado em 19 de 24.
- Nível "Pós-graduação" opcional.
- Histórico obstétrico em **contadores numéricos**: gestações, partos vaginais, cesáreas e **abortos/perdas**. Há perda anterior em 6 fichas, e a anotação só aparece em 4.
- Outros filhos e enteados na casa, com idade, e dados de cada parto anterior (IG, peso, duração).
- Amamentação **por filho**, com a duração em meses como número, o que elimina o buraco das faixas.
- Intercorrências e remédios em uso num campo próprio.
- Ajuda prevista como **escolha múltipla de tipos de ajudante** (companheiro de licença ou férias, avós, outros familiares, diarista ou mensalista, babá diurna, noturna ou 24h, técnica de enfermagem, nenhuma), com período e frequência, no lugar de Sim/Não.
- Endereço dividido em CEP com preenchimento automático, número, complemento, bairro, cidade/UF e ponto de referência, com a opção **"endereço de atendimento diferente da residência"**.
- Vários contatos, cada um com o parentesco e um marcado como principal. O campo "Fixo" dedicado pode sair.
- Obstetra e pediatra com as opções **"a definir"** e **"plantonista da maternidade"**: 7 das 24 fichas não tinham pediatra definido. Vale ter uma lista reutilizável com busca, porque os mesmos médicos se repetem.
- Preferência de período como **ranking**, com a opção "indiferente" e espaço para horário ou restrição (7 fichas registraram horários da família). **É preciso decidir a ordem de exibição**, porque o modelo diz Tarde/Noite/Manhã e a spec diz manhã/tarde/noite.
- Campos novos opcionais sugeridos pelo uso: animais em casa, pedidos de privacidade ou do perfil da profissional, e **"Observações da entrevistadora"** e **"Orientações dadas / combinados"** separados das respostas da família.
- Uma marcação de **"ponto de atenção"** em cada campo ou num resumo, para substituir o realce amarelo.
- **Modo "entrevista após o nascimento"**, com data de nascimento, IG e peso ao nascer, tipo de parto realizado e intercorrências do parto e do bebê.
- Temas essenciais começando desmarcados, com as opções "abordado", "não abordado" e "família já sabia". Do jeito atual, 21 de 24 fichas marcaram tudo.

**Validação e máscaras:**
- Datas com seletor, ano de 4 dígitos e armazenamento em formato ISO.
- DPP maior que a data da entrevista, e aviso se IG, DPP e data não baterem (tolerância de ±3 dias).
- IG em dois números: semanas de 20 a 42 e dias de 0 a 6, com os dias podendo ficar em branco.
- Horas em HH:MM. Início e término preenchidos automaticamente e editáveis; término sempre depois do início.
- Percentil de 0 a 100, com decimal por vírgula. Peso fetal em gramas, de 300 a 5.000. Ganho em kg com 1 decimal, com aviso acima de uns 30 kg.
- Telefone no formato (DD) 9XXXX-XXXX, validando DDD e 9 dígitos no celular, e armazenado em E.164.
- Idade inteira, com aviso para 1 dígito.
- Consistência: partos + cesáreas + perdas ≤ gestações anteriores.

**Obrigatoriedade e respostas "não sei" / "a definir":**
- Obrigatórios: data e hora (automáticas), coletador (vem do login), nome completo da gestante (3 fichas só com o primeiro nome), **telefone da gestante** (faltou em 3), DPP ou IG, local e tipo de parto (aceitando "a definir").
- Precisam aceitar "não sei", "a definir" ou "não informado": pediatra, data e hora do parto, sexo e nome do bebê (1 ficha tinha dois nomes alternativos), percentil e peso fetal, ganho de peso, telefones dos médicos, gestação planejada e crença religiosa ("prefiro não informar").

**Lógica condicional:**
- Se não há parto anterior, preencher sozinho "Não se aplica" e esconder o bloco E.
- Se não há gestação anterior, zerar filhos, partos e cesáreas, em vez de deixar em branco.
- Esconder "Quem ajudará" quando a resposta for "nenhuma ajuda".

**Salvamento:**
- A entrevista leva uns 65 minutos e há arquivos com até 67 revisões.
- Por isso: **salvar cada campo ao sair dele**, ter rascunho que dá para retomar, histórico de alterações (quem, quando, o quê), finalização com trava e versões depois disso.
- ID único gerado pelo sistema: a numeração manual tinha duplicatas.
- Assinatura digital automática do usuário, com o COREN (3 fichas traziam COREN na assinatura).

**LGPD:**
- **Toda entrevista nova começa em branco.** Não permitir "duplicar de outra família" e corrigir os modelos atuais.
- Controle de acesso por campo para dados de saúde (intercorrências, remédios, saúde mental, reprodução assistida, perdas) e para crença religiosa, que é dado sensível pelo art. 5º, II.
- Registrar o consentimento e a finalidade.
- Texto de ajuda para reduzir dados de terceiros no texto livre. Hoje aparecem saúde de parentes, nomes de filhos menores (LGPD art. 14) e dados da ex-companheira.

**Migração das fichas antigas:**
- Mapear cada uma das 4 gerações.
- Exemplos: "Outros" vira acompanhante, intercorrências saem da linha de consultas, e preferência de período e data da cesárea saem de "Recomendação".
- Ligar a ficha de entrevista aos registros de atendimento e alta da mesma família.

## 5. O que foi lido

- **Modelos:** 3 de 3 lidos por inteiro, e os binários foram comparados por hash e XML.
- **Fichas .docx:** 24 de 24 lidas por inteiro. Também baixei os binários para conferir formatação e metadados, sem reproduzir conteúdo.
- **PDFs:** 18 de 18 lidos por inteiro. **Todos são exportações com texto idêntico a 18 das .docx**; nenhum PDF traz ficha nova. 6 .docx não têm PDF.
- **Evolução de Enfermagem:** 1 de 1 lida.
- **Total:** 46 arquivos lidos, 24 fichas únicas. Nenhum arquivo falhou.
- **Limitação:** a análise foi feita pelo texto extraído e pelo XML. Não conferi o layout visual das páginas.

**A "Evolução de Enfermagem" (estrutura):** é um resumo de alta do atendimento domiciliar, em duas partes. Não pertence à pasta de entrevistas, mas é da mesma família de uma das fichas, o que reforça a ligação entre os registros.
- **Puérpera:** identificação por iniciais e idade, período do acompanhamento e histórico (tipo de parto, data de nascimento, data da alta). Depois, texto corrido sobre estado geral e ferida operatória, sinais vitais em faixas (PA, FC, temperatura, SpO2), mamas, dor em escala, lóquios, intervenções com os dias em que foram feitas, sinais de alerta numerados, encaminhamentos e conclusão.
- **Recém-nascido:** identificação, série de pesos (data, peso, onde foi pesado) com ganho total e média por dia, exame por sistemas (icterícia pela zona de Kramer, coto umbilical e outros), alimentação, eliminações, lista de orientações, conclusão e responsável com COREN.



## 6. Como isso entrou no PRD

- Blocos e campos do instrumento atual: PRD 9.1. Nada muda no instrumento sem versão nova aprovada pela Edilaine.
- Propostas para o DOC 1 v2 (origem "internet ou site", gemelares, peso fetal, DPP separada da data programada, contadores do histórico obstétrico, duração da amamentação em meses, ajuda prevista por tipo, modo pós-nascimento, observações da entrevistadora, ponto de atenção, ordem do período): PRD 9.1 e 22.3, item K-14.
- Toda entrevista nova começa em branco, sem opção de duplicar: PRD 9.1.
- Modelos com trechos de ficha real e fichas contaminadas: PRD 22.4, item L-01.
