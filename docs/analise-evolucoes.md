# Análise das evoluções de enfermagem

Base do gerador de evoluções em PDF (PRD 9.5). Leitura do modelo em Word e de oito evoluções reais de cinco famílias, feita em 24/09/2026. O relatório não traz dado pessoal: nenhum nome, idade, data, número de conselho, peso ou medida de caso. A lista de arquivos lidos fica com a Kraamzorg e não entra no repositório.

Os textos-padrão da seção 3 são a matéria-prima do seed de `mensagem_modelo` com destinatário `medico`. Eles só viram seed depois da revisão da Edilaine, com a concordância de gênero e as variáveis explícitas.

Foram lidos por inteiro os 9 arquivos: o MODELO e 8 documentos reais, de 5 famílias. Nos textos-padrão, os trechos que mudam de caso para caso estão entre [colchetes].

## Os pontos mais importantes

- **O MODELO não é anônimo.** Ele repete por inteiro uma das evoluções reais do conjunto: mesmas datas, idade, sinais vitais, pesos e menção a medicações psiquiátricas. Só os nomes foram trocados por XXXXX. Ele não deve servir de dado de exemplo ou de teste no sistema, nem circular como modelo; é preciso trocar por dados fictícios. Na edição, o ganho de peso do MODELO ficou com a conta errada (no documento original a conta está certa).
- **Não existe identidade visual hoje.** Examinei a estrutura interna dos 6 .docx e dos 3 PDFs. Nenhum tem logotipo, imagem, cabeçalho, rodapé, cor, tabela ou número de página. A única menção à marca é o texto "(Kraamzorg Brasil)" na linha do período. O layout de marca previsto no 9.5 terá de ser criado do zero.
- **A prática mistura dois formatos.** Em 2 dos 5 casos, e no próprio MODELO, mãe e bebê estão num documento só, com uma única assinatura. Nos outros 3 casos há dois arquivos separados. Um arquivo chamado "mãe+bebê" contém só a parte do recém-nascido (RN).
- **Há muitos erros de copiar e colar a partir do modelo** (detalhes no item 2). Isso é um argumento forte para montar o texto a partir de campos estruturados, com validação antes da aprovação.

---

## 1. Estrutura exata do MODELO

### Formato geral
- Arquivo .docx em A4. Margens de 3 cm à esquerda e à direita e 2,5 cm em cima e embaixo. Espaçamento simples.
- A fonte não está definida no documento; vem do padrão do Word. Nos PDFs reais, exportados do Word, a fonte é Aptos 12 pt.
- É um documento único: a parte puerperal e, logo depois, a parte neonatal, sem quebra de página.
- Não tem tabelas, imagens, cabeçalho, rodapé, campos automáticos (data ou página) nem cores.
- Cada seção é um rótulo em texto normal, seguido de dois-pontos e do texto na mesma linha. Só os dois títulos estão em negrito, no mesmo tamanho do corpo.

### Parte A, puerperal (na ordem, com os rótulos literais)

| # | Rótulo literal | Conteúdo |
|---|---|---|
| 1 | **Evolução de Enfermagem Puerperal** (título) | |
| 2 | `Paciente:` | [nome], [idade] anos. Equivale à "Identificação" da especificação. |
| 3 | `Período de Acompanhamento:` | [dd/mm] a [dd/mm] (Kraamzorg Brasil) |
| 4 | `Histórico:` | Parto [Cesárea/Normal] DN: [dd/mm/aa], DA: [dd/mm/aa]. (DN = data de nascimento/parto; DA = data da alta) |
| 5 | (sem rótulo) | Parágrafo de evolução geral, que começa com "Paciente no [N]º dia de puerpério, …" |
| 6 | (sem rótulo de seção) `PA:` … `FC:` | PA: [PAS]/[PAD] mmHg a [PAS]/[PAD] mmHg; FC: [mín] a [máx] bpm; |
| 7 | `Temp.:` … `SpO2:` | Temp.: [mín] °C a [máx] °C; SpO2: [mín]% a [máx]%. |
| 8 | `Mamas:` | texto |
| 9 | `Dor:` | texto |
| 10 | `Eliminações:` | texto sobre lóquios |
| 11 | `Intervenções Realizadas:` | linha de título, sem conteúdo |
| 12 | `Fotobiomodulação (Laserterapia):` | indicação e dias |
| 13 | `Terapia ILIB:` | dias e finalidade |
| 14 | `Orientações de Alta e Conduta:` | Frase de abertura e lista de 1 a 4. Os números foram digitados à mão, não é lista automática. |
| 15 | (sem rótulo) | Parágrafo de encaminhamentos, que começa com "Encaminhada para retorno com equipe obstétrica…" |
| 16 | `Conclusão:` | texto |

