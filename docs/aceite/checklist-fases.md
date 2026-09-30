# Checklist de aceite

Uma lista de conferência para cada fase, seguindo o critério do PRD (capítulo 16). Marque cada linha com a data e o nome de quem viu funcionar. O aceite vale quando todas as linhas da fase estão marcadas ou têm um adiamento escrito e assinado.

Calendário previsto: Fases 0 e 1 em 30/10/2026 (condicionado a T-01 e T-06), Fase 2 na semana de 16 a 20/11, aceite final na semana de 30/11 a 04/12. As datas do aceite final precisam de confirmação por escrito do Leonardo.

## Para todas as fases

Antes de assinar qualquer aceite, rode os quatro invariantes e o restante da conferência.

- [ ] Invariantes 1, 2 e 3: `supabase test db`, tudo verde.
- [ ] Invariante 4: `pnpm test` e `pnpm e2e:offline`, tudo verde.
- [ ] Fluxos da Isadora: `node --test n8n/build.test.mjs`, tudo verde.
- [ ] `pnpm lint` e `pnpm typecheck` sem erro.
- [ ] `gitleaks detect` sem achado.
- [ ] Nenhum dado real, nome de paciente ou segredo no repositório.
- [ ] Telas conferidas no celular (390 px) e no computador.
- [ ] Nenhum preço, prazo, texto ou limite novo escrito no código.

| Invariante | O que prova                                                                                                 |
| :--------- | :---------------------------------------------------------------------------------------------------------- |
| 1          | Nenhuma transição de etapa fora da tabela. Alteração direta é recusada.                                     |
| 2          | Cada papel vê só o que a matriz permite. Leitura assistencial gera log. Sem código do autenticador, não lê. |
| 3          | Nenhuma automação roda fora do freio. A Isadora não responde em bloqueio total.                             |
| 4          | Registro feito sem sinal chega inteiro e na ordem.                                                          |

## Fase 0 · Base

Critério: logar com um usuário de cada papel, pelo celular, e conferir a matriz. Toda ação aparece no log. Um formulário preenchido sem conexão sincroniza ao voltar o sinal.

- [ ] Entrei como comercial, coordenação, enfermeira, financeiro, marketing e diretoria, pelo celular.
- [ ] Cada papel vê só as telas da sua navegação.
- [ ] Enfermeira, financeiro, coordenação e diretoria só entram com o código do autenticador.
- [ ] Tentei abrir uma tela de outro papel e recebi a recusa.
- [ ] Cadastro aberto está desligado. A conta só nasce de convite da diretoria.
- [ ] A diretoria revogou uma sessão e o aparelho caiu em até uma hora.
- [ ] O log de auditoria mostra as ações do teste, com dado pessoal como "[oculto]".
- [ ] Preenchi um formulário sem conexão, voltei o sinal e o registro subiu inteiro.
- [ ] O aplicativo instala no Android (Chrome) e no iPhone (Safari) e abre pelo ícone.

## Fase 1 · Do WhatsApp ao pagamento

Critério: uma família fictícia vai do primeiro contato no WhatsApp até o pagamento confirmado, com contrato gerado e enviado pelo celular, sem ninguém mexer no banco. A reunião inicial é agendada pela Isadora num calendário de teste e registrada como realizada pela Edilaine, momento em que a conversa passa ao Leonardo. O agente passa nas 28 mensagens do roteiro de teste.

- [ ] A família fictícia escreve pelo WhatsApp de teste e a Isadora responde.
- [ ] O lead aparece no Pipeline com a origem certa.
- [ ] A Isadora agenda a reunião no calendário de teste: o evento existe, com link do Meet e convite enviado.
- [ ] A Edilaine registra a reunião como realizada e a conversa passa ao Leonardo.
- [ ] A Isadora não volta a falar de venda depois da passagem, nem quando a pausa vence. Só "Devolver à Isadora" reabre.
- [ ] O contrato é gerado e enviado pelo celular, e a assinatura muda a etapa sozinha.
- [ ] O link de pagamento mostra no máximo três parcelas.
- [ ] O pagamento de teste confirma e a etapa avança.
- [ ] Relato de saúde vira alerta à coordenação, com o texto aprovado, antes de qualquer outra decisão.
- [ ] Freio em bloqueio total: a Isadora não responde àquela família.
- [ ] Duas conversas simultâneas não trocam de contexto (cada chamada usa o `conversa_id` da própria conversa).
- [ ] As 28 mensagens do roteiro passaram, e as falhas têm registro e responsável.
- [ ] Nenhuma etapa dependeu de alterar o banco à mão.

Dependências externas: T-01 (número do WhatsApp e API oficial), T-06 (InfinitePay), T-11 (agenda da Edilaine). Sem elas, o aceite roda em número de homologação e com pagamento simulado, e isso fica escrito no termo.

