# ADR 0001 · Stack e fronteira de dados do agente

Data: 24/09/2026
Relacionado: PRD.md capítulo 4 (D-13 e D-14), capítulo 5 (stack e convenções)

## Contexto

O Kraamzorg OS precisa de uma stack única para CRM comercial, operação
domiciliar, registro assistencial offline e a agente de WhatsApp Isadora, com
dado de saúde de gestantes e recém-nascidos (LGPD art. 11) e uso pesado em
celular, muitas vezes sem sinal. A Drop Agency já opera esse tipo de projeto
(caso Results) com Next.js na Vercel e Supabase, o que reduz risco de entrega
dentro do calendário do contrato. O agente de IA precisa de um lugar para
rodar os fluxos de conversa (n8n) e de um jeito de acessar o banco sem nunca
tocar em dado clínico, porque o n8n roda numa instância separada, fora do
perímetro de autenticação do app.

## Decisão

**D-13 · Stack:** Next.js (App Router, TypeScript estrito) na Vercel, Supabase
(Postgres com RLS, Auth com MFA, Storage, pg_cron, pgvector) na região
`sa-east-1`, Cloudflare para DNS e Turnstile, n8n para os fluxos do agente,
UAZAPI para o WhatsApp no número comum, Redis para fila curta e cache de
pausa, e OpenAI para conversa, classificação, embeddings e transcrição. Todo
o detalhe está no PRD, capítulo 5.1.

**D-14 · Fronteira do agente:** o n8n acessa o banco só pelo papel de banco
`n8n_agente`, que enxerga apenas as funções do schema `agente` e as duas
tabelas de `agente_n8n` que os nós LangChain usam (memória e vetores). O
agente nunca lê tabela assistencial nem escreve direto numa tabela
operacional; toda ação passa por uma função do schema `agente`, que por
dentro decide o que é seguro devolver ou gravar.

## Consequências

- Uma base de código só, PWA instalável, sem loja de aplicativo (D-01).
- SQL de RLS e de funções do schema `agente` é o único jeito de o n8n tocar
  no banco; o papel `n8n_agente` não recebe `select` em `assistencial` nem em
  `privado`, e o `execute` padrão de `public` fica revogado (PRD 5.2).
- Migrations do papel `n8n_agente` e das tabelas `agente_n8n` chegam no P02 a
  P04; a fronteira em si (funções do schema `agente`) chega no P21 e P22.
- Troca de framework, banco ou automação de fluxo depois deste ponto custa
  reescrever `n8n/build.mjs`, o cliente de `src/lib/db` e as migrations já
  aplicadas, então essa decisão só se rediscute editando o capítulo 4 do PRD.
- Dependência de disponibilidade da Vercel, do Supabase e da instância n8n da
  Drop; contrato exige código e projetos em nome da Kraamzorg (D-12) para
  reduzir o risco de troca de fornecedor.