### Parte B, neonatal

| # | Rótulo literal | Conteúdo |
|---|---|---|
| 17 | **Evolução de Enfermagem**, um travessão e **RN [nome]**, com `Data:` [dd/mm/aaaa] na mesma linha, sem negrito. O gerador troca o travessão por quebra de linha. | |
| 18 | `Período de Acompanhamento:` | igual ao da parte A |
| 19 | `Identificação:` … `Filiação:` | RN, sexo [..], [N]º dia de vida; nascido por parto [..]. Filiação: filho de [mãe]. |
| 20 | `Peso:` | Uma linha por pesagem. O rótulo aparece só na primeira linha. |
| 21 | `Ganho ponderal adequado :` … `Ganho médio:` | [n] g em [d] dias; Ganho médio: [x,x] g/dia |
| 22 | `Estado geral:` … `Mucosas:` … `Normotérmico ([mín] a [máx]°C).` `Fontanela anterior:` | tudo no mesmo parágrafo |
| 23 | `Icterícia:` | [intensidade], em zona [romano] de Kramer ([descrição anatômica]). |
| 24 | `Sist respiratório:` (sem ponto) | eupneico…; FR [mín] - [máx] rpm |
| 25 | `Aparelho cardiovascular:` | FC e SpO2 |
| 26 | `Abdômen:` … `Coto umbilical:` | A alimentação vem numa frase sem rótulo no fim deste parágrafo. |
| 27 | `Genitália:` | Diurese e evacuações vêm numa frase sem rótulo no fim deste parágrafo. |
| 28 | `Orientações/Condutas:` | Lista numerada automática do Word, com 11 itens |
| 29 | `Conclusão:` | texto |
| 30 | `Responsável:` | Assinatura única, que vale para o documento inteiro |

### Pesos
Não existe tabela de pesos. São linhas de texto, cada uma com 3 "colunas" implícitas: **data (dd/mm) | peso (g) | origem entre parênteses** (alta hospitalar, domicílio ou pediatra). O próprio modelo é inconsistente:
- "Peso" e "peso", com e sem maiúscula;
- "gr." e "g.";
- com e sem ponto de milhar;
- dois-pontos em posições diferentes.

Não há dia de vida, variação entre pesagens nem percentual de perda.

### Assinatura
Uma linha no fim: `Responsável: Enfa. [nome]. COREN/SP [número]`. Os elementos são: rótulo, título abreviado, nome, conselho com UF e número. Não há especialidade, data ou local, linha para assinar, assinatura digital nem registro de aprovação da coordenação.

### Comparação com a especificação 9.5
- No MODELO, "Evolução geral", "Sinais vitais" e "Encaminhamentos" não têm rótulo.
- Na parte neonatal, "Alimentação" e "Eliminações" são frases sem rótulo.
- A parte neonatal tem "Data:" e "Período", que a especificação neonatal não prevê.
- A parte puerperal não tem data de emissão.

---

## 2. Como os documentos reais seguem ou fogem do MODELO

**Aderência.** Todos seguem a mesma ordem e reaproveitam o texto do modelo quase ao pé da letra. As diferenças são trechos de texto livre inseridos e variações de rótulo.

**Seções que faltam** (contagem sobre 5 casos):
- Na parte puerperal:
  - Terapia ILIB: falta em 1.
  - Lista de sinais de alerta: trocada por uma frase livre em 1.
  - Parágrafo de encaminhamentos: falta em 2.
  - Idade: falta em 1.
  - Assinatura: falta em 1.
  - Título "Intervenções Realizadas": falta em 1, e o laser foi citado dentro de "Mamas".
