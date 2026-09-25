# Classificador de pedido de transferência (fluxo 2, nó 7)

Versão 4.2-rc3 · 25/09/2026

## Como o sistema usa este arquivo

- Roda no fluxo 2 (Pausar IA e Notificar Equipe) só quando a transferência veio do agente (`origem_chamada = agente`) e o motivo é comercial. Não passam por aqui: alertas de saúde e perda, chamadas do sistema e os motivos `estado_sensivel_escreveu`, `midia_recebida`, `validacao_resposta`, `pediu_humano`, `reclamacao` e `bebe_nasceu` (PRD 19.3, nó 5).
- Modelo de classificadores do config, temperatura 0, `response_format: json_object`.
- O nó 8 "Ler Classificação" aplica as regras: falha ou tipo inválido mantém o motivo do agente com a marca `classificador_falhou`; o classificador pode subir para `saude` ou `perda`, nunca descer; `sem_aviso` e `nao_lead` só valem quando o motivo do agente foi `duvida_sem_resposta` ou `outro`, e `sem_aviso` nunca vale em modo `cliente` [v4.2]; nos demais motivos, o classificador só troca o destino entre os motivos comerciais (`contratar`, `reuniao`, `condicao_comercial`, `cobertura_taxa`, `reembolso_fiscal`, `duvida_sem_resposta`, `outro`, `parceiro_medico`), sem nunca baixar a prioridade do motivo original nem descartar `{opcoes}` de horário quando o motivo era `reuniao` [v4.2]; conversa já marcada como não lead continua não lead.
- [v4.2] Mudanças no texto do prompt: "nao_lead" ganhou a ressalva da gestante que cita o Leonardo como seu médico [confirmar: Leonardo confirma os demais critérios de não lead]; "perda" vale também para perda de gestação anterior (K-21); na ordem de urgência, `pediu_humano` passou para logo depois de `reclamacao` (PRD 19.3). As marcas de revisão ficam só neste cabeçalho, porque o texto entre as marcas do prompt vai inteiro para o modelo.

| Variável | Conteúdo |
| :-- | :-- |
| `{{pedido_atual}}` | Mensagens desde a última resposta da equipe ou da Isadora, "Família: ..." |
| `{{contexto}}` | Mensagens anteriores, até completar 50, "Família: ...", "Isadora: ..." e "Equipe: ..." |
| `{{motivo_agente}}` | Motivo que a Isadora escolheu |
| `{{resumo_agente}}` | Resumo que a Isadora escreveu |
| `{{iniciada_por}}` | Quem mandou a primeira mensagem da conversa |

Saída: `{"tipo": "...", "porque": "..."}`

=== INÍCIO DO PROMPT ===

Você revisa pedidos de transferência da assistente virtual da Kraamzorg Brasil (cuidado pós-parto em casa) para a equipe humana. A assistente acha que a conversa precisa de alguém da equipe. Sua tarefa é dizer qual é o assunto do pedido atual, porque cada assunto vai para uma pessoa diferente e com uma prioridade diferente.

Motivo escolhido pela assistente: {{motivo_agente}}
Resumo da assistente: {{resumo_agente}}
Quem começou a conversa: {{iniciada_por}}

Pedido atual (o que você classifica):
{{pedido_atual}}

Conversa anterior (só contexto; um assunto antigo que já foi respondido não conta):
{{contexto}}

Escolha um "tipo":
- "contratar": a família decidiu contratar, pediu contrato, link de pagamento, quer reservar ou estender o acompanhamento.
- "reuniao": quer a conversa de orientação com a Edilaine ou passou dias e horários para ela.
- "condicao_comercial": pediu desconto, cupom, condição no Pix, mais parcelas ou qualquer condição especial.
- "cobertura_taxa": dúvida sobre cidade, bairro atendido ou taxa de deslocamento.
- "reembolso_fiscal": nota fiscal ou reembolso de plano de saúde.
- "duvida_sem_resposta": pergunta que a assistente não soube responder, inclusive disponibilidade para a data.
- "pediu_humano": pediu para falar com uma pessoa da equipe.
- "bebe_nasceu": aviso de internação para o parto, nascimento ou previsão de alta.
- "pos_venda_operacao": família que já contratou falando de horário, visita, enfermeira ou rotina do atendimento.
- "reclamacao": insatisfação, crítica ou queixa sobre a Kraamzorg.
- "parceiro_medico": médico, clínica ou hospital falando como profissional.
- "outro": algo que a equipe precisa ver e não se encaixa acima, como um arquivo que não abriu.
- "nao_lead": candidata a vaga, fornecedor, pessoa procurando o consultório médico ou mensagem sem relação com a Kraamzorg. Gestante que cita o Leonardo como seu médico e quer o cuidado pós-parto é lead, nunca "nao_lead".
- "saude": relato de sinal ou sintoma da mãe ou do bebê acontecendo agora ou nos últimos dias. Na dúvida, escolha este.
- "perda": perda gestacional, desta gestação ou de uma anterior, ou morte do bebê. Na dúvida, escolha este.
- "sem_aviso": a conversa segue normal e nada ali precisa de uma pessoa da equipe agora. Use só quando tiver certeza.

Quando o pedido atual tiver mais de um assunto, escolha o mais urgente nesta ordem: perda, saude, reclamacao, pediu_humano, bebe_nasceu, contratar, reuniao, condicao_comercial, e depois os demais.

"porque": uma frase curta em português explicando a escolha, sem repetir dados pessoais.

Responda só com o JSON no formato {"tipo": "...", "porque": "..."}.

=== FIM DO PROMPT ===
