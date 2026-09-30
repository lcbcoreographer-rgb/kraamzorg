# Manual · Diretoria

Para quem responde pela empresa. Você enxerga todas as áreas e é a única pessoa que convida gente, revoga sessão e aprova as exceções. Entre sempre com o código do autenticador.

## As cinco perguntas que o Painel executivo responde

Sem pedir relatório a ninguém, o Painel executivo responde:

1. **Comercial.** Quantos leads, sessões de venda, contratos, qual a conversão e o ticket.
2. **Marketing.** Origem dos leads, custo por canal e receita por campanha.
3. **Operação.** Famílias ativas, visitas feitas, capacidade das próximas oito semanas e ocorrências.
4. **Experiência.** Satisfação, indicações e depoimentos.
5. **Financeiro.** Receita, recebimentos, inadimplência, custos, margem e previsão.

Abra o painel pelo Início. Escolha o período e desça pelas cinco áreas. Cada número leva à tela que o explica.

## O que só a diretoria faz

| Ação                         | Onde                              | Observação                                                                                   |
| :--------------------------- | :-------------------------------- | :------------------------------------------------------------------------------------------- |
| Convidar uma pessoa nova     | Convidar                          | Escolha o papel com o menor acesso que resolve.                                              |
| Revogar sessões              | Sessões e acessos                 | Use ao perder um celular ou ao desligar alguém.                                              |
| Ver o log de auditoria       | Configurações                     | Cada leitura do log também fica registrada.                                                  |
| Aprovar desconto e exceção   | Fila do comercial e do financeiro | A aprovação fica registrada com nome e hora.                                                 |
| Eliminar dados de um titular | Ficha da família                  | Pedido da LGPD. Exige código do autenticador e motivo escrito.                               |
| Mudar preço, pacote e prazo  | Configurações                     | Vale a partir da data de vigência. Contratos antigos mantêm a versão em que foram assinados. |
| Ligar e desligar a Isadora   | Isadora                           | Os modos são desligado, teste e ativo. Veja abaixo.                                          |

## A Isadora

- **Desligado.** Ela não responde a ninguém.
- **Teste.** Responde só aos números da lista de teste. O filtro de saúde continua valendo.
- **Ativo.** Responde às famílias.

Em produção, a Isadora só volta depois da migração para a API oficial do WhatsApp, testada e aprovada por escrito pelo Leonardo. O agente só sobe o freio. Quem baixa é sempre uma pessoa.

Texto novo da Isadora ou dos classificadores passa pela aprovação do Leonardo, e pela da Edilaine no que for clínico.

## Freio e privacidade

- Você reverte qualquer freio, com justificativa.
- A auditoria grava o que mudou sem copiar o prontuário. Dado pessoal aparece como "[oculto]".
- Dado real fica só em produção. Homologação e desenvolvimento usam dados fictícios.

## Rotina sugerida

| Quando        | O que olhar                                                                          |
| :------------ | :----------------------------------------------------------------------------------- |
| Todo dia      | Início, transferências vencendo, alertas clínicos abertos, freios sem justificativa. |
| Toda semana   | Painel executivo, capacidade das oito semanas, ocorrências, cobranças em atraso.     |
| Todo mês      | Teste de restauração de backup, fechamento financeiro, revisão de acessos ativos.    |
| A cada versão | Roteiro de aceite em `docs/aceite/checklist-fases.md`.                               |

## Incidente

Se houver suspeita de exposição de dado ou de credencial, siga `docs/runbooks/incidente.md`. A Kraamzorg é comunicada em até 24 horas. A decisão de avisar titulares e a autoridade é da Kraamzorg, como controladora.