- Na parte neonatal:
  - Genitália: falta em 1.
  - Pesos por data: faltam em 1, trocados por uma frase livre.
  - Números do ganho de peso: faltam em 1, que só diz "baixo ganho".

**Linhas e rótulos a mais:**
- Rótulos próprios "Alimentação:", "Eliminações:", "Coto umbilical:" e "Membros:", cada um numa linha (em 2 a 3 casos).
- SpO2 e temperatura do RN movidas para uma linha no final.
- Uma linha solta para um episódio de febre.
- Comentário clínico depois do ganho de peso.
- Observações presas a linhas de peso (orientações da consulta pediátrica).
- "Data de acompanhamento:" no lugar de "Data:".

**Extensão.**
- Cada parte tem cerca de 350 a 500 palavras.
- Mãe e bebê juntos: cerca de 850 palavras, 3 páginas.
- Só a puerperal ou só a neonatal: 2 páginas.

**Estilo de redação.**
- É um resumo do período inteiro, não um relato dia a dia.
- As frases são curtas e telegráficas, com muitos "achados negativos" padronizados.
- O relato por dia só aparece em intercorrências (dor, icterícia e fototerapia, complemento, lesões, dermatite).
- Existem dois contadores de dia diferentes:
  - "D1…D6" é o dia de acompanhamento, e é o que se usa em "no dia 2, 3 e 5".
  - "Nº dia de puerpério" e "Nº dia de vida" contam a partir do nascimento.
- Mistura 3ª pessoa com 1ª pessoa ("Oriento…", "deixo orientação").
- Há muitos erros de digitação e abreviações sem padrão: BEG, MMII/MMIIs, AME, SM (seio materno), FLT, IS (intermediário de silicone), DN, DA, s/n.

**Unidades e formatos encontrados:**
- **PA:** "[PAS]/[PAD] mmHg a [PAS]/[PAD] mmHg", às vezes com "x" no lugar da barra, e uma vez com um valor só. Os dois pares são aferições reais, não o mínimo e o máximo calculados separadamente para sistólica e diastólica. Num caso, o primeiro par tem a sistólica menor e a diastólica maior que o segundo. É preciso definir uma regra.
- **FC:** mãe "a a b bpm"; RN "a- b bpm".
- **Temperatura:** vírgula decimal (uma vez, ponto), "°C" com e sem espaço. No RN aparece "Normotérmico (a a b °C)" ou "Temperatura: a - b °C".
- **SpO2:** mãe "a% a b%"; RN "a -b%".
- **FR:** só do RN, "FR a - b rpm". Não há frequência respiratória da mãe.
- **Peso:** "gr.", "gr", "g.", "g", com e sem espaço e com e sem ponto de milhar. A origem vem entre parênteses: nascimento, alta hospitalar ou alta, domicílio, pediatra.
- **Ganho de peso:** "[n] g em [d] dias; Ganho médio: [x,x] g/dia", com uma casa decimal, às vezes truncada em vez de arredondada.
- **Kramer:** zona em algarismo romano, às vezes com descrição anatômica e às vezes com intensidade em cruzes (+/4+).
- **Edema materno:** em cruzes, "++++/4+" (1 caso).
- **Dor:** escala numérica de 0 a 10, escrita como "escala N", "(escala N/10)", "score N" e uma vez "5/6", que é ambíguo.
- **Lesão mamilar:** "grau I/II/III" ou "grau 2/3", com algarismos romanos e arábicos misturados, mais lado e local (mama ou mamilo).
- **Laceração perineal:** grau, local e se houve sutura.
- **Laser:** dias do acompanhamento; às vezes a dose ("1 Joule por sessão").
- **Complemento:** em ml. Intervalo entre mamadas em horas ("3 horas", "2h30min", "2,5 a 3 horas").
- **LATCH:** não aparece em nenhum documento. A mamada é descrita de forma qualitativa ("sucção satisfatória", "pega correta", "sucção nutritiva").
- **Datas:** "dd/mm", "dd/mm/aa" e "dd/mm/aaaa" misturados.

