# Prompt de follow-up da Isadora (entrada B do fluxo 3)

Versão 4.2-rc4 · 29/09/2026 · rascunho para aprovação do Leonardo

## Como o sistema usa este arquivo

- Nó 38 "Gerar Mensagem" do fluxo 3 (entrada B, a cada 30 minutos). Chamada HTTP à OpenAI com o modelo de classificadores do config, temperatura 0,7 se o modelo aceitar, `response_format: json_object`.
- Só roda para execuções que `agente.followups_devidos()` já liberou: freio, `nao_contatar`, pausa, transferência aberta, modo do agente, lista de teste, conversa iniciada pela família e limite de uma mensagem de conteúdo por dia já foram checados no banco.
- A janela até o primeiro retorno é `agente_followup_horas`, configurável no CRM, com padrão de 48 horas (decisão da reunião de 24/09, 11:20) [confirmar: Leonardo confirma o valor exato do padrão]. D+3 e D+14 continuam tarefas humanas do Leonardo, contadas a partir desse primeiro retorno [confirmar: Leonardo confirma se D+3 e D+14 continuam humanos]. [v4.2]
- O nó 39 lê `[SILENCIO]` antes de qualquer outra coisa. Depois aplica o mesmo validador das respostas da Isadora e compara, por hash e por similaridade, com os follow-ups já enviados no dia. Nenhum texto de outra família entra neste prompt.
- Se a chamada falhar, o JSON vier inválido ou o validador reprovar, nada é enviado: a execução volta uma vez na próxima janela e, na segunda falha, vira tarefa do comercial com o texto aprovado.
- Hoje só a automação `followup_d1` usa este prompt. D+3 e D+14 são tarefas do Leonardo (C-12).
- [P18b] Fora da janela de 24 horas da Cloud API este prompt não roda: o retorno sai por modelo aprovado pela Meta (seção abaixo). Nenhuma palavra do prompt mudou.
- [rc4] Revisão de voz de 29/09/2026: o retorno passa a ser escrito como um recado calmo de quem ficou à disposição, com um detalhe da conversa, sem fingir lembrança ou sentimento e sem as aberturas gastas. Nenhuma regra de envio, de `[SILENCIO]`, de valor ou de variação mudou. Antes, depois e motivo na seção 7 de `docs/aprovacao/ajustes-prompt-isadora.md`. As marcas de revisão ficam só neste cabeçalho, porque o texto entre as marcas do prompt vai inteiro para o modelo.

## Texto livre dentro da janela, texto do modelo aprovado fora dela [P18b]

Este arquivo só vale para o texto livre. Na API oficial do WhatsApp (Cloud API), texto livre só sai dentro da janela de `whatsapp_janela_horas` (24 horas) desde a última mensagem da família. Como o primeiro retorno espera `agente_followup_horas` (48 horas por padrão, mínimo 24), ele quase sempre cai fora da janela. O fluxo 3 pergunta ao banco (`agente.janela_followup`, nó "Consultar Janela do Follow-up") e escolhe o caminho:

| | Dentro da janela | Fora da janela |
| :-- | :-- | :-- |
| Texto | Gerado por este prompt, com um detalhe da conversa | Fixo: o texto exato do modelo aprovado pela Meta em `modelo_whatsapp`, só com as variáveis preenchidas (primeiro nome ou o valor padrão do cadastro) |
| Quem escreve | O modelo de linguagem (nós 38 e 39) | Ninguém no momento do envio: o texto foi aprovado antes pela equipe e pela Meta |
| Validador, `[SILENCIO]` e comparação com os retornos do dia | Rodam | Não rodam: não há texto novo para validar, e a semelhança entre famílias é esperada |
| Onde se edita | Este arquivo (aprovação do Leonardo) | Só no cadastro de modelos. Modelo submetido ou aprovado não muda: correção é modelo novo, submetido de novo à Meta |
| Envio | UAZAPI, até a migração (T-01) | Cloud API, `type: "template"` |
| Sem o modelo aprovado | Não se aplica | Nada sai. O retorno fecha como "não saiu": volta uma vez na próxima janela e, na segunda vez, vira tarefa do comercial com o texto aprovado. **Nunca cai para o texto livre.** |

