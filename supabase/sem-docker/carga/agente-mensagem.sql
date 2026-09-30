-- Carga básica do caminho de banco do webhook do agente (P53 item 4):
-- cada cliente do pgbench é um número diferente mandando uma mensagem, e
-- percorre as chamadas que o fluxo 3 do n8n faz no banco para ela, como o
-- papel n8n_agente. Números sintéticos da faixa 55119000053xx.
-- Rodar por supabase/sem-docker/scripts/carga-agente.sh, nunca em produção.
set role n8n_agente;
\set n :client_id + 10
select quote_literal(agente.registrar_mensagem(
         '55119000053' || lpad(:n::text, 2, '0') || '@s.whatsapp.net', 'entrada', 'cliente',
         'Oi, estou com 32 semanas e queria saber como funciona o acompanhamento em casa.',
         'texto', 'P53-CARGA-' || :client_id || '-' || :scale || '-' || extract(epoch from clock_timestamp())::text,
         null, '55119000053' || lpad(:n::text, 2, '0'), null, null) ->> 'conversa_id') as conversa_id \gset
select agente.checar_termos_alerta('Oi, estou com 32 semanas e queria saber como funciona o acompanhamento em casa.');
select agente.pode_responder(:conversa_id::uuid);
select agente.contexto_conversa(:conversa_id::uuid, 20);
select agente.pode_enviar(:conversa_id::uuid, 'resposta', null);
reset role;