**Erros de cópia e inconsistências** (sem apontar casos):
- Datas de nascimento e alta, ou o período, copiadas do modelo sem atualizar (2 documentos).
- Data do documento anterior ao início do período (1).
- Texto do laser idêntico ao do modelo num caso com lesões diferentes.
- Os motivos de retorno do caso-modelo, "(revisão do parto, anemia prévia e controle de níveis pressóricos)", reaproveitados em outra paciente.
- A descrição anatômica de Kramer do modelo repetida junto a uma zona diferente.
- Concordância de gênero errada em RN feminino ("filho", "calmo, ativo", "nascido") em 2 documentos.
- Conclusão com "AME" e "ganho de peso progressivo" quando o próprio texto descreve complemento ou ganho insuficiente.
- Item "ferida operatória" retirado da lista de alertas num parto cesáreo.
- Erro de conta no ganho de peso em 2 dos 4 blocos que dá para conferir, um deles o MODELO.
- "Nº dia de vida/puerpério" com diferença de 1 dia em 1 caso: falta definir se o dia do nascimento conta como 0 ou 1.
- Número de COREN da mesma profissional digitado de forma diferente entre documentos.
- Assinatura em 4 formatos: "Enfa.", "Enfa. Obstetra", em duas linhas "Enfermeira Obstetra" e "COREN-SP" separados por meia-risca, e com "/ Kraamzorg Brasil" no fim.
- O metadado "Autor" dos PDFs exportados traz o nome da usuária do Word, e o idioma do PDF está marcado como inglês.
- Os nomes dos arquivos contêm nomes de pacientes.

---

## 3. Textos-padrão que se repetem entre casos (transcrição literal)

### Puerperal
1. **Abertura** (5/5): "Paciente no [N]º dia de puerpério, apresenta-se em bom estado geral, [texto livre]."
2. **Estabilidade** (5/5): "Manteve estabilidade hemodinâmica com parâmetros dentro da normalidade durante todo o período assistencial."
3. **Ferida operatória**, só em cesárea (3/3 cesáreas; uma troca "sinais flogísticos" por "sinais de hiperemia"): "Ferida operatória sem sinais flogísticos, em processo cicatricial, sem sangramentos nem secreção." Para parto vaginal não há frase fixa, só descrição livre da laceração.
4. **Edema** (5/5 com variações): "Apresentou melhora do edema em MMIIs ao longo da semana."
5. **Mamas** (4/5): "Mamas túrgidas com produção láctea adequada para a demanda neonatal. Ausência de sinais flogísticos, calor local, endurecimento patológico ou secreções purulentas."
   - Variantes: "calor focal"; "mamas flácidas com [baixa] produção láctea para a demanda neonatal".
6. **Lesão** (4/5): "A lesão de grau [grau] em [mama/mamilo] [lado], identificada no início do acompanhamento, apresentou excelente resposta cicatricial após intervenções."
7. **Dor** (5/5): "Paciente referiu dor inicial (escala [n]), porém, após condutas terapêuticas, houve remissão total do quadro. Escala de dor mantida em 0 desde o [N]º dia de acompanhamento até a presente data."
   - Variantes: "houve remissão significativa do quadro. Escala de dor mantida [n] na presente data." / "houve remissão para score de [n]."
8. **Eliminações** (5/5, idêntico em todos): "Sangramento vaginal (lóquios) em pequena quantidade, de aspecto acastanhado, compatível com o período fisiológico, sem odor fétido ou presença de coágulos volumosos."
9. **Laser, versão A** (2 casos): "Fotobiomodulação (Laserterapia): Realizada aplicação para dor e reparação tecidual de lesão grau [grau] em mama [lado] no dia [lista] conforme protocolo."
   **Laser, versão B** (2 casos): "Fotobiomodulação (Laserterapia): Realizada aplicação para tratamento de lesão grau [grau] em mama [lado] no dia [d]. Nos demais dias, aplicada técnica para sensibilidade (1 Joule por sessão)."