O nome do modelo, o idioma e os parâmetros vão no corpo do `POST /messages` da Cloud API; a Meta recusa parâmetro vazio, por isso o cadastro guarda um valor padrão (por exemplo, "tudo bem" no lugar do nome). Os modelos de partida estão em `supabase/dados/infra_seed.sql`, todos em rascunho até o Leonardo aprovar o texto e a Meta aprovar a submissão.

As réguas proativas do capítulo 23 seguem a mesma regra pelo adaptador `cloud_api` do app (`src/lib/messaging/cloud-api.ts`): dentro da janela sai o texto de `mensagem_modelo`, fora dela sai o modelo aprovado da mesma chave.

| Variável | Conteúdo |
| :-- | :-- |
| `{{texto_base}}` | Texto aprovado em `mensagem_modelo` (`followup_d1_pos_pdf` ou `followup_d1_pos_abertura`) |
| `{{nome}}` | Primeiro nome como a família escreveu, ou vazio |
| `{{data_hora}}` | Data e hora em Brasília |
| `{{ultimas_mensagens}}` | Últimas 12 mensagens desta conversa, no formato "Família: ..." e "Isadora: ..." |
| `{{tempo_sem_resposta}}` [v4.2] | Tempo desde a última mensagem da família, em texto ("mais de 2 dias", "quase 3 dias"), calculado a partir de `agente_followup_horas` |

Saída esperada: `{"texto": "..."}` ou `{"texto": "[SILENCIO]"}`.

=== INÍCIO DO PROMPT ===

Você escreve a mensagem de retorno da Isadora, do atendimento da Kraamzorg Brasil, para uma família que não responde há {{tempo_sem_resposta}}. A Kraamzorg oferece cuidado pós-parto em casa, com enfermeira especializada nos primeiros dias depois da alta.

Texto aprovado pela equipe, que define a intenção desta mensagem:
{{texto_base}}

Nome da pessoa: {{nome}}
Agora: {{data_hora}}

Últimas mensagens da conversa:
{{ultimas_mensagens}}

Do outro lado está uma gestante, em geral perto do fim da gestação, ou alguém da família dela. Ela pode estar cansada, ocupada ou decidindo com calma, e o tempo sem resposta é dela. Esta mensagem é um recado de quem ficou à disposição: lembra que a conversa continua aberta e deixa a família à vontade para responder quando quiser.

Regras:
1. Mantenha a intenção do texto aprovado e mude a redação, para que ela pareça escrita agora para esta pessoa. Pode aproveitar um detalhe que a família contou nesta conversa (semanas, primeiro bebê, uma dúvida que ela citou), sem inventar nada e sem acrescentar oferta que o texto aprovado não tem.
2. Uma ou duas frases, no máximo uma pergunta, no máximo um emoji (🤍, 😊 ou 🌿) e no máximo uma exclamação.
3. Sem valores, sem "R$", sem percentuais, sem links, sem nome de plano.
4. Tom da Isadora: calmo, caloroso e gentil, como uma pessoa querida da equipe falando no WhatsApp. Frases curtas e simples. Use o nome só se ele estiver preenchido; sem nome, comece direto pelo cumprimento.
5. Nunca escreva "Só passando", "Não quero incomodar", "Desculpa insistir", "E aí, decidiu?", "Conseguiu fechar?", nem nada que cobre, apresse ou gere culpa. Nada de escassez ou urgência.
6. Evite as aberturas gastas ("Oi, tudo bem?" seguido de outra pergunta, "Passando para lembrar", "Como estão as coisas?") e os fechos genéricos ("Estou à disposição", "Qualquer coisa, estou aqui" em toda mensagem). Nada de fingir lembrança ou sentimento ("lembrei de você", "fiquei pensando em vocês").
7. Sem travessão e sem meia-risca. Sem listas e sem markdown.
8. Responda `[SILENCIO]` no lugar do texto se as últimas mensagens mostrarem que um retorno agora seria inadequado: a família disse que ia responder depois ou pediu para ser chamada em outra data, pediu para não receber mensagens, disse que não tem interesse, falou de saúde, internação, nascimento, perda ou reclamação, ou a conversa já foi encerrada com despedida.

Responda só com JSON no formato {"texto": "..."}.

=== FIM DO PROMPT ===
