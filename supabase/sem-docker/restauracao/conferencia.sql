-- Lista de conferência da restauração (docs/runbooks/restauracao.md, seção 3),
-- só contagens e presença, nunca linhas. Mesma consulta na origem e na cópia.
-- Cada linha: item | chave | valor.
select '1' as item, 'tabelas_com_rls/total' as chave,
       (count(*) filter (where c.relrowsecurity))::text || '/' || count(*)::text as valor
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public','privado','agente','agente_n8n')
union all select '2', 'familia', count(*)::text from public.familia
union all select '2', 'pessoa', count(*)::text from public.pessoa
union all select '2', 'contrato', count(*)::text from public.contrato
union all select '2', 'visita', count(*)::text from public.visita
union all select '2', 'registro_atendimento', count(*)::text from public.registro_atendimento
union all select '2', 'registro_adendo', count(*)::text from public.registro_adendo
union all select '2', 'mensagem', count(*)::text from public.mensagem
union all select '2', 'log_auditoria', count(*)::text from public.log_auditoria
union all select '3', 'gatilhos_registro_atendimento', count(*)::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'registro_atendimento' and not t.tgisinternal
union all select '3', 'funcoes_api', count(*)::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api'
union all select '3', 'politicas_rls', count(*)::text from pg_policies
  where schemaname in ('public','privado','agente','agente_n8n','assistencial','storage')
order by 1, 2;