10. **ILIB** (4/5): "Terapia ILIB: Realizada nos dias [lista] para auxílio na recuperação sistêmica e controle inflamatório." Variante: "para auxílio para recuperação…".
11. **Orientações de alta** (4/5): "Orientações de Alta e Conduta: Foram reforçadas as orientações à paciente e ao acompanhante sobre sinais de alerta que exigem atenção ou busca por serviço médico:" (variante: "atenção/busca por serviço médico:")
    - "1. Picos febris; sinais flogísticos em ferida operatória" (a 2ª parte só em cesárea)
    - "2. Aumento súbito de dor mamária ou edema/rubor localizado;"
    - "3. Aumento expressivo do sangramento vaginal ou odor forte;"
    - "4. Mal-estar generalizado ou tonturas."
    - Pode receber itens 5 e 6 personalizados, por exemplo sobre complemento e rodízio das mamas.
    - Alternativa vista uma vez: "Foram reforçadas as orientações em relação aos cuidados com a amamentação e períneo, até a cicatrização completa."
12. **Encaminhamento** (2 casos e o modelo): "Encaminhada para retorno com equipe obstétrica para avaliação ([motivos]). Oriento manter medicações de uso contínuo; dieta saudável rica em fibras, ingesta hídrica abundante; programar retorno com equipe de [saúde mental/nutrição] que acompanha."
    - Os motivos do modelo foram copiados literalmente para outra paciente. Devem virar opções marcáveis.
    - Variante vista: "Previsão de consulta com médico obstetra pro dia [data]."
13. **Conclusão** (frases repetidas em 4 ou 5 casos): "Conclusão: Atendimento finalizado nesta data conforme acordo prévio. A família evoluiu satisfatória e progressivamente na autonomia e segurança quanto aos cuidados de saúde da mulher e do bebê, incluindo a participação ativa e muito positiva do marido no cuidado de ambos. Lactante com boa produção láctea, bom manejo e segura quanto a amamentação exclusiva e eficaz do filho. Paciente orientada a seguir o acompanhamento ambulatorial/médico conforme agendamento prévio."
    - Variantes: "Atendimento finalizado nesta data, tendo sido cancelado o último dia por demanda justificada da família."; "Lactante com baixa produção láctea, sendo necessário complemento artificial após as mamadas"; "Está segura quanto a amamentação mista".

### Neonatal
1. **Título:** "Evolução de Enfermagem", travessão, "RN [nome]" e "Data: [dd/mm/aaaa]" na mesma linha. No PDF gerado: título numa linha, "RN [nome]" e a data na linha de baixo.
2. **Período:** "Período de Acompanhamento: [dd/mm] a [dd/mm] (Kraamzorg Brasil)"
3. **Identificação** (5/5): "Identificação: RN, sexo [masculino/feminino], [N]º dia de vida; nascido por parto [cesárea/normal/vaginal]. Filiação: filho de [nome(s)]."
4. **Pesos:** "Peso [dd/mm]: [peso] g ([origem])", uma linha por pesagem.
5. **Ganho:** "Ganho ponderal [adequado]: [n] g em [d] dias; Ganho médio: [x,x] g/dia"
6. **Estado geral** (5/5): "Estado geral: reativo aos estímulos, desperta facilmente ao manejo. Mucosas: úmidas e coradas. Normotérmico ([mín] a [máx]°C). Fontanela anterior: plana."
7. **Icterícia:** "Icterícia: leve, em zona II de Kramer (pescoço e tronco superior)."
   - Na escala de Kramer clássica o pescoço pertence à zona 1. Vale validar a descrição com a coordenação clínica.
8. **Respiratório** (5/5): "Sist respiratório: eupneico, sem sinais de desconforto respiratório; FR [mín] - [máx] rpm."
9. **Cardiovascular** (5/5): "Aparelho cardiovascular: FC [mín]- [máx] bpm. SpO2: [mín] -[máx]%." Variante: "FC …; pulsos cheios."
10. **Abdômen e coto** (5/5): "Abdômen: flácido, indolor à palpação. Coto umbilical: processo avançado de mumificação, seco, sem sinais flogísticos."
11. **Alimentação:** "Aleitamento materno exclusivo (AME) com sucção satisfatória." Variante: "aleitamento misto com sucção satisfatória".
12. **Genitália:**
    - masculina: "Genitália: masculina, testículos presentes, prepúcio íntegro e limpo, meato uretral em posição usual."
    - feminina: "Genitália: feminina; sem sinais de anormalidades aparentes"
    - "Membros: bem perfundidos." (2/5)