## Fase 2 · Operação e registro assistencial

Critério: uma enfermeira real registra um dia inteiro pelo celular, incluindo um trecho sem sinal, dispara um alerta clínico de teste, gera a evolução e o sistema envia a pesquisa.

- [ ] A enfermeira instalou o aplicativo e entrou com o código do autenticador.
- [ ] A coordenação designou uma família e a enfermeira aceitou a oferta.
- [ ] A enfermeira fez a visita completa pelo celular, com um trecho sem sinal.
- [ ] O registro sem sinal subiu inteiro e na ordem quando a conexão voltou.
- [ ] Um valor acima do limite disparou o alerta, com o telefone da supervisão.
- [ ] O acionamento foi registrado e a coordenação fechou o alerta.
- [ ] A enfermeira assinou o registro. Uma correção entrou como adendo, sem alterar o original.
- [ ] Toda leitura da ficha assistencial aparece no log.
- [ ] A evolução para o médico foi gerada e revisada.
- [ ] A pesquisa de satisfação saiu depois da alta e a resposta chegou.
- [ ] Gêmeos: cada bebê tem registro separado.
- [ ] Quem não tem a família atribuída não consegue abrir a ficha.

## Fase 3 · Gestão e experiência

Critério: a diretoria responde às cinco perguntas executivas sem pedir relatório a ninguém.

- [ ] Comercial: leads, sessões, contratos, conversão e ticket.
- [ ] Marketing: origem, custo por canal e receita por campanha.
- [ ] Operação: famílias ativas, visitas, capacidade das próximas oito semanas e ocorrências.
- [ ] Experiência: satisfação, indicações e depoimentos.
- [ ] Financeiro: receita, recebimentos, inadimplência, custos, margem e previsão.
- [ ] Os números do painel batem com as telas de origem, em amostra conferida à mão.
- [ ] O portal da família abre só para a família dona da conta.
- [ ] Manuais e trilhas de treinamento publicados, com confirmação de leitura.

## Aceite final (P54)

- [ ] Fases 0, 1, 2 e 3 marcadas acima.
- [ ] Treinamentos feitos conforme `docs/manual/treinamento.md`, com lista de dúvidas e responsáveis.
- [ ] Enfermeiras, coordenação e diretoria com o aplicativo instalado.
- [ ] Guia `docs/aceite/ligar-o-sistema.md`: seção 7 conferida em produção.
- [ ] Transferência (seção 9 do guia): repositório, projetos, domínio e contas em nome da Kraamzorg.
- [ ] Fluxos do n8n exportados, com instruções de migração entregues.
- [ ] Teste de restauração de backup feito e registrado.
- [ ] Lista final dos itens `[confirmar]` abertos, com responsável (tabela abaixo).
- [ ] Termo de aceite final assinado pela Kraamzorg.

### Itens abertos na entrega

Preencha na semana do aceite, a partir de `docs/aprovacao/decisoes-pendentes.md` e do capítulo 22 do PRD. Cada item aberto tem um padrão que o sistema já usa. Aceitar com item aberto significa aceitar o padrão.

| ID   | Assunto                                         | Padrão em uso                                      | Quem decide          | Prazo |
| :--- | :---------------------------------------------- | :------------------------------------------------- | :------------------- | :---- |
| T-01 | Número e API oficial do WhatsApp                | Isadora desligada em produção, atendimento manual  | Leonardo e Drop      |       |
| T-06 | Credenciais da InfinitePay e limite de parcelas | Plano de cobrança em até três parcelas             | Leonardo e Drop      |       |
| T-11 | Credencial da agenda da Edilaine                | Sem ela a Isadora não agenda                       | Edilaine e Drop      |       |
| T-12 | Modelos de mensagem aprovados pela Meta         | Follow-up e lembretes fora da janela ficam parados | Drop e Leonardo      |       |
| T-05 | Emissão de NFS-e                                | Emissão manual pela contadora                      | Leonardo e contadora |       |
| T-07 | Licença das fontes para web                     | Jost e Inter                                       | Drop                 |       |
|      | (demais itens da lista de decisões pendentes)   |                                                    |                      |       |

## Termo de aceite

Modelo de texto para o termo, a ser revisado pelo jurídico da Kraamzorg antes de assinar.

> A Kraamzorg Brasil declara que conferiu, em [data], o Kraamzorg OS conforme a lista de aceite anexa, e aceita a entrega da fase [número], com os itens abertos registrados na tabela anexa e os seus padrões de uso.

| Nome | Papel | Data | Assinatura |
| :--- | :---- | :--- | :--------- |
|      |       |      |            |