13. **Eliminações** (5/5): "Diurese e evacuações presentes (fezes em transição)."
14. **Orientações/Condutas:** 11 itens. Os marcados com * aparecem em todos os 5 casos; os demais aparecem em 4 casos ou com variações.
    1. "Amamentação em livre demanda, com intervalos máximos de [3 horas] até segunda ordem; orientada sobre técnicas de estímulo e verificação da pega correta."
    2. *"Orientados sinais de prontidão e saciedade para mamada."
    3. *"Manter cuidados com o coto umbilical (higiene a seco) até queda completa; orientados sinais de infecção."
    4. "Orientado agendamento retorno para avaliação pediátrica conforme solicitação da equipe médica."
    5. "Orientadas ações não farmacológicas para alívio de disquesia e acúmulo de gases." O termo correto é "disquezia".
    6. *"Orientado Tummy Time em momento oportuno (queda do coto)."
    7. *"Manobras de desengasgo."
    8. "Rotinas e Práticas para o sono seguro e higiene do sono." Variante: "…sono seguro, janelas e higiene do sono".
    9. *"Posturas de conforto e contenção para o bebê."
    10. "Troca de fraldas e higiene do bebê, banho de imersão e no chuveiro."
    11. *"Vestuário adequado ao clima."
    - Itens condicionais vistos: galactogogos; uso de coletor e bomba de extração elétrica com armazenamento do leite; manejo da sonda de translactação; "Manter mamada mista oferecer fórmula após SM".
15. **Conclusão** (5/5): "Conclusão: RN estável, calmo, ativo e reativo, em evolução favorável, [AME / em aleitamento materno misto], apresentando [ganho de peso progressivo / peso estável], [com icterícia leve em regressão aparente / sem icterícia]; condutas e orientações realizadas e registradas. Vínculo excelente dos pais com o bebê, com evolução progressiva da autonomia e segurança nos cuidados com o filho."
    - O texto é escrito no masculino e precisa concordar com o sexo do bebê.

---

## 4. O que dá para calcular e o que é julgamento clínico

A coluna do meio é texto-padrão que o sistema monta por regra a partir dos dados, e que a enfermeira pode editar.

| Seção | Calculável (cadastro + checklist diário) | Texto-padrão montado por regra | Julgamento clínico / texto livre |
|---|---|---|---|
| Identificação, período, histórico | Nome, idade pela data de nascimento, 1ª e última visita, tipo de parto, DN, DA, Nº dia de puerpério e de vida, sexo, filiação, data de emissão | | |
| Evolução geral | Frase de estabilidade (se todos os sinais vitais estiverem dentro dos limites); ferida operatória ou períneo a partir de sinais marcados; edema no primeiro e no último dia | as frases padrão 1 a 4 | Disposição, humor, sono, queixas, comparação com os dias anteriores |
| Sinais vitais | Mínimo e máximo de FC, temperatura e SpO2; PA pela regra que for definida; alerta para valores fora da referência | | Contexto de episódios (por exemplo, febre) |
| Mamas | Turgência e produção por dia; lesão (grau, lado, local, dia em que surgiu, grau final); datas de uso do bico de silicone; dia da apojadura | "Ausência de sinais…"; "resposta cicatricial" se o grau caiu | Causa, manejo, adjetivos ("excelente") |
| Dor | Escala no D1, máxima e final; dia em que zerou; local; remissão total ou parcial | frase padrão | Contexto |
| Eliminações | Último registro de lóquios (quantidade, aspecto, odor, coágulos); diurese e evacuação | frase padrão | Intercorrências |
| Intervenções | Dias (D) de laser por local, finalidade e dose; dias de ILIB; drenagem | frases padrão | Resposta clínica |
| Orientações de alta e encaminhamentos | Lista padrão (item de ferida operatória só em cesárea) mais itens marcados; retorno obstétrico com data e motivos; saúde mental, nutrição | frases padrão | Itens personalizados, justificativas |
| Conclusão (mãe) | Término conforme combinado ou antecipado (visitas contratadas × realizadas); tipo de amamentação final; produção de leite | frase padrão | Autonomia, segurança, rede de apoio |
| Curva de peso | Lista de pesagens; peso de nascimento; menor peso; % de perda; ganho absoluto e g/dia; se recuperou o peso de nascimento | Classificação, se houver regra | Interpretação (por exemplo, discrepância com o comportamento do bebê) |
| Exame do RN | Faixas de temperatura, FR, FC e SpO2; checklist de reatividade, mucosas, fontanela, abdômen, coto (data da queda), genitália, eliminações (número de fraldas) | frases padrão | Sonolência, comportamento na mamada |
| Icterícia | Zona por dia (máxima, final, tendência); intensidade; datas de fototerapia; data da notificação | frase padrão | Conduta e decisão |
| Alimentação do RN | Tipo por dia; complemento (tipo, ml, método); bico de silicone; intervalo entre mamadas | frase padrão | Narrativa do manejo |
| Orientações e conclusão do RN | Checklist com parâmetros; trechos da conclusão derivados (aleitamento, ganho, icterícia, gênero) | frases padrão | Vínculo e autonomia (texto padrão editável) |

**Regra de cálculo do ganho observada na prática.** Nos 3 casos em que o ganho foi calculado, a base foi o menor peso registrado e não necessariamente o peso da alta. Em 2 desses casos o menor peso coincidiu com o da alta. Os dias contados foram o intervalo entre as duas datas.

---

## 5. Dados que aparecem nas evoluções e não estão na especificação

**Transversais (valem para os dois documentos)**
- A especificação neonatal não prevê a data do documento ("Data:" ou "Data de acompanhamento:", 5/5) nem o período de acompanhamento (5/5). O documento puerperal não tem data de emissão, nem nos arquivos nem na especificação.
- Os dias do acompanhamento são numerados D1 a Dn, e há eventos presos a cada dia.
- Dias cancelados pela família e o motivo (2 casos). Término "conforme acordo prévio" ou antecipado.
- Especialidade na assinatura ("Enfermeira Obstetra"). Num caso, a marca junto ao COREN.
- Data de nascimento do RN: a especificação neonatal não prevê o campo. Nos documentos, só aparece na linha de peso "nascimento".

**Puerperal**
- Nº dia de puerpério (5/5).
- Ferida operatória em cesárea (3/3). Períneo em parto vaginal (2/2): grau e local da laceração, sutura, dor local, laser.
- Edema de membros inferiores com evolução, às vezes graduado em cruzes (5/5).
- Sono, repouso e cansaço (5/5). Estado emocional (3/5). Nenhuma escala padronizada, como EPDS.
- Medicações em uso durante o período: polivitamínicos, sintomáticos, reposições, psicofármacos (3/5).
- Antecedentes relevantes, como cirurgia mamária prévia ou condições que afetam a nutrição (2 a 3 casos).
- Hemorroidas (1). Involução uterina (1). Febre pontual com o dia e o contexto (1).
- **Mamas:** dia da apojadura, ingurgitamento, uso e retirada do bico de silicone, lesões novas com o dia em que surgiram, lado, local (mamilo ou mama) e grau, extração com bomba, translactação, cicatriz cirúrgica.
- **Dor:** local e contexto (abdominal, perineal, mamilar durante a mamada), dia em que zerou, dor residual no fim, limitação funcional.
- **Eliminações:** diurese e evacuação da mãe com queixas (1). Odor e coágulos dos lóquios (a especificação só pede quantidade e aspecto).
- **Laser:** alvo (mama, períneo, edema), técnica ("reparação tecidual" ou "sensibilidade"), dose em J (2/5). Drenagem linfática (1). Resposta ao ILIB (1).
- **Orientações de alta:** itens personalizados além dos 4 alertas. Elevação das pernas e meias de compressão. Alimentação, hidratação, descanso, rotina de extração.
- **Encaminhamentos:** data prevista da consulta obstétrica, motivos do retorno, nutricionista, equipe de saúde mental que já acompanha. Encaminhamentos do bebê escritos no documento da mãe.
- **Conclusão:** amamentação exclusiva, mista ou com complemento; produção de leite; participação do parceiro e de que forma (o texto assume sempre "marido/esposo").

**Neonatal**
- **Peso:** peso de nascimento (2/5), menor peso, várias pesagens no mesmo dia, observações presas a uma pesagem, classificação qualitativa do ganho ("adequado", "inadequado?", "baixo", em 3/5), comentário clínico com número de fraldas em 24 h (1).
- **Icterícia:** intensidade em cruzes, evolução da zona dia a dia, fototerapia domiciliar com início e fim, exames laboratoriais, cuidados na fototerapia (temperatura, mudança de posição), notificação ao pediatra com data e quem notificou, conduta expectante.
- Pulsos ("cheios") e perfusão ("Membros: bem perfundidos") (2/5).
- Queda do coto e a data (1).
- **Alimentação:** tipo de aleitamento (exclusivo, misto, translactação); complemento (fórmula ou leite materno ordenhado, volume em ml e como mudou, oferecido em copinho ou por sonda de translactação); bico de silicone e tentativas de retirada; mudanças feitas pelo pediatra; intervalos longos entre mamadas; sucção nutritiva; aceitação de fórmula. A especificação só prevê "aleitamento exclusivo e sucção".
- **Pele:** dermatite de fraldas, com o dia em que surgiu, o tratamento (creme de barreira e laser) e o dia da remissão (1).
- **Intervenções no RN:** laserterapia. A especificação só prevê intervenções na mãe.
- **Encaminhamentos do RN:** fonoaudiologia, osteopatia, avaliação ou cirurgia de frênulo lingual, retorno pediátrico. Não há seção de encaminhamentos na especificação neonatal.
- Parâmetros das orientações (intervalo máximo entre mamadas) e orientações condicionais (complemento, bomba, sonda).

**Perguntei sobre estes itens e o resultado foi:**
- **Já previstos na especificação:** saturação e fontanela aparecem nos documentos e já estão previstas.
- **Não aparecem em nenhum documento:**
  - perímetros (cefálico, torácico, abdominal) e comprimento;
  - teste do pezinho e os demais testes de triagem (orelhinha, olhinho, coraçãozinho, linguinha);
  - vacinas;
  - Apgar, idade gestacional, tipo sanguíneo;
  - LATCH, EPDS;
  - frequência respiratória, peso e altura uterina da mãe.

---

## 6. Recomendações para o gerador

1. **Montar o texto a partir de campos.** Trocar datas, gênero, dias e trechos específicos de caso por campos estruturados, nunca por texto copiado.
2. **Calcular os números automaticamente.** Faixas de sinais vitais, curva de peso (com peso de nascimento, menor peso, % de perda e ganho em g/dia) e dias D.
3. **Usar listas fechadas.** Kramer de 1 a 5 com a descrição padrão; grau da lesão; escala de dor de 0 a 10; origem de cada pesagem.
4. **Validar antes da aprovação.** Checar datas; conferir a conclusão contra os achados (AME, ganho, icterícia); só incluir o item de ferida operatória em cesárea.
5. **Assinatura e COREN vindos do cadastro da profissional,** mais um registro de aprovação da coordenação.
6. **Criar a identidade visual:** cabeçalho com logo e dados da empresa, rodapé com paginação e aviso de confidencialidade (LGPD art. 11), metadados do PDF controlados e idioma pt-BR.
7. **Manter mãe e bebê em documentos separados,** como prevê o fluxo de envio ao obstetra e ao pediatra, e limitar os dados do bebê que entram no documento da mãe.
8. **Nomear os arquivos por identificador, sem nome de paciente.**

## 7. Como isso entrou no PRD

- Seções, campos calculados e textos padrão: PRD 9.5.
- Campos que as evoluções usam e o checklist não coleta: PRD 22.3, item K-01.
- Regra do ganho de peso e contagem do dia de vida: PRD 22.3, item K-11.
- MODELO com dados reais: PRD 22.4, item L-02. Ele não serve de seed, de modelo nem de teste.
