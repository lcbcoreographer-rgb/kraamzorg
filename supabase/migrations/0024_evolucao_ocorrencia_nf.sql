-- =============================================================================
-- 0024_evolucao_ocorrencia_nf.sql
--
-- P41 · Evoluções em PDF e envio aos médicos, o lado do banco
-- P42 · Ocorrências, pesquisa nativa e NPS (pipeline 4)
-- P43 · Nota fiscal de serviço (NFS-e), o lado do banco
--
-- O que esta migration faz, na ordem:
--   1. Parâmetros novos (prazo, SLA, pesquisa, NFS-e, contato da coordenação)
--      e textos em mensagem_modelo (rascunho): nada disso fica no código.
--      As três automações que viram ativas: prazo_relatorio, pesquisa e
--      classificacao_nps.
--   2. Auxiliares em privado (recusa com código, dias úteis, acesso à
--      evolução). Nenhum com grant.
--   3. Evolução (P41): relatorio_medico ganha versão, erros de validação e
--      restrições; leitura auditada da base do acompanhamento
--      (assistencial.ler_*); rascunho, revisão, aprovação, dados do envio e
--      registro do envio (api.*); prazo D+1 e D+2 na etapa
--      privado.recalculo_prazo_relatorio do recálculo diário; gatilho que
--      abre a tarefa de emitir a evolução e o pós-venda quando o registro do
--      último dia entra.
--   4. Ocorrências (P42): versão, histórico, SLA por prioridade (parametro),
--      privada, responsável; aviso de SLA vencido por pg_cron.
--   5. Pesquisa e pós-venda (P42): link de uso único (só o sha256 no banco),
--      abrir e enviar pelo servidor (service_role), classificação NPS e as
--      ações do PRD 7.4 na mesma transação, freio no envio do link.
--   6. Nota fiscal (P43): estados, tentativas, arquivos, emissão manual
--      assistida, emissão automática pelo servidor depois do pagamento.
--   7. Execute e trava de segurança sobre o que esta migration criou.
--
-- A tabela relatorio_medico continua sem grant e sem política (PRD 6.10
-- regra 6): leitura só por assistencial.ler_*, escrita só pelas funções api
-- abaixo, que conferem papel, AAL e família.
-- =============================================================================


-- =============================================================================
-- 1. Parâmetros, textos e automações
-- =============================================================================

insert into public.parametro (chave, valor, descricao) values
  ('feriados', '[]',
   'P41, PRD 9.5: feriados (aaaa-mm-dd) que não contam como dia útil no prazo da evolução. Lista vazia conta só de segunda a sexta [confirmar: Edilaine, feriados que a equipe não atende].'),
  ('ocorrencia_sla',
   '{"normal":{"horas":72},"alta":{"horas":24},"maxima":{"horas":4}}',
   'P42, PRD 6.6: horas corridas até o vencimento da ocorrência, por prioridade [confirmar: Edilaine e Leonardo, prazos].'),
  ('pesquisa',
   '{"validade_dias":30,"tentativas_max":5,"tentativas_janela_minutos":15,"promotor_min":9,"neutro_min":7,"envio_prazo_horas":24,"depoimento_apos_dias":1,"indicacao_apos_dias":7,"escuta_prazo_dias":2}',
   'P42, PRD 7.4: validade do link da pesquisa, limite de tentativas por origem, corte do NPS (promotor de 9 a 10, neutro de 7 a 8, detrator abaixo), prazo da tarefa de envio e dias até as tarefas de depoimento, indicação e escuta [confirmar: Edilaine e Leonardo].'),
  ('pesquisa_perguntas',
   '[{"id":"nps","tipo":"escala_0_10","obrigatoria":true,"texto":"De 0 a 10, o quanto você recomendaria a Kraamzorg a uma pessoa querida?","rotulo_min":"Nada provável","rotulo_max":"Muito provável"},{"id":"recomendaria","tipo":"opcao","obrigatoria":false,"texto":"Você recomendaria o acompanhamento a outras famílias?","opcoes":[{"valor":"com_certeza","rotulo":"Com certeza"},{"valor":"provavelmente","rotulo":"Provavelmente"},{"valor":"talvez","rotulo":"Talvez"},{"valor":"provavelmente_nao","rotulo":"Provavelmente não"},{"valor":"nao","rotulo":"Não"}]},{"id":"destaque","tipo":"texto","obrigatoria":false,"texto":"O que mais fez diferença para vocês nesses dias?"},{"id":"sugestao","tipo":"texto","obrigatoria":false,"texto":"Tem algo que a gente poderia fazer melhor?"},{"id":"depoimento_autorizado","tipo":"sim_nao","obrigatoria":true,"texto":"Podemos usar o seu depoimento, com o seu primeiro nome, para contar a outras famílias como foi?"},{"id":"autorizacao_imagem","tipo":"sim_nao","obrigatoria":true,"texto":"Podemos usar imagens do acompanhamento que vocês compartilharam em nossos materiais?"}]',
   'P42, K-12, docs/referencia-pesquisa.md: perguntas da pesquisa nativa, com a pergunta NPS de 0 a 10 e as duas autorizações. As perguntas do formulário atual do Google Forms ainda não foram transcritas: as quatro do meio seguem o que o seed e o PRD citam [confirmar: Edilaine, transcrever o formulário atual].'),
  ('nfse_servico',
   '{"codigo":"05266","descricao":"Cuidado domiciliar pós-parto"}',
   'P43, PRD 14, 22.1 T-05: código e descrição do serviço na nota. 05266 é o código do sistema municipal; o código do padrão nacional vem da contadora [confirmar: contadora].'),
  ('nfse_emissao',
   '{"automatica":false,"tentativas":3}',
   'P43, T-05: com "automatica" falso a nota é emitida à mão, com ajuda da tela, até o provedor sair da homologação; verdadeiro faz o servidor emitir logo depois do pagamento confirmado [confirmar: Leonardo e contadora].'),
  ('profissional_funcoes',
   '{"enfermeira_obstetrica":"Enfermeira obstetra","enfermeira_neonatal":"Enfermeira neonatal","coordenacao":"Coordenação de enfermagem"}',
   'P41, PRD 9.5: como a função da profissional sai na assinatura da evolução (nome, especialidade e conselho) [confirmar: Edilaine, texto de cada função].'),
  ('evolucao_email',
   '{"tratamento":"Dr(a).","coordenacao":"","contato":""}',
   'P41, PRD 23.5: tratamento, nome da coordenação e canal de contato do e-mail da evolução. O envio só sai com coordenação e contato preenchidos [confirmar: Edilaine, texto e canal].')
on conflict (chave) do nothing;

update public.automacao set ativa = true where id in ('prazo_relatorio', 'pesquisa', 'classificacao_nps');

insert into public.mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('pesquisa_titulo', 'site', 'familia', 'Como foi para vocês?', array[]::text[], 'rascunho'),
  ('pesquisa_abertura', 'site', 'familia',
   'Oi, {nome}. Foram dias de muito cuidado, e a sua opinião ajuda a Kraamzorg a cuidar melhor das próximas famílias. São poucas perguntas e leva cerca de dois minutos.',
   array['nome'], 'rascunho'),
  ('pesquisa_enviar', 'site', 'familia', 'Enviar as minhas respostas', array[]::text[], 'rascunho'),
  ('pesquisa_agradecimento', 'site', 'familia',
   'Obrigada por contar como foi, {nome}. Cada resposta chega até a equipe e ajuda a cuidar melhor de quem vem depois.',
   array['nome'], 'rascunho'),
  ('pesquisa_link_invalido', 'site', 'familia',
   'Este link não está mais disponível. Se você quiser responder, é só pedir um novo link à nossa equipe.',
   array[]::text[], 'rascunho'),
  ('pesquisa_limite', 'site', 'familia',
   'Foram muitas tentativas em pouco tempo. Aguarde alguns minutos e abra o link de novo.',
   array[]::text[], 'rascunho'),
  ('pesquisa_corrigir', 'site', 'familia',
   'Falta responder alguma pergunta. Confira as marcadas e envie de novo.',
   array[]::text[], 'rascunho'),
  ('evolucao_familia_envio', 'whatsapp', 'familia',
   'Oi, {nome}! Segue a evolução de enfermagem do acompanhamento, que também enviamos aos médicos de vocês. Se ficar alguma dúvida, é só falar com a gente por aqui 🤍',
   array['nome'], 'rascunho')
on conflict (chave) do nothing;

-- Textos padrão da evolução (PRD 9.5), no formato de chaves que src/lib/pdf usa.
-- Rascunho até a revisão da Edilaine; os parágrafos são os do relatório de
-- análise das evoluções, já anonimizados. Todo texto com concordância de gênero
-- tem as formas _masculino e _feminino.
insert into public.mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('evo_pue_abertura', 'email', 'medico', 'Paciente no {dia}º dia de puerpério, apresenta-se em bom estado geral.', array['dia'], 'rascunho'),
  ('evo_pue_estabilidade', 'email', 'medico', 'Manteve estabilidade hemodinâmica com parâmetros dentro da normalidade durante todo o período assistencial.', array[]::text[], 'rascunho'),
  ('evo_pue_ferida_operatoria', 'email', 'medico', 'Ferida operatória sem sinais flogísticos, em processo cicatricial, sem sangramentos nem secreção.', array[]::text[], 'rascunho'),
  ('evo_pue_lesao_mama', 'email', 'medico', 'A lesão de grau {grau} em {local_lado}, identificada no D{dia_surgimento}, apresentou boa resposta cicatricial, com grau final {grau_final}.', array['grau','local_lado','dia_surgimento','grau_final'], 'rascunho'),
  ('evo_pue_dor_remissao_total', 'email', 'medico', 'Paciente referiu dor inicial (escala {inicial}), porém, após condutas terapêuticas, houve remissão total do quadro. Escala de dor mantida em 0 desde o D{dia_zerou} até a presente data.', array['inicial','dia_zerou'], 'rascunho'),
  ('evo_pue_dor_remissao_parcial', 'email', 'medico', 'Paciente referiu dor inicial (escala {inicial}), com remissão parcial após as condutas. Escala de dor {final} na presente data.', array['inicial','final'], 'rascunho'),
  ('evo_pue_laser', 'email', 'medico', 'Fotobiomodulação (laserterapia): realizada aplicação para {finalidade} nos dias {dias}, conforme protocolo.', array['finalidade','dias'], 'rascunho'),
  ('evo_pue_ilib', 'email', 'medico', 'Terapia ILIB: realizada nos dias {dias} para auxílio na recuperação sistêmica e controle inflamatório.', array['dias'], 'rascunho'),
  ('evo_pue_orientacoes_intro', 'email', 'medico', 'Foram reforçadas as orientações à paciente e ao acompanhante sobre sinais de alerta que exigem atenção ou busca por serviço médico:', array[]::text[], 'rascunho'),
  ('evo_pue_orientacoes_base_cesarea', 'email', 'medico', E'Picos febris; sinais flogísticos em ferida operatória.\nAumento súbito de dor mamária ou edema e rubor localizado.\nAumento expressivo do sangramento vaginal ou odor forte.\nMal-estar generalizado ou tonturas.', array[]::text[], 'rascunho'),
  ('evo_pue_orientacoes_base_vaginal', 'email', 'medico', E'Picos febris.\nAumento súbito de dor mamária ou edema e rubor localizado.\nAumento expressivo do sangramento vaginal ou odor forte.\nMal-estar generalizado ou tonturas.', array[]::text[], 'rascunho'),
  ('evo_pue_encaminhamento', 'email', 'medico', 'Encaminhada para retorno com equipe obstétrica para avaliação ({motivos}).', array['motivos'], 'rascunho'),
  ('evo_pue_encaminhamento_medicacoes', 'email', 'medico', 'Orientada a manter as medicações de uso contínuo.', array[]::text[], 'rascunho'),
  ('evo_pue_encaminhamento_saude_mental', 'email', 'medico', 'Orientada a programar retorno com a equipe de saúde mental que a acompanha.', array[]::text[], 'rascunho'),
  ('evo_pue_encaminhamento_nutricao', 'email', 'medico', 'Orientada a programar retorno com a equipe de nutrição.', array[]::text[], 'rascunho'),
  ('evo_pue_conclusao_exclusivo', 'email', 'medico', 'Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com boa produção láctea, segura quanto à amamentação exclusiva.', array['autonomia'], 'rascunho'),
  ('evo_pue_conclusao_misto', 'email', 'medico', 'Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante segura quanto à amamentação mista.', array['autonomia'], 'rascunho'),
  ('evo_pue_conclusao_complemento', 'email', 'medico', 'Atendimento finalizado nesta data conforme acordo prévio. {autonomia} Lactante com baixa produção láctea, sendo necessário complemento após as mamadas.', array['autonomia'], 'rascunho'),
  ('evo_neo_identificacao_masculino', 'email', 'medico', 'RN, sexo {sexo}, {dia_vida}º dia de vida; nascido por parto {tipo_parto}. Filiação: filho de {filiacao}.', array['sexo','dia_vida','tipo_parto','filiacao'], 'rascunho'),
  ('evo_neo_identificacao_feminino', 'email', 'medico', 'RN, sexo {sexo}, {dia_vida}º dia de vida; nascida por parto {tipo_parto}. Filiação: filha de {filiacao}.', array['sexo','dia_vida','tipo_parto','filiacao'], 'rascunho'),
  ('evo_neo_estado_geral_masculino', 'email', 'medico', 'Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmico ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.', array['reatividade','mucosas','temp_min','temp_max','fontanela'], 'rascunho'),
  ('evo_neo_estado_geral_feminino', 'email', 'medico', 'Estado geral: {reatividade}. Mucosas: {mucosas}. Normotérmica ({temp_min} a {temp_max} °C). Fontanela anterior: {fontanela}.', array['reatividade','mucosas','temp_min','temp_max','fontanela'], 'rascunho'),
  ('evo_neo_ictericia', 'email', 'medico', 'Icterícia em zona {zona} de Kramer, {tendencia}.', array['zona','tendencia'], 'rascunho'),
  ('evo_neo_respiratorio_masculino', 'email', 'medico', 'Eupneico, {esforco}; FR {fr_min} a {fr_max} rpm.', array['esforco','fr_min','fr_max'], 'rascunho'),
  ('evo_neo_respiratorio_feminino', 'email', 'medico', 'Eupneica, {esforco}; FR {fr_min} a {fr_max} rpm.', array['esforco','fr_min','fr_max'], 'rascunho'),
  ('evo_neo_cardiovascular', 'email', 'medico', 'FC {fc_min} a {fc_max} bpm.', array['fc_min','fc_max'], 'rascunho'),
  ('evo_neo_abdomen_coto', 'email', 'medico', 'Abdômen flácido, indolor à palpação. Coto umbilical: {estado_coto}.', array['estado_coto'], 'rascunho'),
  ('evo_neo_alimentacao_exclusivo', 'email', 'medico', 'Aleitamento materno exclusivo, com {succao}.', array['succao'], 'rascunho'),
  ('evo_neo_alimentacao_misto', 'email', 'medico', 'Aleitamento materno misto, com {succao}.', array['succao'], 'rascunho'),
  ('evo_neo_alimentacao_complemento', 'email', 'medico', 'Aleitamento com complemento de {complemento_ml} ml após as mamadas, com {succao}.', array['complemento_ml','succao'], 'rascunho'),
  ('evo_neo_genitalia_masculino', 'email', 'medico', 'Genitália masculina, testículos presentes, prepúcio íntegro e limpo.', array[]::text[], 'rascunho'),
  ('evo_neo_genitalia_feminino', 'email', 'medico', 'Genitália feminina, sem sinais de anormalidades aparentes.', array[]::text[], 'rascunho'),
  ('evo_neo_eliminacoes', 'email', 'medico', 'Diurese e evacuações presentes, fezes em transição.', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_masculino', 'email', 'medico', 'RN estável, calmo, ativo e reativo, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}. Vínculo dos pais com o filho em evolução progressiva.', array['aleitamento','evolucao_peso','estado_ictericia'], 'rascunho'),
  ('evo_neo_conclusao_feminino', 'email', 'medico', 'RN estável, calma, ativa e reativa, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}. Vínculo dos pais com a filha em evolução progressiva.', array['aleitamento','evolucao_peso','estado_ictericia'], 'rascunho'),
  ('evo_neo_conclusao_aleitamento_exclusivo', 'email', 'medico', 'em aleitamento materno exclusivo', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_aleitamento_misto', 'email', 'medico', 'em aleitamento materno misto', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_aleitamento_complemento', 'email', 'medico', 'em aleitamento com complemento', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_peso_progressivo', 'email', 'medico', 'ganho de peso progressivo', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_peso_estavel', 'email', 'medico', 'peso estável', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_peso_perda', 'email', 'medico', 'perda de peso em acompanhamento', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_ictericia_ausente', 'email', 'medico', 'sem icterícia', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_ictericia_regressao', 'email', 'medico', 'com icterícia em regressão', array[]::text[], 'rascunho'),
  ('evo_neo_conclusao_ictericia_presente', 'email', 'medico', 'com icterícia em acompanhamento', array[]::text[], 'rascunho'),
  ('evo_padrao_turgencia', 'email', 'medico', 'túrgidas', array[]::text[], 'rascunho'),
  ('evo_padrao_producao', 'email', 'medico', 'adequada para a demanda neonatal', array[]::text[], 'rascunho'),
  ('evo_padrao_loquios_quantidade', 'email', 'medico', 'pequena quantidade', array[]::text[], 'rascunho'),
  ('evo_padrao_laser_finalidade', 'email', 'medico', 'dor e reparação tecidual', array[]::text[], 'rascunho'),
  ('evo_padrao_reatividade_masculino', 'email', 'medico', 'reativo aos estímulos, desperta facilmente ao manejo', array[]::text[], 'rascunho'),
  ('evo_padrao_reatividade_feminino', 'email', 'medico', 'reativa aos estímulos, desperta facilmente ao manejo', array[]::text[], 'rascunho'),
  ('evo_padrao_mucosas', 'email', 'medico', 'úmidas e coradas', array[]::text[], 'rascunho'),
  ('evo_padrao_fontanela', 'email', 'medico', 'plana', array[]::text[], 'rascunho'),
  ('evo_padrao_esforco', 'email', 'medico', 'sem sinais de desconforto respiratório', array[]::text[], 'rascunho'),
  ('evo_padrao_succao', 'email', 'medico', 'sucção nutritiva', array[]::text[], 'rascunho'),
  ('evo_padrao_coto', 'email', 'medico', 'seco, sem sinais flogísticos', array[]::text[], 'rascunho')
on conflict (chave) do nothing;


-- =============================================================================
-- 2. Auxiliares (privado, sem grant)
-- =============================================================================

-- Número da edição das tabelas que a tela edita com conferência de conflito (evolução,
-- ocorrência, pós-venda, nota). Não usa o nome versao: essa coluna é da sincronização
-- offline (regra 13 do PRD 6.10) e o teste 004 limita quais tabelas a têm.
create function privado.incrementar_edicao() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.edicao = old.edicao + 1;
  return new;
end;
$$;
comment on function privado.incrementar_edicao() is 'Gatilho BEFORE UPDATE: incrementa a coluna edicao a cada update (conferência de conflito das telas de evolução, ocorrência, pós-venda e nota fiscal). Sem grant.';

-- Recusa de negócio com código que a tela traduz em frase: "<domínio>:<código> <detalhe>".
create function privado.recusar(p_dominio text, p_codigo text, p_detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception '%:% %', p_dominio, p_codigo, coalesce(p_detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.recusar(text, text, text) is '[P41 a P43] Recusa de negócio: erro P0001 com a mensagem "<domínio>:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

create function privado.hoje_sp() returns date
  language sql
  stable
  set search_path = ''
  as $$ select (pg_catalog.now() at time zone 'America/Sao_Paulo')::date $$;
comment on function privado.hoje_sp() is '[P41 a P43] Data de hoje em America/Sao_Paulo. Sem grant.';

-- Dias úteis depois de uma data: segunda a sexta, menos os feriados de parametro.feriados.
create function privado.dias_uteis_apos(p_data date, p_dias integer) returns date
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_d date := p_data;
  v_n integer := 0;
  v_feriados jsonb := coalesce(privado.venda_parametro('feriados'), '[]'::jsonb);
begin
  if pg_catalog.jsonb_typeof(v_feriados) is distinct from 'array' then
    v_feriados := '[]'::jsonb;
  end if;
  while v_n < p_dias loop
    v_d := v_d + 1;
    if pg_catalog.date_part('isodow', v_d) < 6 and not (v_feriados ? v_d::text) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_d;
end;
$$;
comment on function privado.dias_uteis_apos(date, integer) is '[P41] Data que fica N dias úteis depois de p_data (PRD 9.5: um dia útil para emitir a evolução). Segunda a sexta, menos parametro.feriados. Sem grant.';

-- Acompanhamento que a pessoa logada pode ler (ou gravar) a evolução: coordenação
-- em todos, diretoria só lê, enfermeira nas famílias atribuídas (PRD 13).
create function privado.evolucao_acesso(p_acompanhamento_id uuid, p_escrita boolean default false)
  returns public.acompanhamento
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_a public.acompanhamento;
begin
  select a.* into v_a from public.acompanhamento a where a.id = p_acompanhamento_id;
  if not found then
    perform privado.recusar('evolucao', 'acompanhamento_inexistente');
  end if;
  if privado.tem_papel('coordenacao') then
    return v_a;
  end if;
  if privado.tem_papel('diretoria') and not (p_escrita and not privado.tem_papel('enfermeira')) then
    return v_a;
  end if;
  if privado.tem_papel('enfermeira')
     and exists (select 1 from privado.familias_atribuidas() as f(id) where f.id = v_a.familia_id) then
    return v_a;
  end if;
  raise exception 'evolucao: acompanhamento fora do seu acesso (PRD 13)' using errcode = '42501';
end;
$$;
comment on function privado.evolucao_acesso(uuid, boolean) is '[P41] Devolve o acompanhamento se a pessoa logada pode ler (ou gravar) a evolução dele: coordenação sempre, diretoria só lendo, enfermeira nas famílias atribuídas. Recusa com 42501. Sem grant.';

-- A profissional dono do documento: a pessoa logada, se atende este acompanhamento;
-- senão a titular aceita; senão a da última visita.
create function privado.evolucao_profissional(p_acompanhamento_id uuid) returns public.profissional
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_p public.profissional;
begin
  select pr.* into v_p
  from public.profissional pr
  where pr.ativa and pr.usuario_id = auth.uid()
    and (exists (select 1 from public.designacao d
                  where d.acompanhamento_id = p_acompanhamento_id and d.profissional_id = pr.id and d.status = 'aceita')
         or exists (select 1 from public.visita vi
                     where vi.acompanhamento_id = p_acompanhamento_id and vi.profissional_id = pr.id))
  limit 1;
  if found then
    return v_p;
  end if;
  select pr.* into v_p
  from public.designacao d join public.profissional pr on pr.id = d.profissional_id
  where d.acompanhamento_id = p_acompanhamento_id and d.papel = 'titular' and d.status = 'aceita'
  order by d.respondida_em desc nulls last
  limit 1;
  if found then
    return v_p;
  end if;
  select pr.* into v_p
  from public.visita vi join public.profissional pr on pr.id = vi.profissional_id
  where vi.acompanhamento_id = p_acompanhamento_id
  order by vi.dia_numero desc
  limit 1;
  return v_p;
end;
$$;
comment on function privado.evolucao_profissional(uuid) is '[P41] Profissional dona da evolução: quem está logada e atende o acompanhamento, senão a titular aceita, senão a da última visita. Sem grant.';

-- Quantos documentos da evolução ainda faltam sair do rascunho (um puerperal e um
-- neonatal por bebê). "Emitida" aqui é enviada à revisão ou além.
create function privado.evolucoes_faltando(p_acompanhamento_id uuid) returns integer
  language sql
  stable
  set search_path = ''
  as $$
  select (1 + (select count(*) from public.bebe b
                where b.familia_id = a.familia_id))::integer
         - (select count(*) from public.relatorio_medico r
             where r.acompanhamento_id = a.id
               and r.status in ('em_revisao', 'aprovado', 'enviado', 'erro_envio'))::integer
  from public.acompanhamento a
  where a.id = p_acompanhamento_id
$$;
comment on function privado.evolucoes_faltando(uuid) is '[P41] Documentos da evolução que ainda não saíram do rascunho: um puerperal mais um neonatal por bebê, menos os que já estão em revisão, aprovados ou enviados. Sem grant.';

-- Data em que o atendimento foi concluído: a visita do último dia contratado, com registro.
create function privado.data_conclusao_atendimento(p_acompanhamento_id uuid) returns date
  language sql
  stable
  set search_path = ''
  as $$
  select max(vi.data)
  from public.acompanhamento a
  join public.visita vi on vi.acompanhamento_id = a.id and vi.dia_numero = a.dias_contratados
  join public.registro_atendimento r on r.visita_id = vi.id
  where a.id = p_acompanhamento_id
$$;
comment on function privado.data_conclusao_atendimento(uuid) is '[P41] Data da visita do último dia contratado que já tem registro assinado; nula se o atendimento ainda não terminou. Sem grant.';


-- =============================================================================
-- 3. Evolução (P41)
-- =============================================================================

alter table public.relatorio_medico
  add column edicao integer not null default 1,
  add column erros_validacao jsonb not null default '[]'::jsonb,
  add column erro_envio text,
  add column nota_revisao text;

comment on column public.relatorio_medico.edicao is '[P41] Número da edição, incrementado por gatilho a cada update. A tela manda a edição que leu (parâmetro p_versao_base) e o banco recusa se mudou (40001). Não é a versao de sincronização offline da regra 13 do PRD 6.10.';
comment on column public.relatorio_medico.erros_validacao is '[P41] Lista de textos com o que a validação do rascunho apontou (src/lib/pdf/validacoes). Só sem erro o documento vai para revisão e é aprovado. Frases sem dado pessoal.';
comment on column public.relatorio_medico.erro_envio is '[P41] Motivo curto da última falha de envio (sem dado pessoal), para a coordenação tentar de novo.';
comment on column public.relatorio_medico.nota_revisao is '[P41] Recado da coordenação ao devolver o rascunho para a enfermeira.';
comment on column public.relatorio_medico.conteudo is 'objeto {"dados": entrada validada do gerador, "conteudo": seções calculadas e textos editáveis}. Nunca vai para o log em claro (P05).';

create unique index relatorio_medico_unico
  on public.relatorio_medico (acompanhamento_id, tipo, coalesce(bebe_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.relatorio_medico
  add constraint relatorio_medico_bebe_por_tipo check ((tipo = 'neonatal') = (bebe_id is not null)),
  add constraint relatorio_medico_conteudo_forma
    check (pg_catalog.jsonb_typeof(conteudo) = 'object' and conteudo ? 'dados' and conteudo ? 'conteudo'),
  add constraint relatorio_medico_erros_forma check (pg_catalog.jsonb_typeof(erros_validacao) = 'array'),
  add constraint relatorio_medico_pdf_caminho
    check (pdf_path is null or pdf_path ~ '^evolucoes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'),
  add constraint relatorio_medico_aprovacao
    check (status not in ('aprovado', 'enviado', 'erro_envio')
           or (aprovado_em is not null and aprovado_por is not null and erros_validacao = '[]'::jsonb)),
  add constraint relatorio_medico_envio check (status <> 'enviado' or (enviado_em is not null and pdf_path is not null));

create trigger incrementar_edicao before update on public.relatorio_medico
  for each row execute function privado.incrementar_edicao();

-- --- Leitura auditada da base de um acompanhamento -------------------------------------
-- Tudo o que o gerador de evolução precisa: período, paciente, bebês, médicos,
-- profissional, os registros do checklist por visita, os textos padrão e o que já
-- foi feito. Grava 'leitura' antes de devolver (PRD 6.10 regra 6).
create function assistencial.ler_base_evolucao(p_acompanhamento_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_a       public.acompanhamento;
  v_f       public.familia;
  v_prof    public.profissional;
  v_mae     public.pessoa;
  v_visitas jsonb;
  v_bebes   jsonb;
  v_medicos jsonb;
  v_rel     jsonb;
  v_textos  jsonb;
  v_filiacao jsonb;
  v_rotulos jsonb;
  v_ini     date;
  v_fim     date;
begin
  v_a := privado.evolucao_acesso(p_acompanhamento_id, false);
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  perform privado.registrar_leitura('registro_atendimento', v_a.id::text,
    pg_catalog.jsonb_build_object('funcao', 'assistencial.ler_base_evolucao'));

  v_prof := privado.evolucao_profissional(v_a.id);
  select p.* into v_mae from public.pessoa p
   where p.familia_id = v_a.familia_id and p.papel = 'mae'
   order by p.contato_principal desc, p.criado_em, p.id limit 1;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'visita_id', vi.id, 'dia_numero', vi.dia_numero, 'data', vi.data,
           'profissional_id', vi.profissional_id, 'dados', r.dados) order by vi.dia_numero), '[]'::jsonb),
         min(vi.data), max(vi.data)
    into v_visitas, v_ini, v_fim
  from public.visita vi join public.registro_atendimento r on r.visita_id = vi.id
  where vi.acompanhamento_id = v_a.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', b.id, 'ordem', b.ordem, 'nome', b.nome, 'sexo', b.sexo, 'tipo_parto', b.tipo_parto,
           'data_nascimento', b.data_nascimento, 'peso_nascimento_g', b.peso_nascimento_g,
           'peso_alta_g', b.peso_alta_g) order by b.ordem), '[]'::jsonb)
    into v_bebes from public.bebe b where b.familia_id = v_a.familia_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', m.id, 'especialidade', m.especialidade, 'nome', m.nome,
           'tem_email', nullif(pg_catalog.btrim(coalesce(m.email, '')), '') is not null,
           'email_mascarado', privado.venda_email_mascarado(m.email),
           'tem_contato', coalesce(m.telefone_e164, m.email) is not null) order by m.criado_em), '[]'::jsonb)
    into v_medicos from public.medico m where m.familia_id = v_a.familia_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.btrim(p.nome) order by (p.papel = 'mae') desc, p.criado_em), '[]'::jsonb)
    into v_filiacao from public.pessoa p
   where p.familia_id = v_a.familia_id and p.papel in ('mae', 'parceiro');

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', r.id, 'tipo', r.tipo, 'bebe_id', r.bebe_id, 'status', r.status, 'versao', r.edicao,
           'enviado_em', r.enviado_em) order by r.criado_em), '[]'::jsonb)
    into v_rel from public.relatorio_medico r where r.acompanhamento_id = v_a.id;

  select coalesce(pg_catalog.jsonb_object_agg(m.chave, m.texto), '{}'::jsonb)
    into v_textos from public.mensagem_modelo m
   where m.destinatario = 'medico' and m.chave like 'evo\_%';

  -- rótulos dos campos de orientação (blocos 4 e 5 do DOC 2 vigente): a evolução neonatal lista
  -- as orientações feitas com as palavras do próprio instrumento, sem texto clínico no código
  select coalesce(pg_catalog.jsonb_object_agg((b.value ->> 'id') || '.' || (c.value ->> 'id'), c.value ->> 'rotulo'), '{}'::jsonb)
    into v_rotulos
  from public.instrumento i
  cross join lateral pg_catalog.jsonb_array_elements(i.definicao -> 'blocos') b
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(b.value -> 'campos', '[]'::jsonb)) c
  where i.codigo = 'DOC2_CHECKLIST' and i.vigente and (b.value ->> 'id') in ('4', '5')
    and (c.value ->> 'tipo') = 'sim_nao';

  return pg_catalog.jsonb_build_object(
    'acompanhamento', pg_catalog.jsonb_build_object(
      'id', v_a.id, 'familia_id', v_a.familia_id, 'estado', v_a.estado, 'dias_contratados', v_a.dias_contratados,
      'inicio', coalesce(v_a.inicio_efetivo, v_ini), 'fim', v_fim,
      'concluido_em', privado.data_conclusao_atendimento(v_a.id),
      'data_alta', v_f.data_alta, 'data_nascimento', v_f.data_nascimento),
    'hoje', privado.hoje_sp(),
    'funcoes', coalesce(privado.venda_parametro('profissional_funcoes'), '{}'::jsonb),
    'familia_nome', v_f.nome_exibicao,
    'paciente', case when v_mae.id is not null
                     then pg_catalog.jsonb_build_object('nome', v_mae.nome, 'idade', v_mae.idade) end,
    'filiacao', v_filiacao,
    'bebes', v_bebes,
    'medicos', v_medicos,
    'profissional', case when v_prof.id is not null then pg_catalog.jsonb_build_object(
      'id', v_prof.id, 'nome', v_prof.nome, 'funcao', v_prof.funcao, 'conselho', v_prof.conselho,
      'conselho_uf', v_prof.conselho_uf, 'conselho_numero', v_prof.conselho_numero) end,
    'visitas', v_visitas,
    'relatorios', v_rel,
    'textos', v_textos,
    'rotulos_orientacoes', v_rotulos);
end;
$$;
comment on function assistencial.ler_base_evolucao(uuid) is 'Leitura auditada da base da evolução de um acompanhamento (P41): período, paciente, bebês, médicos (e-mail só mascarado), profissional, registros do checklist por visita, textos padrão evo_* e os documentos já criados. Grava ''leitura'' antes de devolver. Coordenação e diretoria em todos, enfermeira nas famílias atribuídas. Sem grant.';

-- Lista de acompanhamentos com atendimento concluído e a situação dos documentos.
create function assistencial.ler_evolucoes(p_situacao text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_todas  boolean := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_hoje   date := privado.hoje_sp();
  v_prazos jsonb := coalesce(privado.venda_parametro('prazos_relatorio'), '{}'::jsonb);
  v_aviso  integer := coalesce((v_prazos ->> 'alerta_dias')::integer, 1);
  v_escala integer := coalesce((v_prazos ->> 'escala_coordenacao_dias')::integer, 2);
  v_itens  jsonb;
begin
  perform privado.registrar_leitura('relatorio_medico', '*',
    pg_catalog.jsonb_build_object('funcao', 'assistencial.ler_evolucoes', 'situacao', p_situacao));

  with base as (
    select a.id as acompanhamento_id, a.familia_id, f.nome_exibicao, privado.data_conclusao_atendimento(a.id) as concluido_em,
           (select vi.profissional_id from public.visita vi where vi.acompanhamento_id = a.id
             order by vi.dia_numero desc limit 1) as profissional_id
    from public.acompanhamento a
    join public.familia f on f.id = a.familia_id
    where privado.data_conclusao_atendimento(a.id) is not null
      and (v_todas or a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id)))
  ), docs as (
    select b.acompanhamento_id,
           pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'tipo', d.tipo, 'bebe_id', d.bebe_id, 'bebe_ordem', d.ordem, 'bebe_nome', d.bebe_nome,
             'relatorio_id', d.relatorio_id, 'status', d.status, 'enviado_em', d.enviado_em,
             'com_erros', d.com_erros) order by (d.tipo = 'neonatal'), d.ordem) as documentos,
           count(*) filter (where d.status is null or d.status = 'rascunho') as rascunhos,
           count(*) filter (where d.status is distinct from 'enviado') as nao_enviados
    from base b
    cross join lateral (
      select 'puerperal'::text as tipo, null::uuid as bebe_id, 0 as ordem, null::text as bebe_nome,
             r.id as relatorio_id, r.status::text as status, r.enviado_em,
             pg_catalog.jsonb_array_length(coalesce(r.erros_validacao, '[]'::jsonb)) > 0 as com_erros
        from (select 1) x
        left join public.relatorio_medico r on r.acompanhamento_id = b.acompanhamento_id and r.tipo = 'puerperal'
      union all
      select 'neonatal', be.id, be.ordem, be.nome, r.id, r.status::text, r.enviado_em,
             pg_catalog.jsonb_array_length(coalesce(r.erros_validacao, '[]'::jsonb)) > 0
        from public.bebe be
        left join public.relatorio_medico r on r.acompanhamento_id = b.acompanhamento_id and r.bebe_id = be.id
       where be.familia_id = b.familia_id
    ) d
    group by b.acompanhamento_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'acompanhamento_id', b.acompanhamento_id, 'familia_id', b.familia_id, 'familia_nome', b.nome_exibicao,
           'concluido_em', b.concluido_em,
           'prazo_aviso', privado.dias_uteis_apos(b.concluido_em, v_aviso),
           'prazo_escala', privado.dias_uteis_apos(b.concluido_em, v_escala),
           'situacao', case
                         when d.nao_enviados = 0 then 'concluida'
                         when d.rascunhos = 0 then 'em_andamento'
                         when v_hoje >= privado.dias_uteis_apos(b.concluido_em, v_escala) then 'escalada'
                         when v_hoje >= privado.dias_uteis_apos(b.concluido_em, v_aviso) then 'aviso'
                         else 'no_prazo' end,
           'bloqueado_contato', not exists (select 1 from public.medico m where m.familia_id = b.familia_id
                                              and coalesce(m.telefone_e164, m.email) is not null),
           'profissional_id', b.profissional_id,
           'profissional_nome', (select pr.nome from public.profissional pr where pr.id = b.profissional_id),
           'documentos', d.documentos)
           order by (d.nao_enviados = 0), b.concluido_em, b.acompanhamento_id), '[]'::jsonb)
    into v_itens
  from base b join docs d on d.acompanhamento_id = b.acompanhamento_id
  where p_situacao = 'todas' or d.nao_enviados > 0;

  return pg_catalog.jsonb_build_object('hoje', v_hoje, 'acompanhamentos', v_itens);
end;
$$;
comment on function assistencial.ler_evolucoes(text) is 'Leitura auditada dos acompanhamentos com atendimento concluído e a situação dos documentos da evolução (P41): concluída, em andamento, no prazo, no aviso (D+1) ou escalada (D+2), com os prazos de parametro.prazos_relatorio em dias úteis. abertas = ainda tem documento sem enviar; todas = todos. Enfermeira nas famílias atribuídas, coordenação e diretoria em todas. Sem grant.';

-- Um documento inteiro, com o conteúdo.
create function assistencial.ler_relatorio_medico(p_relatorio_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r public.relatorio_medico;
  v_a public.acompanhamento;
  v_f public.familia;
  v_prof public.profissional;
  v_bebe public.bebe;
  v_coord boolean := privado.tem_papel('coordenacao');
begin
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  v_a := privado.evolucao_acesso(v_r.acompanhamento_id, false);
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  select pr.* into v_prof from public.profissional pr where pr.id = v_r.profissional_id;
  select b.* into v_bebe from public.bebe b where b.id = v_r.bebe_id;
  perform privado.registrar_leitura('relatorio_medico', v_r.id::text,
    pg_catalog.jsonb_build_object('funcao', 'assistencial.ler_relatorio_medico'));

  return pg_catalog.jsonb_build_object(
    'id', v_r.id, 'acompanhamento_id', v_r.acompanhamento_id, 'familia_id', v_f.id, 'familia_nome', v_f.nome_exibicao,
    'tipo', v_r.tipo, 'bebe_id', v_r.bebe_id, 'bebe_ordem', v_bebe.ordem, 'bebe_nome', v_bebe.nome,
    'status', v_r.status, 'versao', v_r.edicao,
    'conteudo', v_r.conteudo, 'erros_validacao', v_r.erros_validacao, 'nota_revisao', v_r.nota_revisao,
    'profissional_id', v_r.profissional_id, 'profissional_nome', v_prof.nome,
    'aprovado_em', v_r.aprovado_em, 'enviado_em', v_r.enviado_em, 'destinatarios', v_r.destinatarios,
    'erro_envio', v_r.erro_envio, 'tem_pdf', v_r.pdf_path is not null,
    'pode_editar', v_r.status = 'rascunho'
                   or (v_coord and v_r.status = 'em_revisao'),
    'pode_enviar_revisao', v_r.status = 'rascunho' and v_r.erros_validacao = '[]'::jsonb,
    'pode_aprovar', v_coord and v_r.status = 'em_revisao' and v_r.erros_validacao = '[]'::jsonb,
    'pode_reenviar', v_coord and v_r.status = 'erro_envio');
end;
$$;
comment on function assistencial.ler_relatorio_medico(uuid) is 'Leitura auditada de um documento da evolução (P41) com o conteúdo, os erros de validação e o que a pessoa logada pode fazer com ele. Sem grant.';

-- --- Rascunho -----------------------------------------------------------------------------
create function assistencial.salvar_relatorio_medico(
  p_acompanhamento_id uuid,
  p_tipo              text,
  p_bebe_id           uuid,
  p_conteudo          jsonb,
  p_erros             jsonb,
  p_versao_base       integer,
  p_usuario           uuid
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_a    public.acompanhamento;
  v_tipo public.tipo_relatorio;
  v_prof public.profissional;
  v_rel  public.relatorio_medico;
  v_id   uuid;
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_coord boolean := privado.tem_papel('coordenacao');
begin
  v_a := privado.evolucao_acesso(p_acompanhamento_id, true);
  if p_tipo not in ('puerperal', 'neonatal') then
    perform privado.recusar('evolucao', 'tipo_invalido');
  end if;
  v_tipo := p_tipo::public.tipo_relatorio;
  if (v_tipo = 'neonatal') <> (p_bebe_id is not null) then
    perform privado.recusar('evolucao', 'bebe_por_tipo');
  end if;
  if p_bebe_id is not null
     and not exists (select 1 from public.bebe b where b.id = p_bebe_id and b.familia_id = v_a.familia_id) then
    perform privado.recusar('evolucao', 'bebe_de_outra_familia');
  end if;
  if pg_catalog.jsonb_typeof(p_conteudo) is distinct from 'object'
     or not (p_conteudo ? 'dados') or not (p_conteudo ? 'conteudo') then
    perform privado.recusar('evolucao', 'conteudo_invalido');
  end if;
  if pg_catalog.jsonb_typeof(p_erros) is distinct from 'array'
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_erros) e where pg_catalog.jsonb_typeof(e) <> 'string') then
    perform privado.recusar('evolucao', 'erros_invalidos');
  end if;
  if not exists (select 1 from public.medico m where m.familia_id = v_a.familia_id
                  and coalesce(m.telefone_e164, m.email) is not null) then
    perform privado.recusar('evolucao', 'contato_medico_pendente');
  end if;

  select r.* into v_rel from public.relatorio_medico r
   where r.acompanhamento_id = v_a.id and r.tipo = v_tipo
     and coalesce(r.bebe_id, v_zero) = coalesce(p_bebe_id, v_zero)
  for update;

  if found then
    if v_rel.status in ('aprovado', 'enviado', 'erro_envio') then
      perform privado.recusar('evolucao', 'ja_aprovada');
    end if;
    if v_rel.status = 'em_revisao' and not v_coord then
      perform privado.recusar('evolucao', 'em_revisao');
    end if;
    if p_versao_base is not null and v_rel.edicao <> p_versao_base then
      raise exception 'evolucao:versao_desatualizada o documento mudou (versão % e não %)', v_rel.edicao, p_versao_base
        using errcode = '40001';
    end if;
    update public.relatorio_medico r
       set conteudo = p_conteudo, erros_validacao = p_erros
     where r.id = v_rel.id;
    select r.edicao into v_rel.edicao from public.relatorio_medico r where r.id = v_rel.id;
    return pg_catalog.jsonb_build_object('id', v_rel.id, 'versao', v_rel.edicao, 'status', v_rel.status, 'criado', false);
  end if;

  v_prof := privado.evolucao_profissional(v_a.id);
  if v_prof.id is null then
    perform privado.recusar('evolucao', 'sem_profissional');
  end if;
  insert into public.relatorio_medico (acompanhamento_id, tipo, bebe_id, conteudo, erros_validacao, profissional_id, criado_por)
  values (v_a.id, v_tipo, p_bebe_id, p_conteudo, p_erros, v_prof.id, p_usuario)
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'versao', 1, 'status', 'rascunho', 'criado', true);
end;
$$;
comment on function assistencial.salvar_relatorio_medico(uuid, text, uuid, jsonb, jsonb, integer, uuid) is 'Cria ou atualiza o rascunho de um documento da evolução (P41). Um por acompanhamento, tipo e bebê. Recusa sem contato médico (7.3), documento aprovado ou enviado e, para a enfermeira, documento em revisão. Conflito de versão: 40001. Sem grant.';


-- --- Funções api da evolução --------------------------------------------------------------

create function api.base_evolucao(p_acompanhamento_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return assistencial.ler_base_evolucao(p_acompanhamento_id);
end;
$$;
comment on function api.base_evolucao(uuid) is '[P41] Base do acompanhamento para montar a evolução (período, paciente, bebês, médicos com o e-mail só mascarado, profissional, registros do checklist, textos padrão evo_*, documentos já criados). Grava a leitura no log. Enfermeira nas famílias atribuídas, coordenação e diretoria, AAL2.';

create function api.evolucoes(p_situacao text default 'abertas') returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if p_situacao not in ('abertas', 'todas') then
    perform privado.recusar('evolucao', 'situacao_invalida');
  end if;
  return assistencial.ler_evolucoes(p_situacao);
end;
$$;
comment on function api.evolucoes(text) is '[P41] Acompanhamentos com atendimento concluído e a situação dos documentos da evolução (no prazo, aviso em D+1, escalada em D+2, em andamento, concluída), com os documentos de cada um. Enfermeira nas famílias atribuídas, coordenação e diretoria, AAL2. Grava a leitura no log.';

create function api.evolucao(p_relatorio_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return assistencial.ler_relatorio_medico(p_relatorio_id);
end;
$$;
comment on function api.evolucao(uuid) is '[P41] Um documento da evolução com o conteúdo, os erros de validação e o que a pessoa logada pode fazer. Enfermeira nas famílias atribuídas, coordenação e diretoria, AAL2. Grava a leitura no log.';

create function api.salvar_evolucao(
  p_acompanhamento_id uuid,
  p_tipo              text,
  p_bebe_id           uuid,
  p_conteudo          jsonb,
  p_erros             jsonb,
  p_versao_base       integer default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return assistencial.salvar_relatorio_medico(p_acompanhamento_id, p_tipo, p_bebe_id, p_conteudo, p_erros,
                                              p_versao_base, auth.uid());
end;
$$;
comment on function api.salvar_evolucao(uuid, text, uuid, jsonb, jsonb, integer) is '[P41] Cria ou atualiza o rascunho de um documento da evolução (puerperal, ou neonatal de um bebê) com o conteúdo e os erros que a validação apontou. Enfermeira do acompanhamento ou coordenação, AAL2. Recusa sem contato médico, documento já aprovado e conflito de versão (40001).';

create function api.enviar_evolucao_para_revisao(p_relatorio_id uuid, p_versao_base integer default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r public.relatorio_medico;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id for update;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  perform privado.evolucao_acesso(v_r.acompanhamento_id, true);
  if v_r.status <> 'rascunho' then
    perform privado.recusar('evolucao', 'fora_do_rascunho');
  end if;
  if p_versao_base is not null and v_r.edicao <> p_versao_base then
    raise exception 'evolucao:versao_desatualizada o documento mudou' using errcode = '40001';
  end if;
  if v_r.erros_validacao <> '[]'::jsonb then
    perform privado.recusar('evolucao', 'com_erros');
  end if;

  update public.relatorio_medico r set status = 'em_revisao', nota_revisao = null where r.id = v_r.id;
  perform privado.venda_avisar('coordenacao', 'normal', 'Evolução de enfermagem aguardando aprovação', '/evolucoes');
  return pg_catalog.jsonb_build_object('id', v_r.id, 'status', 'em_revisao');
end;
$$;
comment on function api.enviar_evolucao_para_revisao(uuid, integer) is '[P41] A enfermeira entrega o rascunho para a coordenação aprovar. Só sem erro de validação; avisa a coordenação sem nome de paciente. Enfermeira do acompanhamento ou coordenação, AAL2.';

create function api.devolver_evolucao(p_relatorio_id uuid, p_motivo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r   public.relatorio_medico;
  v_uid uuid;
begin
  perform privado.autorizar(array['coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_motivo, ''))) < 5 then
    perform privado.recusar('evolucao', 'motivo_curto');
  end if;
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id for update;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  if v_r.status <> 'em_revisao' then
    perform privado.recusar('evolucao', 'fora_da_revisao');
  end if;
  update public.relatorio_medico r
     set status = 'rascunho', nota_revisao = pg_catalog.left(pg_catalog.btrim(p_motivo), 1000)
   where r.id = v_r.id;
  select pr.usuario_id into v_uid from public.profissional pr where pr.id = v_r.profissional_id;
  if v_uid is not null then
    insert into public.notificacao (usuario_id, prioridade, titulo, link, canais, criado_por)
    values (v_uid, 'normal', 'A coordenação devolveu uma evolução com um recado', '/minhas-evolucoes', '{app}', auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('id', v_r.id, 'status', 'rascunho');
end;
$$;
comment on function api.devolver_evolucao(uuid, text) is '[P41] A coordenação devolve o documento em revisão para o rascunho, com um recado de pelo menos 5 letras, e avisa a enfermeira (sem nome de paciente). Coordenação, AAL2.';

create function api.aprovar_evolucao(p_relatorio_id uuid, p_versao_base integer default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r     public.relatorio_medico;
  v_a     public.acompanhamento;
  v_espec public.especialidade_medico;
  v_dest  jsonb;
begin
  perform privado.autorizar(array['coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id for update;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_r.acompanhamento_id;
  if v_r.status <> 'em_revisao' then
    perform privado.recusar('evolucao', 'fora_da_revisao');
  end if;
  if p_versao_base is not null and v_r.edicao <> p_versao_base then
    raise exception 'evolucao:versao_desatualizada o documento mudou' using errcode = '40001';
  end if;
  if v_r.erros_validacao <> '[]'::jsonb then
    perform privado.recusar('evolucao', 'com_erros');
  end if;

  v_espec := case v_r.tipo when 'puerperal' then 'obstetra' else 'pediatra' end::public.especialidade_medico;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('especialidade', m.especialidade, 'medico_id', m.id)
                              order by m.criado_em)
    into v_dest
  from public.medico m
  where m.familia_id = v_a.familia_id and m.especialidade = v_espec
    and nullif(pg_catalog.btrim(coalesce(m.email, '')), '') is not null;
  if v_dest is null then
    perform privado.recusar('evolucao', 'sem_email_do_medico');
  end if;

  update public.relatorio_medico r
     set status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = pg_catalog.now(), destinatarios = v_dest
   where r.id = v_r.id;
  perform privado.venda_log('evolucao_aprovada', 'relatorio_medico', v_r.id::text, null,
    pg_catalog.jsonb_build_object('tipo', v_r.tipo));
  return pg_catalog.jsonb_build_object('id', v_r.id, 'status', 'aprovado');
end;
$$;
comment on function api.aprovar_evolucao(uuid, integer) is '[P41] A coordenação aprova o documento em revisão (PRD 9.5: Edilaine aprova). Exige validação sem erro e e-mail do obstetra (puerperal) ou do pediatra (neonatal); guarda os destinatários. Coordenação, AAL2.';

create function api.dados_envio_evolucao(p_relatorio_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r     public.relatorio_medico;
  v_a     public.acompanhamento;
  v_dest  jsonb;
  v_nomes jsonb;
begin
  perform privado.autorizar(array['coordenacao']::public.papel_usuario[], true);
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  if v_r.status not in ('aprovado', 'erro_envio') then
    perform privado.recusar('evolucao', 'nao_aprovada');
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_r.acompanhamento_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'medico_id', m.id, 'especialidade', m.especialidade, 'nome', m.nome, 'email', m.email) order by m.criado_em), '[]'::jsonb)
    into v_dest
  from public.medico m
  where m.id in (select (e ->> 'medico_id')::uuid from pg_catalog.jsonb_array_elements(v_r.destinatarios) e)
    and nullif(pg_catalog.btrim(coalesce(m.email, '')), '') is not null;

  select coalesce(pg_catalog.jsonb_agg(n), '[]'::jsonb) into v_nomes
  from (select p.nome as n from public.pessoa p where p.familia_id = v_a.familia_id
        union select b.nome from public.bebe b where b.familia_id = v_a.familia_id and b.nome is not null
        union select f.nome_exibicao from public.familia f where f.id = v_a.familia_id) t;

  perform privado.registrar_leitura('relatorio_medico', v_r.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.dados_envio_evolucao'));

  return pg_catalog.jsonb_build_object(
    'relatorio_id', v_r.id, 'tipo', v_r.tipo, 'status', v_r.status, 'conteudo', v_r.conteudo,
    'destinatarios', v_dest, 'nomes_proibidos', v_nomes,
    'config', coalesce(privado.venda_parametro('evolucao_email'), '{}'::jsonb),
    'textos', (select coalesce(pg_catalog.jsonb_object_agg(m.chave, m.texto), '{}'::jsonb)
                 from public.mensagem_modelo m where m.chave in ('email_evolucao_assunto', 'email_evolucao_corpo')));
end;
$$;
comment on function api.dados_envio_evolucao(uuid) is '[P41] O que o servidor precisa para enviar o documento aprovado por e-mail: conteúdo, médicos com e-mail, nomes que o assunto e o anexo nunca podem ter, o contato da coordenação e os textos do 23.5. Grava a leitura no log. Coordenação, AAL2.';

create function api.registrar_envio_evolucao(
  p_relatorio_id uuid,
  p_pdf_path     text,
  p_enviados     jsonb,
  p_erro         text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r   public.relatorio_medico;
  v_a   public.acompanhamento;
  v_f   public.familia;
begin
  perform privado.autorizar(array['coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id for update;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  if v_r.status not in ('aprovado', 'erro_envio') then
    perform privado.recusar('evolucao', 'nao_aprovada');
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_r.acompanhamento_id;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;

  if p_erro is not null then
    update public.relatorio_medico r
       set status = 'erro_envio', erro_envio = pg_catalog.left(pg_catalog.btrim(p_erro), 300)
     where r.id = v_r.id;
    return pg_catalog.jsonb_build_object('id', v_r.id, 'status', 'erro_envio');
  end if;

  if p_pdf_path is null or p_pdf_path <> 'evolucoes/' || v_r.id::text || '.pdf' then
    perform privado.recusar('evolucao', 'caminho_invalido');
  end if;
  if pg_catalog.jsonb_typeof(p_enviados) is distinct from 'array' or pg_catalog.jsonb_array_length(p_enviados) = 0 then
    perform privado.recusar('evolucao', 'sem_destinatario');
  end if;

  update public.relatorio_medico r
     set status = 'enviado', enviado_em = pg_catalog.now(), pdf_path = p_pdf_path,
         destinatarios = p_enviados, erro_envio = null
   where r.id = v_r.id;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (v_f.id, 'evolucao', 'Evolução de enfermagem enviada ao médico',
          pg_catalog.jsonb_build_object('relatorio_id', v_r.id, 'tipo', v_r.tipo), true, auth.uid());

  -- K-10: a evolução também vai para a família, como tarefa de envio manual.
  if not exists (select 1 from public.tarefa t
                  where t.familia_id = v_f.id and t.status in ('aberta', 'em_andamento')
                    and t.payload ->> 'acao' = 'evolucao_familia'
                    and t.payload ->> 'acompanhamento_id' = v_a.id::text) then
    declare
      v_tarefa uuid;
    begin
      v_tarefa := privado.venda_criar_tarefa(
        v_f.id, 'outro', 'Enviar a evolução de enfermagem para a família ' || v_f.nome_exibicao,
        null, 'normal', pg_catalog.now() + interval '1 day', 'evolucao_familia_envio', '{}'::jsonb,
        'operacional',
        pg_catalog.jsonb_build_object('acao', 'evolucao_familia', 'acompanhamento_id', v_a.id));
      if v_tarefa is not null then
        update public.tarefa t set papel_responsavel = 'coordenacao' where t.id = v_tarefa;
      end if;
    end;
  end if;

  perform privado.venda_log('evolucao_enviada', 'relatorio_medico', v_r.id::text, null,
    pg_catalog.jsonb_build_object('tipo', v_r.tipo));
  return pg_catalog.jsonb_build_object('id', v_r.id, 'status', 'enviado');
end;
$$;
comment on function api.registrar_envio_evolucao(uuid, text, jsonb, text) is '[P41] Registra o resultado do envio por e-mail: com erro, o documento vai para erro_envio (motivo curto, sem dado pessoal); sem erro, vai para enviado com o PDF arquivado em evolucoes/<id>.pdf, os destinatários e a hora, cria o evento restrito na ficha e, sem freio, a tarefa de envio manual à família (K-10). Coordenação, AAL2.';

create function api.pdf_evolucao(p_relatorio_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_r public.relatorio_medico;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  select r.* into v_r from public.relatorio_medico r where r.id = p_relatorio_id;
  if not found then
    perform privado.recusar('evolucao', 'inexistente');
  end if;
  perform privado.evolucao_acesso(v_r.acompanhamento_id, false);
  if v_r.pdf_path is null then
    perform privado.recusar('evolucao', 'sem_pdf');
  end if;
  perform privado.registrar_leitura('relatorio_medico', v_r.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.pdf_evolucao'));
  return pg_catalog.jsonb_build_object('pdf_path', v_r.pdf_path);
end;
$$;
comment on function api.pdf_evolucao(uuid) is '[P41] Caminho do PDF arquivado no storage privado (evolucoes/<id>.pdf); o servidor assina a URL curta. Grava a leitura no log. Enfermeira nas famílias atribuídas, coordenação e diretoria, AAL2.';

-- --- Prazo D+1 e D+2 (etapa do recálculo diário) ------------------------------------------
-- privado.recalculo_diario procura privado.recalculo_prazo_relatorio pelo nome (0011).
create function privado.recalculo_prazo_relatorio() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_rec    record;
  v_hoje   date := privado.hoje_sp();
  v_p      jsonb := coalesce(privado.venda_parametro('prazos_relatorio'), '{}'::jsonb);
  v_aviso  integer := coalesce((v_p ->> 'alerta_dias')::integer, 1);
  v_escala integer := coalesce((v_p ->> 'escala_coordenacao_dias')::integer, 2);
  v_avisos integer := 0;
  v_escalas integer := 0;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'prazo_relatorio'), false) then
    return pg_catalog.jsonb_build_object('ativa', false);
  end if;
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'cron', true);
  end if;

  for v_rec in
    select a.id as acompanhamento_id, a.familia_id, privado.data_conclusao_atendimento(a.id) as concluido_em,
           (select pr.usuario_id from public.visita vi join public.profissional pr on pr.id = vi.profissional_id
             where vi.acompanhamento_id = a.id order by vi.dia_numero desc limit 1) as usuario_id
    from public.acompanhamento a
    where a.estado not in ('interrompido_familia', 'interrompido_clinico')
      and privado.data_conclusao_atendimento(a.id) is not null
      and privado.evolucoes_faltando(a.id) > 0
  loop
    if v_hoje >= privado.dias_uteis_apos(v_rec.concluido_em, v_aviso)
       and not exists (select 1 from public.automacao_execucao e
                        where e.automacao_id = 'prazo_relatorio'
                          and e.payload ->> 'acompanhamento_id' = v_rec.acompanhamento_id::text
                          and e.payload ->> 'etapa' = 'aviso') then
      if v_rec.usuario_id is not null then
        insert into public.notificacao (usuario_id, prioridade, titulo, link, canais)
        values (v_rec.usuario_id, 'alta', 'A evolução de enfermagem já está no prazo de emissão', '/minhas-evolucoes', '{app,push}');
      end if;
      insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
      values ('prazo_relatorio', v_rec.familia_id, pg_catalog.now(), pg_catalog.now(), 'executada',
              pg_catalog.jsonb_build_object('acompanhamento_id', v_rec.acompanhamento_id, 'etapa', 'aviso'));
      v_avisos := v_avisos + 1;
    end if;

    if v_hoje >= privado.dias_uteis_apos(v_rec.concluido_em, v_escala)
       and not exists (select 1 from public.automacao_execucao e
                        where e.automacao_id = 'prazo_relatorio'
                          and e.payload ->> 'acompanhamento_id' = v_rec.acompanhamento_id::text
                          and e.payload ->> 'etapa' = 'escala') then
      perform privado.venda_avisar('coordenacao', 'alta', 'Evolução de enfermagem em atraso: chegou à coordenação', '/evolucoes');
      update public.tarefa t set prioridade = 'alta'
       where t.familia_id = v_rec.familia_id and t.tipo = 'emitir_evolucao' and t.status in ('aberta', 'em_andamento');
      insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
      values ('prazo_relatorio', v_rec.familia_id, pg_catalog.now(), pg_catalog.now(), 'executada',
              pg_catalog.jsonb_build_object('acompanhamento_id', v_rec.acompanhamento_id, 'etapa', 'escala'));
      v_escalas := v_escalas + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('avisos', v_avisos, 'escaladas', v_escalas);
end;
$$;
comment on function privado.recalculo_prazo_relatorio() is '[P41] Etapa prazo_relatorio do recálculo diário (PRD 9.5, 10.1): um dia útil depois do atendimento a enfermeira recebe o aviso (D+1) e, dois dias úteis depois, a coordenação (D+2), uma vez cada, enquanto faltar documento fora do rascunho. Prazos em parametro.prazos_relatorio; desligada com a automação prazo_relatorio. Sem grant.';

-- --- Fim do atendimento: tarefa da evolução e pós-venda ------------------------------------
-- O registro do último dia contratado, assinado, encerra o atendimento (PRD 7.3):
-- abre a tarefa de emitir a evolução (um dia útil, PRD 9.5) e o pipeline 4 (7.4).
create function privado.iniciar_pos_conclusao(p_acompanhamento_id uuid) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_a       public.acompanhamento;
  v_f       public.familia;
  v_concl   date;
  v_uid     uuid;
  v_exec    uuid;
  v_tarefa  uuid;
  v_horas   numeric := coalesce(privado.venda_numero('pesquisa', 'envio_prazo_horas'), 24);
  v_aviso   integer := coalesce(privado.venda_numero('prazos_relatorio', 'alerta_dias')::integer, 1);
  v_pv      uuid;
begin
  select a.* into v_a from public.acompanhamento a where a.id = p_acompanhamento_id;
  if not found then
    return;
  end if;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  v_concl := coalesce(privado.data_conclusao_atendimento(v_a.id), privado.hoje_sp());

  -- 1. a tarefa da enfermeira: emitir a evolução até um dia útil depois
  if not exists (select 1 from public.tarefa t
                  where t.familia_id = v_f.id and t.tipo = 'emitir_evolucao'
                    and t.payload ->> 'acompanhamento_id' = v_a.id::text) then
    v_exec := privado.venda_automacao_iniciar(v_f.id, 'prazo_relatorio',
      pg_catalog.jsonb_build_object('acompanhamento_id', v_a.id, 'etapa', 'tarefa'));
    if v_exec is not null then
      select pr.usuario_id into v_uid
      from public.visita vi join public.profissional pr on pr.id = vi.profissional_id
      where vi.acompanhamento_id = v_a.id order by vi.dia_numero desc limit 1;
      insert into public.tarefa (tipo, familia_id, responsavel_id, papel_responsavel, prioridade, titulo, payload, vence_em)
      values ('emitir_evolucao', v_f.id, v_uid, case when v_uid is null then 'enfermeira'::public.papel_usuario end,
              'normal', 'Emitir a evolução de enfermagem da ' || v_f.nome_exibicao,
              pg_catalog.jsonb_build_object('acao', 'emitir_evolucao', 'acompanhamento_id', v_a.id, 'categoria', 'interna'),
              (privado.dias_uteis_apos(v_concl, v_aviso) + time '23:59') at time zone 'America/Sao_Paulo');
      perform privado.venda_automacao_concluir(v_exec);
    end if;
  end if;

  -- 2. o pipeline 4 e a tarefa de envio da pesquisa (o freio decide se a tarefa nasce)
  insert into public.pos_venda (acompanhamento_id) values (v_a.id)
  on conflict (acompanhamento_id) do nothing
  returning id into v_pv;
  if v_pv is null then
    return;
  end if;
  v_exec := privado.venda_automacao_iniciar(v_f.id, 'pesquisa',
    pg_catalog.jsonb_build_object('acompanhamento_id', v_a.id, 'pos_venda_id', v_pv));
  if v_exec is not null then
    v_tarefa := privado.venda_criar_tarefa(
      v_f.id, 'enviar_pesquisa', 'Enviar a pesquisa para a ' || v_f.nome_exibicao,
      null, 'normal', pg_catalog.now() + pg_catalog.make_interval(hours => v_horas::integer),
      null, '{}'::jsonb, 'marketing',
      pg_catalog.jsonb_build_object('acao', 'pesquisa', 'pos_venda_id', v_pv));
    if v_tarefa is not null then
      update public.tarefa t set papel_responsavel = 'coordenacao' where t.id = v_tarefa;
    end if;
    perform privado.venda_automacao_concluir(v_exec);
  end if;
end;
$$;
comment on function privado.iniciar_pos_conclusao(uuid) is '[P41 e P42] Quando o atendimento termina: abre a tarefa emitir_evolucao da enfermeira (vence um dia útil depois) e o pós-venda do acompanhamento (PRD 7.4, uma linha só), com a tarefa enviar_pesquisa para a coordenação se o freio deixar (categoria marketing: só família em normal, e nunca em não contatar). Sem grant.';

create function privado.registro_concluiu_atendimento() returns trigger
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_acomp uuid;
begin
  select a.id into v_acomp
  from public.visita vi join public.acompanhamento a on a.id = vi.acompanhamento_id
  where vi.id = new.visita_id and vi.dia_numero = a.dias_contratados;
  if v_acomp is not null then
    perform privado.iniciar_pos_conclusao(v_acomp);
  end if;
  return new;
end;
$$;
comment on function privado.registro_concluiu_atendimento() is 'Gatilho AFTER INSERT de registro_atendimento (P41 e P42): o registro da visita do último dia contratado abre a tarefa da evolução e o pós-venda. Sem grant.';

create trigger registro_concluiu_atendimento
  after insert on public.registro_atendimento
  for each row execute function privado.registro_concluiu_atendimento();


-- =============================================================================
-- 4. Ocorrências (P42)
-- =============================================================================

alter table public.ocorrencia
  add column edicao integer not null default 1,
  add column resolvida_em timestamptz;

comment on column public.ocorrencia.edicao is '[P42] Número da edição, incrementado por gatilho a cada update. A tela manda a edição que leu (parâmetro p_versao_base) e o banco recusa se mudou (40001). Não é a versao de sincronização offline da regra 13 do PRD 6.10.';
comment on column public.ocorrencia.resolvida_em is '[P42] Quando passou a resolvida ou encerrada pela primeira vez.';

alter table public.ocorrencia
  add constraint ocorrencia_historico_forma check (pg_catalog.jsonb_typeof(historico) = 'array'),
  add constraint ocorrencia_titulo_tamanho check (pg_catalog.length(pg_catalog.btrim(titulo)) between 3 and 160),
  add constraint ocorrencia_descricao_tamanho check (pg_catalog.length(pg_catalog.btrim(descricao)) between 3 and 4000),
  add constraint ocorrencia_detrator_privada check (tipo <> 'detrator' or privada);

create trigger incrementar_edicao before update on public.ocorrencia
  for each row execute function privado.incrementar_edicao();

-- O gatilho do responsável (0007) compara a linha inteira menos status e histórico; a
-- coluna edicao muda em todo update, então entra na lista do que não conta.
create or replace function privado.ocorrencia_responsavel_so_status() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  -- dono (migrations, funções security definer) e service_role passam; a
  -- regra é para o usuário do app que não é coordenação nem diretoria.
  if current_user <> 'authenticated'
     or privado.tem_papel('coordenacao') or privado.tem_papel('diretoria') then
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - array['status', 'historico', 'atualizado_em', 'edicao'])
     is distinct from (pg_catalog.to_jsonb(old) - array['status', 'historico', 'atualizado_em', 'edicao']) then
    raise exception 'ocorrencia: o responsável altera só status e historico (ADR 0002)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function privado.ocorrencia_responsavel_so_status() is 'Gatilho BEFORE UPDATE de ocorrencia: usuário do app que não é coordenação nem diretoria (o responsável) só muda status e historico (ADR 0002). [0024] a coluna edicao (contador de conflito) não conta como mudança.';

-- Lista com o recorte do papel: coordenação e diretoria veem tudo; a enfermeira só
-- as não privadas em que é a responsável (PRD 13, 0007).
create function api.ocorrencias(p_situacao text default 'abertas', p_familia_id uuid default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_todas boolean := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_itens jsonb;
  v_resumo jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria', 'enfermeira']::public.papel_usuario[], true);
  if p_situacao not in ('abertas', 'fechadas', 'todas') then
    perform privado.recusar('ocorrencia', 'situacao_invalida');
  end if;

  with base as (
    select o.*, f.nome_exibicao, pr.nome as profissional_nome, pe.nome as responsavel_nome
    from public.ocorrencia o
    left join public.familia f on f.id = o.familia_id
    left join public.profissional pr on pr.id = o.profissional_id
    left join public.perfil pe on pe.id = o.responsavel_id
    where (v_todas or (not o.privada and o.responsavel_id = auth.uid()))
      and (p_familia_id is null or o.familia_id = p_familia_id)
      and (p_situacao = 'todas'
           or (p_situacao = 'abertas' and o.status not in ('resolvida', 'encerrada'))
           or (p_situacao = 'fechadas' and o.status in ('resolvida', 'encerrada')))
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', b.id, 'familia_id', b.familia_id, 'familia_nome', b.nome_exibicao,
           'profissional_id', b.profissional_id, 'profissional_nome', b.profissional_nome,
           'tipo', b.tipo, 'prioridade', b.prioridade, 'privada', b.privada, 'titulo', b.titulo,
           'status', b.status, 'responsavel_id', b.responsavel_id, 'responsavel_nome', b.responsavel_nome,
           'sla_vence_em', b.sla_vence_em,
           'vencida', b.sla_vence_em is not null and b.sla_vence_em < pg_catalog.now()
                      and b.status not in ('resolvida', 'encerrada'),
           'criado_em', b.criado_em, 'versao', b.edicao)
           order by (b.status in ('resolvida', 'encerrada')), (b.prioridade = 'maxima') desc,
                    (b.prioridade = 'alta') desc, b.sla_vence_em nulls last, b.criado_em desc), '[]'::jsonb),
         pg_catalog.jsonb_build_object(
           'abertas', count(*) filter (where b.status not in ('resolvida', 'encerrada')),
           'vencidas', count(*) filter (where b.sla_vence_em < pg_catalog.now() and b.status not in ('resolvida', 'encerrada')),
           'privadas', count(*) filter (where b.privada and b.status not in ('resolvida', 'encerrada')))
    into v_itens, v_resumo
  from (select * from base limit 300) b;

  return pg_catalog.jsonb_build_object('resumo', v_resumo, 'ocorrencias', v_itens);
end;
$$;
comment on function api.ocorrencias(text, uuid) is '[P42] Ocorrências abertas, fechadas ou todas, com o nome da família, o responsável e o SLA, e o resumo (abertas, vencidas, privadas). Coordenação e diretoria veem todas; a enfermeira só as não privadas em que é a responsável. No máximo 300 linhas. AAL2.';

create function api.ocorrencia(p_ocorrencia_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_todas boolean := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_o     public.ocorrencia;
  v_f     public.familia;
  v_pr    public.profissional;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria', 'enfermeira']::public.papel_usuario[], true);
  select o.* into v_o from public.ocorrencia o where o.id = p_ocorrencia_id;
  if not found or not (v_todas or (not v_o.privada and v_o.responsavel_id = auth.uid())) then
    perform privado.recusar('ocorrencia', 'inexistente');
  end if;
  select f.* into v_f from public.familia f where f.id = v_o.familia_id;
  select pr.* into v_pr from public.profissional pr where pr.id = v_o.profissional_id;
  return pg_catalog.jsonb_build_object(
    'id', v_o.id, 'familia_id', v_o.familia_id, 'familia_nome', v_f.nome_exibicao,
    'profissional_id', v_o.profissional_id, 'profissional_nome', v_pr.nome,
    'tipo', v_o.tipo, 'prioridade', v_o.prioridade, 'privada', v_o.privada, 'titulo', v_o.titulo,
    'descricao', v_o.descricao, 'status', v_o.status, 'responsavel_id', v_o.responsavel_id,
    'responsavel_nome', (select pe.nome from public.perfil pe where pe.id = v_o.responsavel_id),
    'sla_vence_em', v_o.sla_vence_em,
    'vencida', v_o.sla_vence_em is not null and v_o.sla_vence_em < pg_catalog.now()
               and v_o.status not in ('resolvida', 'encerrada'),
    'historico', v_o.historico, 'criado_em', v_o.criado_em, 'resolvida_em', v_o.resolvida_em, 'versao', v_o.edicao,
    'pode_gerir', v_todas);
end;
$$;
comment on function api.ocorrencia(uuid) is '[P42] Uma ocorrência com a descrição e o histórico. Coordenação e diretoria veem qualquer uma; a enfermeira só a não privada em que é a responsável. AAL2.';

create function api.responsaveis_ocorrencia() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'nome', t.nome) order by t.nome)
    from (select distinct p.id, p.nome
            from public.perfil p join public.usuario_papel up on up.usuario_id = p.id
           where p.ativo and up.papel in ('coordenacao', 'diretoria', 'enfermeira')) t), '[]'::jsonb);
end;
$$;
comment on function api.responsaveis_ocorrencia() is '[P42] Pessoas ativas que podem ser responsáveis por uma ocorrência (coordenação, diretoria e enfermeiras): id e nome. Coordenação e diretoria, AAL2.';

create function api.registrar_ocorrencia(
  p_familia_id      uuid,
  p_profissional_id uuid,
  p_tipo            text,
  p_prioridade      text,
  p_privada         boolean,
  p_titulo          text,
  p_descricao       text,
  p_responsavel_id  uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_tipo  public.tipo_ocorrencia;
  v_prior public.prioridade;
  v_horas numeric;
  v_id    uuid;
  v_privada boolean := coalesce(p_privada, false);
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if p_tipo not in ('intercorrencia', 'contato_perdido', 'registro_atrasado', 'capacidade', 'experiencia',
                    'reclamacao', 'detrator', 'outro') then
    perform privado.recusar('ocorrencia', 'tipo_invalido');
  end if;
  if p_prioridade not in ('normal', 'alta', 'maxima') then
    perform privado.recusar('ocorrencia', 'prioridade_invalida');
  end if;
  v_tipo := p_tipo::public.tipo_ocorrencia;
  v_prior := p_prioridade::public.prioridade;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_titulo, ''))) < 3 or pg_catalog.length(p_titulo) > 160 then
    perform privado.recusar('ocorrencia', 'titulo_invalido');
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_descricao, ''))) < 3 or pg_catalog.length(p_descricao) > 4000 then
    perform privado.recusar('ocorrencia', 'descricao_invalida');
  end if;
  if p_familia_id is not null and not exists (select 1 from public.familia f where f.id = p_familia_id) then
    perform privado.recusar('ocorrencia', 'familia_inexistente');
  end if;
  if p_profissional_id is not null and not exists (select 1 from public.profissional pr where pr.id = p_profissional_id) then
    perform privado.recusar('ocorrencia', 'profissional_inexistente');
  end if;
  if p_responsavel_id is not null
     and not exists (select 1 from public.perfil pe join public.usuario_papel up on up.usuario_id = pe.id
                      where pe.id = p_responsavel_id and pe.ativo
                        and up.papel in ('coordenacao', 'diretoria', 'enfermeira')) then
    perform privado.recusar('ocorrencia', 'responsavel_invalido');
  end if;
  -- PRD 7.4: nota baixa nunca vira ocorrência pública; o banco também impõe (constraint).
  if v_tipo = 'detrator' then
    v_privada := true;
  end if;

  v_horas := (privado.venda_parametro('ocorrencia_sla') -> p_prioridade ->> 'horas')::numeric;

  insert into public.ocorrencia (familia_id, profissional_id, tipo, prioridade, privada, titulo, descricao,
                                 responsavel_id, sla_vence_em, status, historico, criado_por)
  values (p_familia_id, p_profissional_id, v_tipo, v_prior, v_privada, pg_catalog.btrim(p_titulo),
          pg_catalog.btrim(p_descricao), p_responsavel_id,
          case when v_horas is not null then pg_catalog.now() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision) end,
          case when p_responsavel_id is not null then 'responsavel_definido'::public.status_ocorrencia
               else 'aberta'::public.status_ocorrencia end,
          pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'em', pg_catalog.now(), 'por', auth.uid(), 'acao', 'aberta',
            'para', case when p_responsavel_id is not null then 'responsavel_definido' else 'aberta' end)),
          auth.uid())
  returning id into v_id;

  if p_responsavel_id is not null then
    insert into public.notificacao (usuario_id, prioridade, titulo, link, canais, criado_por)
    values (p_responsavel_id, v_prior, 'Uma ocorrência foi entregue a você', '/ocorrencias/' || v_id::text, '{app}', auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('id', v_id, 'privada', v_privada);
end;
$$;
comment on function api.registrar_ocorrencia(uuid, uuid, text, text, boolean, text, text, uuid) is '[P42] Abre uma ocorrência com tipo, prioridade, privada, título, descrição e responsável opcional. SLA de parametro.ocorrencia_sla pela prioridade; detrator é sempre privada; histórico já nasce com a abertura. Coordenação e diretoria, AAL2.';

create function api.atualizar_ocorrencia(
  p_ocorrencia_id  uuid,
  p_status         text default null,
  p_responsavel_id uuid default null,
  p_prioridade     text default null,
  p_privada        boolean default null,
  p_nota           text default null,
  p_versao_base    integer default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_gestor boolean := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_o      public.ocorrencia;
  v_novo   public.status_ocorrencia;
  v_prior  public.prioridade;
  v_horas  numeric;
  v_nota   text := nullif(pg_catalog.btrim(coalesce(p_nota, '')), '');
  v_ordem  constant text[] := array['aberta', 'triagem', 'responsavel_definido', 'em_acompanhamento', 'resolvida', 'encerrada'];
  v_evento jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria', 'enfermeira']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select o.* into v_o from public.ocorrencia o where o.id = p_ocorrencia_id for update;
  if not found or not (v_gestor or (not v_o.privada and v_o.responsavel_id = auth.uid())) then
    perform privado.recusar('ocorrencia', 'inexistente');
  end if;
  if p_versao_base is not null and v_o.edicao <> p_versao_base then
    raise exception 'ocorrencia:versao_desatualizada a ocorrência mudou (versão % e não %)', v_o.edicao, p_versao_base
      using errcode = '40001';
  end if;
  -- quem é só o responsável muda o andamento e escreve no histórico, nada mais (ADR 0002)
  if not v_gestor and (p_responsavel_id is not null or p_prioridade is not null or p_privada is not null) then
    raise exception 'ocorrencia: o responsável altera só o status e o histórico (ADR 0002)' using errcode = '42501';
  end if;
  if v_o.status in ('encerrada') then
    perform privado.recusar('ocorrencia', 'encerrada');
  end if;

  if p_status is not null and p_status <> all (v_ordem) then
    perform privado.recusar('ocorrencia', 'status_invalido');
  end if;
  v_novo := coalesce(p_status, v_o.status::text)::public.status_ocorrencia;
  if p_status is not null and p_status <> v_o.status::text then
    -- só para frente, com uma volta: resolvida pode reabrir em acompanhamento
    if pg_catalog.array_position(v_ordem, p_status) < pg_catalog.array_position(v_ordem, v_o.status::text)
       and not (v_o.status = 'resolvida' and p_status = 'em_acompanhamento') then
      perform privado.recusar('ocorrencia', 'status_para_tras');
    end if;
    if p_status in ('resolvida', 'encerrada') and (v_nota is null or pg_catalog.length(v_nota) < 10) then
      perform privado.recusar('ocorrencia', 'resolucao_sem_nota');
    end if;
    if p_status in ('responsavel_definido', 'em_acompanhamento', 'resolvida', 'encerrada')
       and coalesce(p_responsavel_id, v_o.responsavel_id) is null then
      perform privado.recusar('ocorrencia', 'sem_responsavel');
    end if;
  end if;
  if p_responsavel_id is not null
     and not exists (select 1 from public.perfil pe join public.usuario_papel up on up.usuario_id = pe.id
                      where pe.id = p_responsavel_id and pe.ativo
                        and up.papel in ('coordenacao', 'diretoria', 'enfermeira')) then
    perform privado.recusar('ocorrencia', 'responsavel_invalido');
  end if;
  if p_prioridade is not null and p_prioridade not in ('normal', 'alta', 'maxima') then
    perform privado.recusar('ocorrencia', 'prioridade_invalida');
  end if;
  if p_privada is not null and not p_privada and v_o.tipo = 'detrator' then
    perform privado.recusar('ocorrencia', 'detrator_privada');
  end if;
  if v_nota is not null and pg_catalog.length(v_nota) > 2000 then
    perform privado.recusar('ocorrencia', 'nota_longa');
  end if;

  -- um passo de aberta para responsável definido acontece sozinho ao escolher a pessoa
  if p_responsavel_id is not null and p_status is null and v_o.status in ('aberta', 'triagem') then
    v_novo := 'responsavel_definido';
  end if;
  v_prior := coalesce(p_prioridade, v_o.prioridade::text)::public.prioridade;
  if p_prioridade is not null and p_prioridade <> v_o.prioridade::text then
    v_horas := (privado.venda_parametro('ocorrencia_sla') -> p_prioridade ->> 'horas')::numeric;
  end if;

  v_evento := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'em', pg_catalog.now(), 'por', auth.uid(), 'acao', 'atualizada',
    'de', case when v_novo <> v_o.status then v_o.status::text end,
    'para', case when v_novo <> v_o.status then v_novo::text end,
    'responsavel_id', p_responsavel_id,
    'prioridade', p_prioridade,
    'privada', p_privada,
    'nota', v_nota));

  update public.ocorrencia o
     set status = v_novo,
         responsavel_id = coalesce(p_responsavel_id, o.responsavel_id),
         prioridade = v_prior,
         privada = coalesce(p_privada, o.privada),
         sla_vence_em = case when v_horas is not null and v_novo not in ('resolvida', 'encerrada')
                             then o.criado_em + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision)
                             else o.sla_vence_em end,
         resolvida_em = case when v_novo in ('resolvida', 'encerrada') then coalesce(o.resolvida_em, pg_catalog.now())
                             else null end,
         historico = o.historico || pg_catalog.jsonb_build_array(v_evento)
   where o.id = v_o.id;

  if p_responsavel_id is not null and p_responsavel_id is distinct from v_o.responsavel_id then
    insert into public.notificacao (usuario_id, prioridade, titulo, link, canais, criado_por)
    values (p_responsavel_id, v_prior, 'Uma ocorrência foi entregue a você', '/ocorrencias/' || v_o.id::text, '{app}', auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('id', v_o.id, 'status', v_novo,
    'versao', (select o.edicao from public.ocorrencia o where o.id = v_o.id));
end;
$$;
comment on function api.atualizar_ocorrencia(uuid, text, uuid, text, boolean, text, integer) is '[P42] Muda o andamento de uma ocorrência (só para frente, com a volta de resolvida para em acompanhamento), o responsável, a prioridade (recalcula o SLA) e a marca de privada, sempre com uma linha no histórico. Resolver ou encerrar pede uma nota de pelo menos 10 letras e um responsável. O responsável que não é da coordenação muda só status e histórico. Conflito de versão: 40001. AAL2.';

-- SLA vencido: um aviso por ocorrência, uma vez, escrito no histórico.
create function privado.avisar_ocorrencias_vencidas() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_id uuid;
  v_n  integer := 0;
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'cron', true);
  end if;
  for v_id in
    select o.id from public.ocorrencia o
    where o.status not in ('resolvida', 'encerrada') and o.sla_vence_em < pg_catalog.now()
      and not exists (select 1 from pg_catalog.jsonb_array_elements(o.historico) h where h ->> 'acao' = 'sla_vencido')
    for update skip locked
  loop
    update public.ocorrencia o
       set historico = o.historico || pg_catalog.jsonb_build_array(
             pg_catalog.jsonb_build_object('em', pg_catalog.now(), 'acao', 'sla_vencido'))
     where o.id = v_id;
    perform privado.venda_avisar('coordenacao', 'alta', 'Uma ocorrência passou do prazo', '/ocorrencias/' || v_id::text);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function privado.avisar_ocorrencias_vencidas() is '[P42] pg_cron de hora em hora: para cada ocorrência aberta com o SLA vencido, uma linha ''sla_vencido'' no histórico e um aviso à coordenação (sem nome de família). Uma vez por ocorrência. Sem grant.';

select cron.schedule('ocorrencia_sla', '5 * * * *', 'select privado.avisar_ocorrencias_vencidas()');


-- =============================================================================
-- 5. Pesquisa nativa e pós-venda (P42, PRD 7.4)
-- =============================================================================

alter table public.pos_venda
  add column pesquisa_expira_em timestamptz,
  add column edicao integer not null default 1;

comment on column public.pos_venda.pesquisa_expira_em is '[P42] Validade do link da pesquisa (parametro.pesquisa.validade_dias a partir da geração). O token vale uma vez: só o sha256 fica em pesquisa_token_hash e a resposta apaga o hash.';
comment on column public.pos_venda.edicao is '[P42] Número da edição, incrementado por gatilho a cada update. Não é a versao de sincronização offline da regra 13.';

create trigger incrementar_edicao before update on public.pos_venda
  for each row execute function privado.incrementar_edicao();

create table privado.pesquisa_tentativa (
  id          bigserial primary key,
  criado_em   timestamptz not null default now(),
  origem_hmac text not null
);
comment on table privado.pesquisa_tentativa is '[P42] Tentativas com link inválido da pesquisa pública (PRD 21.3, limite de taxa): origem em HMAC-SHA256 do IP com a chave do Vault, nunca o IP. Janela e máximo em parametro.pesquisa. Linhas mais velhas que duas janelas são apagadas pela própria função. Sem grant.';
create index on privado.pesquisa_tentativa (origem_hmac, criado_em);
alter table privado.pesquisa_tentativa enable row level security;
revoke all on privado.pesquisa_tentativa from public, anon, authenticated, service_role;

create function privado.pesquisa_origem(p_origem text) returns text
  language sql
  stable
  set search_path = ''
  as $$ select privado.hmac_auditoria('pesquisa:' || coalesce(nullif(pg_catalog.btrim(p_origem), ''), 'sem-origem')) $$;
comment on function privado.pesquisa_origem(text) is '[P42] HMAC da origem (IP) da pesquisa pública com a chave do Vault; o IP nunca é gravado. Sem grant.';

create function privado.pesquisa_limite(p_origem_hmac text) returns boolean
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_max    numeric := privado.venda_numero('pesquisa', 'tentativas_max');
  v_janela numeric := privado.venda_numero('pesquisa', 'tentativas_janela_minutos');
begin
  if v_max is null or v_janela is null then
    return false;
  end if;
  delete from privado.pesquisa_tentativa t
   where t.criado_em < pg_catalog.now() - pg_catalog.make_interval(mins => (v_janela * 2)::integer);
  return (select count(*) from privado.pesquisa_tentativa t
           where t.origem_hmac = p_origem_hmac
             and t.criado_em >= pg_catalog.now() - pg_catalog.make_interval(mins => v_janela::integer)) >= v_max;
end;
$$;
comment on function privado.pesquisa_limite(text) is '[P42] Verdadeiro quando a origem já tem parametro.pesquisa.tentativas_max links inválidos nos últimos tentativas_janela_minutos. Sem parâmetro, sem limite. Sem grant.';

create function privado.pesquisa_textos(p_nome text) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.substr(m.chave, 10),
                    privado.aplicar_texto(m.texto, p_nome, '{}'::jsonb)), '{}'::jsonb)
  from public.mensagem_modelo m
  where m.chave like 'pesquisa\_%' and m.destinatario = 'familia' and m.canal = 'site'
$$;
comment on function privado.pesquisa_textos(text) is '[P42] Textos da pesquisa pública (mensagem_modelo com chave pesquisa_*, canal site), sem o prefixo e com o primeiro nome preenchido. Sem grant.';

create function privado.pesquisa_classificar(p_nps integer) returns public.classificacao_nps
  language sql
  stable
  set search_path = ''
  as $$
  select case
           when p_nps >= coalesce(privado.venda_numero('pesquisa', 'promotor_min'), 9) then 'promotor'
           when p_nps >= coalesce(privado.venda_numero('pesquisa', 'neutro_min'), 7) then 'neutro'
           else 'detrator'
         end::public.classificacao_nps
$$;
comment on function privado.pesquisa_classificar(integer) is '[P42] PRD 7.4: promotor de parametro.pesquisa.promotor_min (9) para cima, neutro de neutro_min (7) até o promotor, detrator abaixo. Sem grant.';

-- O freio para a pesquisa: nunca para família em qualquer estado sensível (categoria
-- marketing, PRD 8.2) nem em não contatar.
create function privado.pesquisa_bloqueio(p_familia_id uuid) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select case when f.nao_contatar then 'nao_contatar'
              when not privado.freio_permite('marketing', f.estado_sensivel) then 'freio' end
  from public.familia f where f.id = p_familia_id
$$;
comment on function privado.pesquisa_bloqueio(uuid) is '[P42] Nulo se a família pode receber a pesquisa; "freio" se está em atenção, bloqueio ou encerrado sensível; "nao_contatar" se pediu para não ser contatada. Sem grant.';

-- As ações do PRD 7.4 depois da classificação.
create function privado.pesquisa_agir(p_pos_venda_id uuid) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_pv    public.pos_venda;
  v_f     public.familia;
  v_exec  uuid;
  v_id    uuid;
  v_cfg   jsonb := coalesce(privado.venda_parametro('pesquisa'), '{}'::jsonb);
  v_dep   numeric := coalesce((v_cfg ->> 'depoimento_apos_dias')::numeric, 1);
  v_ind   numeric := coalesce((v_cfg ->> 'indicacao_apos_dias')::numeric, 7);
  v_escuta numeric := coalesce((v_cfg ->> 'escuta_prazo_dias')::numeric, 2);
  v_horas numeric;
begin
  select pv.* into v_pv from public.pos_venda pv where pv.id = p_pos_venda_id;
  select f.* into v_f from public.familia f
    join public.acompanhamento a on a.familia_id = f.id where a.id = v_pv.acompanhamento_id;

  v_exec := privado.venda_automacao_iniciar(v_f.id, 'classificacao_nps',
    pg_catalog.jsonb_build_object('pos_venda_id', v_pv.id, 'classificacao', v_pv.classificacao));
  if v_exec is null then
    return;
  end if;

  if v_pv.classificacao = 'promotor' then
    v_id := privado.venda_criar_tarefa(
      v_f.id, 'outro', 'Pedir o depoimento da ' || v_f.nome_exibicao, null, 'normal',
      pg_catalog.now() + pg_catalog.make_interval(days => v_dep::integer), 'promotor_depoimento', '{}'::jsonb, 'marketing',
      pg_catalog.jsonb_build_object('acao', 'depoimento', 'pos_venda_id', v_pv.id,
        'depoimento_autorizado', v_pv.depoimento_autorizado, 'autorizacao_imagem', v_pv.autorizacao_imagem));
    if v_id is not null then
      update public.tarefa t set papel_responsavel = 'coordenacao' where t.id = v_id;
    end if;
    v_id := privado.venda_criar_tarefa(
      v_f.id, 'outro', 'Convidar a ' || v_f.nome_exibicao || ' para indicar', null, 'normal',
      pg_catalog.now() + pg_catalog.make_interval(days => v_ind::integer), 'promotor_indicacao', '{}'::jsonb, 'marketing',
      pg_catalog.jsonb_build_object('acao', 'indicacao', 'pos_venda_id', v_pv.id));
    if v_id is not null then
      update public.tarefa t set papel_responsavel = 'coordenacao' where t.id = v_id;
    end if;
  elsif v_pv.classificacao = 'neutro' then
    v_id := privado.venda_criar_tarefa(
      v_f.id, 'escuta_neutro', 'Ouvir com calma a ' || v_f.nome_exibicao, null, 'normal',
      pg_catalog.now() + pg_catalog.make_interval(days => v_escuta::integer), null, '{}'::jsonb, 'operacional',
      pg_catalog.jsonb_build_object('acao', 'escuta', 'pos_venda_id', v_pv.id));
    if v_id is not null then
      update public.tarefa t set papel_responsavel = 'coordenacao' where t.id = v_id;
    end if;
  else
    -- PRD 7.4: detrator vira ocorrência privada, com aviso à coordenação. Nada de
    -- pedido de avaliação pública, nem tarefa de depoimento ou indicação.
    v_horas := (privado.venda_parametro('ocorrencia_sla') -> 'alta' ->> 'horas')::numeric;
    insert into public.ocorrencia (familia_id, tipo, prioridade, privada, titulo, descricao, sla_vence_em, historico)
    values (v_f.id, 'detrator', 'alta', true, 'Pesquisa de satisfação com nota baixa',
            'A família respondeu a pesquisa com nota ' || v_pv.nps::text || ' de 0 a 10. Contato pessoal da coordenação, sem pedido de avaliação pública.',
            case when v_horas is not null then pg_catalog.now() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision) end,
            pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
              'em', pg_catalog.now(), 'acao', 'aberta', 'para', 'aberta', 'origem', 'pesquisa')));
    perform privado.venda_avisar('coordenacao', 'alta',
      'Uma família respondeu a pesquisa com nota baixa: contato pessoal da coordenação', '/ocorrencias');
  end if;
  perform privado.venda_automacao_concluir(v_exec);
end;
$$;
comment on function privado.pesquisa_agir(uuid) is '[P42] Ações do PRD 7.4 depois da classificação (automação classificacao_nps): promotor recebe as tarefas de depoimento e de indicação em dias diferentes; neutro, a tarefa de escuta; detrator vira ocorrência privada de prioridade alta e aviso à coordenação, e nunca recebe pedido de avaliação pública. Sem grant.';

-- --- Pública: abrir e enviar (só o servidor, com o cliente de serviço) ---------------------
create function public.pesquisa_abrir(p_token text, p_origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_origem text := privado.pesquisa_origem(p_origem);
  v_pv     public.pos_venda;
  v_f      public.familia;
  v_nome   text;
  v_janela numeric := privado.venda_numero('pesquisa', 'tentativas_janela_minutos');
begin
  if privado.pesquisa_limite(v_origem) then
    return pg_catalog.jsonb_build_object('situacao', 'limite', 'minutos', v_janela,
      'textos', privado.pesquisa_textos(null));
  end if;
  select pv.* into v_pv from public.pos_venda pv
   where p_token is not null and pg_catalog.length(p_token) between 20 and 100
     and pv.pesquisa_token_hash = privado.formulario_hash(p_token)
     and pv.pesquisa_expira_em > pg_catalog.now()
     and pv.estagio = 'pesquisa_enviada';
  if not found then
    insert into privado.pesquisa_tentativa (origem_hmac) values (v_origem);
    return pg_catalog.jsonb_build_object('situacao', 'invalido', 'textos', privado.pesquisa_textos(null));
  end if;
  select f.* into v_f from public.familia f join public.acompanhamento a on a.familia_id = f.id
   where a.id = v_pv.acompanhamento_id;
  -- Freio: a família em qualquer estado sensível ou em não contatar não recebe pesquisa. A
  -- resposta é a mesma do link inválido, e não conta como tentativa recusada.
  if privado.pesquisa_bloqueio(v_f.id) is not null then
    return pg_catalog.jsonb_build_object('situacao', 'invalido', 'textos', privado.pesquisa_textos(null));
  end if;
  v_nome := privado.venda_primeiro_nome((privado.venda_contato(v_f.id)).nome);
  return pg_catalog.jsonb_build_object(
    'situacao', 'valido', 'nome', v_nome,
    'perguntas', coalesce(privado.venda_parametro('pesquisa_perguntas'), '[]'::jsonb),
    'textos', privado.pesquisa_textos(v_nome));
end;
$$;
comment on function public.pesquisa_abrir(text, text) is '[P42] Abre a pesquisa pública: token de uso único (só o sha256 no banco), dentro da validade e da fase pesquisa_enviada, limite de tentativas por origem (HMAC do IP), freio (família em estado sensível ou não contatar recebe a resposta de link inválido). Devolve o primeiro nome, as perguntas de parametro.pesquisa_perguntas e os textos aprovados; nada mais da família. Só service_role.';

create function public.pesquisa_enviar(p_token text, p_respostas jsonb, p_origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_origem text := privado.pesquisa_origem(p_origem);
  v_pv     public.pos_venda;
  v_f      public.familia;
  v_perg   jsonb := coalesce(privado.venda_parametro('pesquisa_perguntas'), '[]'::jsonb);
  v_p      jsonb;
  v_val    jsonb;
  v_id     text;
  v_tipo   text;
  v_obrig  boolean;
  v_erros  jsonb := '{}'::jsonb;
  v_limpo  jsonb := '{}'::jsonb;
  v_nps    integer;
  v_dep    boolean;
  v_img    boolean;
  v_class  public.classificacao_nps;
begin
  if privado.pesquisa_limite(v_origem) then
    return pg_catalog.jsonb_build_object('situacao', 'limite',
      'minutos', privado.venda_numero('pesquisa', 'tentativas_janela_minutos'));
  end if;
  select pv.* into v_pv from public.pos_venda pv
   where p_token is not null and pg_catalog.length(p_token) between 20 and 100
     and pv.pesquisa_token_hash = privado.formulario_hash(p_token)
     and pv.pesquisa_expira_em > pg_catalog.now()
     and pv.estagio = 'pesquisa_enviada'
  for update;
  if not found then
    insert into privado.pesquisa_tentativa (origem_hmac) values (v_origem);
    return pg_catalog.jsonb_build_object('situacao', 'invalido');
  end if;
  select f.* into v_f from public.familia f join public.acompanhamento a on a.familia_id = f.id
   where a.id = v_pv.acompanhamento_id;
  if privado.pesquisa_bloqueio(v_f.id) is not null then
    return pg_catalog.jsonb_build_object('situacao', 'invalido');
  end if;
  if pg_catalog.jsonb_typeof(p_respostas) is distinct from 'object' then
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', '{"respostas":"obrigatorio"}'::jsonb);
  end if;

  -- validação pelas perguntas cadastradas; chave desconhecida é descartada
  for v_p in select e.value from pg_catalog.jsonb_array_elements(v_perg) e loop
    v_id := v_p ->> 'id';
    v_tipo := v_p ->> 'tipo';
    v_obrig := coalesce((v_p ->> 'obrigatoria')::boolean, false);
    v_val := p_respostas -> v_id;
    if v_val is null or pg_catalog.jsonb_typeof(v_val) = 'null'
       or (pg_catalog.jsonb_typeof(v_val) = 'string' and pg_catalog.btrim(v_val #>> '{}') = '') then
      if v_obrig then
        v_erros := v_erros || pg_catalog.jsonb_build_object(v_id, 'obrigatorio');
      end if;
      continue;
    end if;
    if v_tipo = 'escala_0_10' then
      if pg_catalog.jsonb_typeof(v_val) = 'number' and (v_val #>> '{}') ~ '^(10|[0-9])$' then
        v_limpo := v_limpo || pg_catalog.jsonb_build_object(v_id, v_val);
        if v_id = 'nps' then v_nps := (v_val #>> '{}')::integer; end if;
      else
        v_erros := v_erros || pg_catalog.jsonb_build_object(v_id, 'invalido');
      end if;
    elsif v_tipo = 'sim_nao' then
      if pg_catalog.jsonb_typeof(v_val) = 'boolean' then
        v_limpo := v_limpo || pg_catalog.jsonb_build_object(v_id, v_val);
        if v_id = 'depoimento_autorizado' then v_dep := (v_val #>> '{}')::boolean; end if;
        if v_id = 'autorizacao_imagem' then v_img := (v_val #>> '{}')::boolean; end if;
      else
        v_erros := v_erros || pg_catalog.jsonb_build_object(v_id, 'invalido');
      end if;
    elsif v_tipo = 'opcao' then
      if pg_catalog.jsonb_typeof(v_val) = 'string'
         and exists (select 1 from pg_catalog.jsonb_array_elements(v_p -> 'opcoes') o where o.value ->> 'valor' = v_val #>> '{}') then
        v_limpo := v_limpo || pg_catalog.jsonb_build_object(v_id, v_val);
      else
        v_erros := v_erros || pg_catalog.jsonb_build_object(v_id, 'invalido');
      end if;
    elsif v_tipo = 'texto' then
      if pg_catalog.jsonb_typeof(v_val) = 'string' and pg_catalog.length(v_val #>> '{}') <= 2000 then
        v_limpo := v_limpo || pg_catalog.jsonb_build_object(v_id, pg_catalog.to_jsonb(pg_catalog.btrim(v_val #>> '{}')));
      else
        v_erros := v_erros || pg_catalog.jsonb_build_object(v_id, 'invalido');
      end if;
    end if;
  end loop;
  if v_erros <> '{}'::jsonb then
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', v_erros);
  end if;
  if v_nps is null then
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', '{"nps":"obrigatorio"}'::jsonb);
  end if;

  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'formulario', true);
  end if;
  v_class := privado.pesquisa_classificar(v_nps);

  update public.pos_venda pv
     set respostas = v_limpo, nps = v_nps, classificacao = v_class,
         depoimento_autorizado = v_dep, autorizacao_imagem = v_img,
         pesquisa_respondida_em = pg_catalog.now(), pesquisa_token_hash = null
   where pv.id = v_pv.id;
  perform privado.transicionar('p4', v_pv.id, 'pesquisa_respondida', 'Pesquisa respondida');
  perform privado.transicionar('p4', v_pv.id, 'classificado', 'NPS classificado');
  perform privado.pesquisa_agir(v_pv.id);
  return pg_catalog.jsonb_build_object('situacao', 'recebido');
end;
$$;
comment on function public.pesquisa_enviar(text, jsonb, text) is '[P42] Recebe a pesquisa pública: token válido e de uso único, freio, validação de cada resposta pelas perguntas cadastradas (a nota de 0 a 10 e as duas autorizações são obrigatórias). Grava as respostas, classifica o NPS (promotor, neutro, detrator), anda o pipeline 4 até classificado, executa as ações do 7.4 e apaga o hash do token. Devolve limite, invalido, corrigir (com os campos, nunca os valores) ou recebido. Só service_role.';

-- --- Funções api do pós-venda --------------------------------------------------------------
create function api.pos_vendas(p_situacao text default 'abertos') returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_itens  jsonb;
  v_resumo jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if p_situacao not in ('abertos', 'todos') then
    perform privado.recusar('pesquisa', 'situacao_invalida');
  end if;

  with base as (
    select pv.*, f.id as familia_id, f.nome_exibicao, privado.pesquisa_bloqueio(f.id) as bloqueio
    from public.pos_venda pv
    join public.acompanhamento a on a.id = pv.acompanhamento_id
    join public.familia f on f.id = a.familia_id
    where p_situacao = 'todos' or pv.estagio <> 'arquivado'
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', b.id, 'acompanhamento_id', b.acompanhamento_id, 'familia_id', b.familia_id,
           'familia_nome', b.nome_exibicao, 'estagio', b.estagio, 'nps', b.nps, 'classificacao', b.classificacao,
           'depoimento_autorizado', b.depoimento_autorizado, 'autorizacao_imagem', b.autorizacao_imagem,
           'pesquisa_enviada_em', b.pesquisa_enviada_em, 'pesquisa_respondida_em', b.pesquisa_respondida_em,
           'pesquisa_expira_em', b.pesquisa_expira_em,
           'link_ativo', b.pesquisa_token_hash is not null and b.pesquisa_expira_em > pg_catalog.now(),
           'bloqueio', b.bloqueio,
           'pode_gerar_link', b.bloqueio is null and b.estagio in ('protocolo_ultimo_dia_concluido', 'pesquisa_enviada'),
           'acao_executada_em', b.acao_executada_em, 'criado_em', b.criado_em)
           order by (b.estagio = 'arquivado'), b.criado_em desc), '[]'::jsonb),
         pg_catalog.jsonb_build_object(
           'aguardando_envio', count(*) filter (where b.estagio = 'protocolo_ultimo_dia_concluido'),
           'aguardando_resposta', count(*) filter (where b.estagio = 'pesquisa_enviada'),
           'respondidas', count(*) filter (where b.nps is not null),
           'promotores', count(*) filter (where b.classificacao = 'promotor'),
           'neutros', count(*) filter (where b.classificacao = 'neutro'),
           'detratores', count(*) filter (where b.classificacao = 'detrator'),
           'nps', case when count(*) filter (where b.nps is not null) = 0 then null
                       else pg_catalog.round(100.0 * (count(*) filter (where b.classificacao = 'promotor')
                                                     - count(*) filter (where b.classificacao = 'detrator'))
                                              / count(*) filter (where b.nps is not null)) end)
    into v_itens, v_resumo
  from base b;

  return pg_catalog.jsonb_build_object('resumo', v_resumo, 'itens', v_itens);
end;
$$;
comment on function api.pos_vendas(text) is '[P42] Pipeline 4: cada acompanhamento com o estágio, a nota, a classificação, as autorizações, se o link está ativo e se o freio deixa gerar o link; e o resumo (aguardando envio, aguardando resposta, respondidas, promotores, neutros, detratores e o NPS em pontos). Coordenação e diretoria, AAL2.';

create function api.gerar_link_pesquisa(p_pos_venda_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_pv     public.pos_venda;
  v_f      public.familia;
  v_dias   numeric := coalesce(privado.venda_numero('pesquisa', 'validade_dias'), 30);
  v_exec   uuid;
  v_token  text;
  v_expira timestamptz;
  v_nome   text;
  v_texto  text;
  v_bloq   text;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select pv.* into v_pv from public.pos_venda pv where pv.id = p_pos_venda_id for update;
  if not found then
    perform privado.recusar('pesquisa', 'inexistente');
  end if;
  if v_pv.estagio not in ('protocolo_ultimo_dia_concluido', 'pesquisa_enviada') then
    perform privado.recusar('pesquisa', 'fora_da_fase');
  end if;
  select f.* into v_f from public.familia f join public.acompanhamento a on a.familia_id = f.id
   where a.id = v_pv.acompanhamento_id;
  v_bloq := privado.pesquisa_bloqueio(v_f.id);
  if v_bloq = 'nao_contatar' then
    perform privado.recusar('pesquisa', 'nao_contatar');
  end if;
  if not coalesce((select a.ativa from public.automacao a where a.id = 'pesquisa'), false) then
    perform privado.recusar('pesquisa', 'automacao_desligada');
  end if;
  -- o freio de novo, no instante de gerar o link (invariante 3): fica registrado se abortar
  v_exec := privado.venda_automacao_iniciar(v_f.id, 'pesquisa',
    pg_catalog.jsonb_build_object('pos_venda_id', v_pv.id, 'etapa', 'link'));
  if v_exec is null then
    -- devolve em vez de levantar erro: o aborto do freio fica registrado (uma exceção o desfaria)
    return pg_catalog.jsonb_build_object('bloqueado', true, 'motivo', 'familia_em_estado_sensivel');
  end if;
  perform privado.venda_automacao_concluir(v_exec);

  v_token := pg_catalog.rtrim(pg_catalog.translate(
               pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_expira := pg_catalog.now() + pg_catalog.make_interval(days => v_dias::integer);
  update public.pos_venda pv
     set pesquisa_token_hash = privado.formulario_hash(v_token), pesquisa_expira_em = v_expira
   where pv.id = v_pv.id;

  v_nome := privado.venda_primeiro_nome((privado.venda_contato(v_f.id)).nome);
  select privado.aplicar_texto(m.texto, v_nome, pg_catalog.jsonb_build_object('link', '@@LINK@@'))
    into v_texto from public.mensagem_modelo m where m.chave = 'pesquisa_convite';

  perform privado.venda_log('pesquisa_link_gerado', 'pos_venda', v_pv.id::text, null,
    pg_catalog.jsonb_build_object('expira_em', v_expira));
  return pg_catalog.jsonb_build_object('token', v_token, 'expira_em', v_expira, 'texto', v_texto);
end;
$$;
comment on function api.gerar_link_pesquisa(uuid) is '[P42] Gera o link da pesquisa (token de 32 bytes, só o sha256 no banco, validade de parametro.pesquisa.validade_dias) e devolve o texto pesquisa_convite com @@LINK@@ no lugar do link. Passa pelo freio no instante de gerar: família em não contatar recusa com erro; em estado sensível devolve bloqueado=true e o aborto fica registrado em automacao_execucao. Invalida o link anterior. O token volta uma vez e nunca é gravado nem logado. Coordenação e diretoria, AAL2.';

create function api.marcar_pesquisa_enviada(p_pos_venda_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_pv public.pos_venda;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select pv.* into v_pv from public.pos_venda pv where pv.id = p_pos_venda_id for update;
  if not found then
    perform privado.recusar('pesquisa', 'inexistente');
  end if;
  if v_pv.estagio = 'pesquisa_enviada' then
    return pg_catalog.jsonb_build_object('id', v_pv.id, 'estagio', 'pesquisa_enviada', 'mudou', false);
  end if;
  if v_pv.estagio <> 'protocolo_ultimo_dia_concluido' or v_pv.pesquisa_token_hash is null
     or v_pv.pesquisa_expira_em <= pg_catalog.now() then
    perform privado.recusar('pesquisa', 'sem_link');
  end if;
  update public.pos_venda pv set pesquisa_enviada_em = pg_catalog.now() where pv.id = v_pv.id;
  perform privado.transicionar('p4', v_pv.id, 'pesquisa_enviada', 'Link da pesquisa enviado à família');
  update public.tarefa t
     set status = 'concluida', concluida_em = pg_catalog.now(), concluida_por = auth.uid()
   where t.tipo = 'enviar_pesquisa' and t.status in ('aberta', 'em_andamento')
     and t.payload ->> 'pos_venda_id' = v_pv.id::text;
  return pg_catalog.jsonb_build_object('id', v_pv.id, 'estagio', 'pesquisa_enviada', 'mudou', true);
end;
$$;
comment on function api.marcar_pesquisa_enviada(uuid) is '[P42] A pessoa avisa que mandou o link à família: anda o pipeline 4 para pesquisa_enviada, guarda a hora e conclui a tarefa enviar_pesquisa. Exige um link gerado e dentro da validade. Idempotente. Coordenação e diretoria, AAL2.';

create function api.avancar_pos_venda(p_pos_venda_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_pv public.pos_venda;
  v_para text;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select pv.* into v_pv from public.pos_venda pv where pv.id = p_pos_venda_id for update;
  if not found then
    perform privado.recusar('pesquisa', 'inexistente');
  end if;
  v_para := case v_pv.estagio when 'classificado' then 'acao_executada' when 'acao_executada' then 'arquivado' end;
  if v_para is null then
    perform privado.recusar('pesquisa', 'sem_proximo_passo');
  end if;
  perform privado.transicionar('p4', v_pv.id, v_para, case v_para
    when 'acao_executada' then 'Ação do pós-venda feita' else 'Pós-venda arquivado' end);
  if v_para = 'acao_executada' then
    update public.pos_venda pv set acao_executada_em = pg_catalog.now() where pv.id = v_pv.id;
  end if;
  return pg_catalog.jsonb_build_object('id', v_pv.id, 'estagio', v_para);
end;
$$;
comment on function api.avancar_pos_venda(uuid) is '[P42] Anda o pipeline 4 um passo: classificado para acao_executada (guarda a hora) e acao_executada para arquivado. Coordenação e diretoria, AAL2.';


-- =============================================================================
-- 6. Nota fiscal de serviço (P43, PRD 14, 6.3)
-- =============================================================================

alter table public.nota_fiscal
  add column tentativas integer not null default 0,
  add column ultima_tentativa_em timestamptz,
  add column manual boolean not null default false,
  add column edicao integer not null default 1;

comment on column public.nota_fiscal.tentativas is '[P43] Quantas vezes a emissão foi pedida ao provedor.';
comment on column public.nota_fiscal.ultima_tentativa_em is '[P43] Início da última tentativa; uma tentativa em processamento há mais de dez minutos pode ser refeita.';
comment on column public.nota_fiscal.manual is '[P43] Verdadeiro quando a nota foi emitida à mão no portal do provedor e registrada aqui (emissão manual assistida, T-05).';

alter table public.nota_fiscal
  add constraint nota_fiscal_emitida_completa check (status <> 'emitida' or (numero is not null and emitida_em is not null)),
  add constraint nota_fiscal_erro_com_motivo check (status <> 'erro' or erro is not null),
  add constraint nota_fiscal_pdf_caminho
    check (pdf_path is null or pdf_path ~ '^notas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'),
  add constraint nota_fiscal_xml_caminho
    check (xml_path is null or xml_path ~ '^notas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.xml$');

create trigger incrementar_edicao before update on public.nota_fiscal
  for each row execute function privado.incrementar_edicao();

-- Os dados da nota: o tomador é quem paga (C-10), o serviço vem do cadastro (parametro).
-- Grava a leitura do CPF (pessoa_dados_contrato) no log.
create function privado.nota_montar(p_nota_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_n    public.nota_fiscal;
  v_c    public.cobranca;
  v_k    public.contrato;
  v_p    public.pessoa;
  v_d    public.pessoa_dados_contrato;
  v_srv  jsonb := privado.venda_parametro('nfse_servico');
  v_end  jsonb;
  v_ibge integer;
  v_cpf  text;
begin
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  select c.* into v_c from public.cobranca c where c.id = v_n.cobranca_id;
  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  if v_c.status <> 'paga' then
    perform privado.recusar('nota', 'cobranca_nao_paga');
  end if;
  if v_srv is null or nullif(pg_catalog.btrim(coalesce(v_srv ->> 'codigo', '')), '') is null
     or nullif(pg_catalog.btrim(coalesce(v_srv ->> 'descricao', '')), '') is null then
    perform privado.recusar('nota', 'servico_sem_cadastro');
  end if;

  select p.* into v_p from public.pessoa p where p.id = coalesce(v_k.pagador_pessoa_id, v_k.contratante_pessoa_id);
  select d.* into v_d from public.pessoa_dados_contrato d where d.pessoa_id = v_p.id;
  v_cpf := pg_catalog.regexp_replace(coalesce(v_d.cpf, ''), '[^0-9]', '', 'g');
  if pg_catalog.length(v_cpf) <> 11 then
    perform privado.recusar('nota', 'tomador_sem_cpf');
  end if;
  perform privado.registrar_leitura('pessoa_dados_contrato', v_p.id::text,
    pg_catalog.jsonb_build_object('funcao', 'privado.nota_montar', 'completo', true));

  v_end := v_d.endereco_residencial;
  if pg_catalog.jsonb_typeof(v_end) = 'object' then
    select m.codigo_ibge into v_ibge from public.municipio m
     where privado.sem_acento(pg_catalog.lower(m.nome)) = privado.sem_acento(pg_catalog.lower(coalesce(v_end ->> 'cidade', '')))
       and m.uf = pg_catalog.upper(coalesce(v_end ->> 'uf', ''))
     limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'nota_id', v_n.id, 'cobranca_id', v_c.id, 'familia_id', v_k.familia_id, 'status', v_n.status,
    'valor_centavos', v_c.valor_centavos,
    'codigo_servico', v_srv ->> 'codigo', 'descricao_servico', v_srv ->> 'descricao',
    'tomador', pg_catalog.jsonb_build_object(
      'nome', v_p.nome, 'cpf', v_cpf, 'email', v_p.email,
      'endereco', case when pg_catalog.jsonb_typeof(v_end) = 'object' and v_ibge is not null
                       then pg_catalog.jsonb_build_object(
                         'logradouro', v_end ->> 'logradouro', 'numero', v_end ->> 'numero',
                         'bairro', v_end ->> 'bairro', 'cep', v_end ->> 'cep',
                         'uf', v_end ->> 'uf', 'municipio_codigo_ibge', v_ibge::text) end));
end;
$$;
comment on function privado.nota_montar(uuid) is '[P43] Dados para emitir a nota: valor da cobrança, código e descrição do serviço (parametro.nfse_servico) e o tomador, que é quem paga (C-10), com CPF e endereço completos. Só de cobrança paga. Grava a leitura do CPF no log. Sem grant.';

create function privado.nota_iniciar(p_nota_id uuid) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n public.nota_fiscal;
begin
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id for update;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  if v_n.status = 'emitida' then
    perform privado.recusar('nota', 'ja_emitida');
  end if;
  if v_n.status = 'cancelada' then
    perform privado.recusar('nota', 'cancelada');
  end if;
  if v_n.status = 'processando' and v_n.ultima_tentativa_em > pg_catalog.now() - interval '10 minutes' then
    perform privado.recusar('nota', 'ja_processando');
  end if;
  update public.nota_fiscal n
     set status = 'processando', tentativas = n.tentativas + 1, ultima_tentativa_em = pg_catalog.now(), erro = null
   where n.id = v_n.id;
end;
$$;
comment on function privado.nota_iniciar(uuid) is '[P43] Marca a nota como processando e conta a tentativa. Recusa nota emitida, cancelada ou em processamento há menos de dez minutos (evita emitir duas vezes). Sem grant.';

create function privado.nota_registrar(
  p_nota_id      uuid,
  p_estado       text,
  p_provider_ref text,
  p_numero       text,
  p_pdf_path     text,
  p_xml_path     text,
  p_erro         text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_n   public.nota_fiscal;
  v_fam uuid;
begin
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id for update;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  if v_n.status = 'emitida' then
    return pg_catalog.jsonb_build_object('id', v_n.id, 'status', 'emitida', 'mudou', false);
  end if;
  if v_n.status not in ('processando') then
    perform privado.recusar('nota', 'fora_do_processamento');
  end if;
  if p_estado not in ('emitida', 'erro', 'processando') then
    perform privado.recusar('nota', 'estado_invalido');
  end if;
  select k.familia_id into v_fam from public.cobranca c join public.contrato k on k.id = c.contrato_id where c.id = v_n.cobranca_id;

  if p_estado = 'emitida' then
    if nullif(pg_catalog.btrim(coalesce(p_numero, '')), '') is null then
      perform privado.recusar('nota', 'sem_numero');
    end if;
    update public.nota_fiscal n
       set status = 'emitida', numero = pg_catalog.btrim(p_numero),
           provider_ref = coalesce(nullif(pg_catalog.btrim(p_provider_ref), ''), n.provider_ref),
           pdf_path = coalesce(p_pdf_path, n.pdf_path), xml_path = coalesce(p_xml_path, n.xml_path),
           emitida_em = pg_catalog.now(), erro = null
     where n.id = v_n.id;
    perform privado.venda_andar_p2(v_fam, 'pagamento_confirmado', 'nota_fiscal_emitida', 'Nota fiscal emitida');
    perform privado.venda_evento(v_fam, 'nota', 'Nota fiscal emitida', pg_catalog.jsonb_build_object('nota_id', v_n.id));
    perform privado.venda_log('nota_emitida', 'nota_fiscal', v_n.id::text, null,
      pg_catalog.jsonb_build_object('manual', false));
  elsif p_estado = 'erro' then
    update public.nota_fiscal n
       set status = 'erro', erro = pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_erro), ''), 'O provedor não explicou o erro.'), 500),
           provider_ref = coalesce(nullif(pg_catalog.btrim(p_provider_ref), ''), n.provider_ref)
     where n.id = v_n.id;
    perform privado.venda_avisar('financeiro', 'alta', 'Uma nota fiscal voltou com erro', '/notas/' || v_n.id::text);
  else
    update public.nota_fiscal n
       set provider_ref = coalesce(nullif(pg_catalog.btrim(p_provider_ref), ''), n.provider_ref)
     where n.id = v_n.id;
  end if;
  return pg_catalog.jsonb_build_object('id', v_n.id, 'status', p_estado, 'mudou', true);
end;
$$;
comment on function privado.nota_registrar(uuid, text, text, text, text, text, text) is '[P43] Guarda o resultado do provedor numa nota em processamento: emitida (exige o número; anda o P2 de pagamento_confirmado para nota_fiscal_emitida), erro (com o motivo, avisa o financeiro) ou ainda processando (guarda a referência). Repetição de nota emitida não muda nada. Sem grant.';

-- Emissão manual assistida: a nota foi emitida no portal do provedor e é registrada aqui.
create function privado.nota_registrar_manual(
  p_nota_id  uuid,
  p_numero   text,
  p_provider text,
  p_emitida_em date,
  p_pdf_path text,
  p_xml_path text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_n   public.nota_fiscal;
  v_fam uuid;
begin
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id for update;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  if v_n.status not in ('pendente', 'erro') then
    perform privado.recusar('nota', v_n.status::text || '_nao_aceita_manual');
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_numero, '')), '') is null or pg_catalog.length(p_numero) > 60 then
    perform privado.recusar('nota', 'sem_numero');
  end if;
  if p_emitida_em is null or p_emitida_em > privado.hoje_sp() or p_emitida_em < date '2020-01-01' then
    perform privado.recusar('nota', 'data_invalida');
  end if;
  if not exists (select 1 from public.cobranca c where c.id = v_n.cobranca_id and c.status = 'paga') then
    perform privado.recusar('nota', 'cobranca_nao_paga');
  end if;
  select k.familia_id into v_fam from public.cobranca c join public.contrato k on k.id = c.contrato_id where c.id = v_n.cobranca_id;

  update public.nota_fiscal n
     set status = 'emitida', manual = true, numero = pg_catalog.btrim(p_numero),
         provider = coalesce(nullif(pg_catalog.btrim(p_provider), ''), n.provider),
         emitida_em = (p_emitida_em + time '12:00') at time zone 'America/Sao_Paulo',
         pdf_path = coalesce(p_pdf_path, n.pdf_path), xml_path = coalesce(p_xml_path, n.xml_path), erro = null
   where n.id = v_n.id;
  perform privado.venda_andar_p2(v_fam, 'pagamento_confirmado', 'nota_fiscal_emitida', 'Nota fiscal emitida à mão');
  perform privado.venda_evento(v_fam, 'nota', 'Nota fiscal registrada', pg_catalog.jsonb_build_object('nota_id', v_n.id));
  perform privado.venda_log('nota_emitida', 'nota_fiscal', v_n.id::text, null,
    pg_catalog.jsonb_build_object('manual', true));
  return pg_catalog.jsonb_build_object('id', v_n.id, 'status', 'emitida');
end;
$$;
comment on function privado.nota_registrar_manual(uuid, text, text, date, text, text) is '[P43] Registra a nota emitada à mão no portal do provedor (emissão manual assistida, T-05): número obrigatório, data que não seja futura, PDF e XML opcionais no storage privado. Só nota pendente ou com erro, de cobrança paga. Anda o P2. Sem grant.';

-- --- Funções api da nota ---------------------------------------------------------------------
create function api.notas_fiscais(p_situacao text default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_itens  jsonb;
  v_resumo jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if p_situacao is not null and p_situacao not in ('pendente', 'processando', 'emitida', 'erro', 'cancelada') then
    perform privado.recusar('nota', 'situacao_invalida');
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', n.id, 'cobranca_id', n.cobranca_id, 'contrato_id', c.contrato_id, 'familia_id', k.familia_id,
           'familia_nome', f.nome_exibicao, 'tomador_nome', p.nome, 'parcela', c.parcela,
           'valor_centavos', c.valor_centavos, 'pago_em', c.pago_em, 'status', n.status, 'numero', n.numero,
           'provider', n.provider, 'erro', n.erro, 'tentativas', n.tentativas, 'manual', n.manual,
           'tem_pdf', n.pdf_path is not null, 'tem_xml', n.xml_path is not null,
           'emitida_em', n.emitida_em, 'criado_em', n.criado_em)
           order by (n.status = 'emitida'), (n.status = 'cancelada'), c.pago_em nulls last, n.criado_em), '[]'::jsonb)
    into v_itens
  from (select * from public.nota_fiscal x where p_situacao is null or x.status::text = p_situacao limit 300) n
  join public.cobranca c on c.id = n.cobranca_id
  join public.contrato k on k.id = c.contrato_id
  join public.familia f on f.id = k.familia_id
  left join public.pessoa p on p.id = coalesce(k.pagador_pessoa_id, k.contratante_pessoa_id);

  select pg_catalog.jsonb_build_object(
           'pendentes', count(*) filter (where status = 'pendente'),
           'processando', count(*) filter (where status = 'processando'),
           'emitidas', count(*) filter (where status = 'emitida'),
           'com_erro', count(*) filter (where status = 'erro'),
           'canceladas', count(*) filter (where status = 'cancelada'))
    into v_resumo from public.nota_fiscal;

  return pg_catalog.jsonb_build_object(
    'resumo', v_resumo, 'notas', v_itens,
    'emissao_automatica', coalesce((privado.venda_parametro('nfse_emissao') ->> 'automatica')::boolean, false));
end;
$$;
comment on function api.notas_fiscais(text) is '[P43] Notas fiscais para o financeiro: estado, número, valor, quem paga (o tomador), tentativas, motivo do erro e se há PDF e XML; mais o resumo por estado e se a emissão automática está ligada (parametro.nfse_emissao). No máximo 300. Financeiro e diretoria, AAL2.';

create function api.nota_fiscal(p_nota_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_n public.nota_fiscal;
  v_c public.cobranca;
  v_k public.contrato;
  v_f public.familia;
  v_p public.pessoa;
  v_d public.pessoa_dados_contrato;
  v_srv jsonb := privado.venda_parametro('nfse_servico');
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  select c.* into v_c from public.cobranca c where c.id = v_n.cobranca_id;
  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;
  select p.* into v_p from public.pessoa p where p.id = coalesce(v_k.pagador_pessoa_id, v_k.contratante_pessoa_id);
  select d.* into v_d from public.pessoa_dados_contrato d where d.pessoa_id = v_p.id;
  return pg_catalog.jsonb_build_object(
    'id', v_n.id, 'cobranca_id', v_c.id, 'contrato_id', v_k.id, 'familia_id', v_f.id, 'familia_nome', v_f.nome_exibicao,
    'tomador_nome', v_p.nome, 'tomador_tem_cpf', v_d.cpf is not null,
    'parcela', v_c.parcela, 'valor_centavos', v_c.valor_centavos, 'pago_em', v_c.pago_em,
    'cobranca_situacao', v_c.status, 'status', v_n.status, 'numero', v_n.numero, 'provider', v_n.provider,
    'provider_ref', v_n.provider_ref, 'erro', v_n.erro, 'tentativas', v_n.tentativas, 'manual', v_n.manual,
    'tem_pdf', v_n.pdf_path is not null, 'tem_xml', v_n.xml_path is not null,
    'emitida_em', v_n.emitida_em, 'criado_em', v_n.criado_em, 'versao', v_n.edicao,
    'codigo_servico', v_srv ->> 'codigo', 'descricao_servico', v_srv ->> 'descricao',
    'emissao_automatica', coalesce((privado.venda_parametro('nfse_emissao') ->> 'automatica')::boolean, false),
    'pode_emitir', v_n.status in ('pendente', 'erro') and v_c.status = 'paga',
    'pode_consultar', v_n.status = 'processando' and v_n.provider_ref is not null);
end;
$$;
comment on function api.nota_fiscal(uuid) is '[P43] Uma nota fiscal para o financeiro, sem CPF nem endereço: estado, número, tomador (quem paga), valor, tentativas, motivo do erro, código e descrição do serviço e o que dá para fazer. Financeiro e diretoria, AAL2.';

create function api.dados_emissao_nota(p_nota_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_st text;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  select n.status::text into v_st from public.nota_fiscal n where n.id = p_nota_id;
  if v_st is null then
    perform privado.recusar('nota', 'inexistente');
  end if;
  if v_st not in ('pendente', 'erro') then
    perform privado.recusar('nota', v_st || '_nao_emite');
  end if;
  return privado.nota_montar(p_nota_id);
end;
$$;
comment on function api.dados_emissao_nota(uuid) is '[P43] Tudo o que a emissão pede, com CPF e endereço completos do tomador (quem paga, C-10) e o serviço do cadastro. Só de nota pendente ou com erro, cobrança paga. Grava a leitura do CPF no log. Financeiro e diretoria, AAL2.';

create function api.iniciar_emissao_nota(p_nota_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  perform privado.nota_iniciar(p_nota_id);
  return pg_catalog.jsonb_build_object('id', p_nota_id, 'status', 'processando');
end;
$$;
comment on function api.iniciar_emissao_nota(uuid) is '[P43] Marca a nota como processando e conta a tentativa, antes de pedir ao provedor. Recusa nota emitida, cancelada ou já em processamento há menos de dez minutos. Financeiro e diretoria, AAL2.';

create function api.registrar_resultado_nota(
  p_nota_id      uuid,
  p_estado       text,
  p_provider_ref text default null,
  p_numero       text default null,
  p_pdf_path     text default null,
  p_xml_path     text default null,
  p_erro         text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.nota_registrar(p_nota_id, p_estado, p_provider_ref, p_numero, p_pdf_path, p_xml_path, p_erro);
end;
$$;
comment on function api.registrar_resultado_nota(uuid, text, text, text, text, text, text) is '[P43] Guarda o que o provedor respondeu: emitida (número obrigatório), erro (com o motivo) ou ainda processando. Financeiro e diretoria, AAL2.';

create function api.registrar_nota_manual(
  p_nota_id    uuid,
  p_numero     text,
  p_emitida_em date,
  p_provider   text default null,
  p_pdf_path   text default null,
  p_xml_path   text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.nota_registrar_manual(p_nota_id, p_numero, p_provider, p_emitida_em, p_pdf_path, p_xml_path);
end;
$$;
comment on function api.registrar_nota_manual(uuid, text, date, text, text, text) is '[P43] Registra uma nota emitida à mão no portal do provedor (emissão manual assistida): número, data, PDF e XML opcionais. Financeiro e diretoria, AAL2.';

create function api.arquivo_da_nota(p_nota_id uuid, p_tipo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_n public.nota_fiscal;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if p_tipo not in ('pdf', 'xml') then
    perform privado.recusar('nota', 'tipo_invalido');
  end if;
  select n.* into v_n from public.nota_fiscal n where n.id = p_nota_id;
  if not found then
    perform privado.recusar('nota', 'inexistente');
  end if;
  if (case p_tipo when 'pdf' then v_n.pdf_path else v_n.xml_path end) is null then
    perform privado.recusar('nota', 'sem_arquivo');
  end if;
  perform privado.venda_log('nota_arquivo_aberto', 'nota_fiscal', v_n.id::text, null, pg_catalog.jsonb_build_object('tipo', p_tipo));
  return pg_catalog.jsonb_build_object('caminho', case p_tipo when 'pdf' then v_n.pdf_path else v_n.xml_path end);
end;
$$;
comment on function api.arquivo_da_nota(uuid, text) is '[P43] Caminho do PDF ou do XML da nota no storage privado (notas/<id>.pdf ou .xml); o servidor assina a URL curta. Registra a abertura no log. Financeiro e diretoria, AAL2.';

-- --- Emissão automática depois do pagamento (servidor, service_role) -----------------------
-- Com parametro.nfse_emissao.automatica ligado, o servidor pede a nota logo depois de
-- confirmar o pagamento. Devolve os dados quando há o que emitir, ou o porquê de não emitir.
-- Dado incompleto (sem CPF do tomador, por exemplo) vira erro visível na nota, não silêncio.
create function public.nota_para_emissao_automatica(p_cobranca_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_id    uuid;
  v_dados jsonb;
begin
  if not coalesce((privado.venda_parametro('nfse_emissao') ->> 'automatica')::boolean, false) then
    return pg_catalog.jsonb_build_object('emitir', false, 'motivo', 'manual');
  end if;
  select n.id into v_id from public.nota_fiscal n
   where n.cobranca_id = p_cobranca_id and n.status in ('pendente', 'erro')
   order by n.criado_em desc limit 1;
  if v_id is null then
    return pg_catalog.jsonb_build_object('emitir', false, 'motivo', 'sem_nota_pendente');
  end if;
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'webhook', true);
  end if;
  begin
    v_dados := privado.nota_montar(v_id);
  exception when sqlstate 'P0001' then
    update public.nota_fiscal n
       set status = 'erro', erro = 'Faltam dados do tomador para emitir a nota. Confira o CPF de quem paga.'
     where n.id = v_id;
    return pg_catalog.jsonb_build_object('emitir', false, 'motivo', 'dados_incompletos');
  end;
  perform privado.nota_iniciar(v_id);
  return pg_catalog.jsonb_build_object('emitir', true) || v_dados;
end;
$$;
comment on function public.nota_para_emissao_automatica(uuid) is '[P43] Chamada pelo servidor depois do pagamento confirmado: com a emissão automática ligada e uma nota pendente ou com erro, marca como processando e devolve os dados da emissão; sem isso devolve emitir=false e o motivo. Dados do tomador incompletos deixam a nota em erro, com o motivo. Só service_role.';

create function public.nota_registrar_resultado(
  p_nota_id      uuid,
  p_estado       text,
  p_provider_ref text default null,
  p_numero       text default null,
  p_pdf_path     text default null,
  p_xml_path     text default null,
  p_erro         text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'webhook', true);
  end if;
  return privado.nota_registrar(p_nota_id, p_estado, p_provider_ref, p_numero, p_pdf_path, p_xml_path, p_erro);
end;
$$;
comment on function public.nota_registrar_resultado(uuid, text, text, text, text, text, text) is '[P43] Resultado da emissão automática vindo do servidor. Mesma regra de privado.nota_registrar. Só service_role.';


-- =============================================================================
-- 7. Execute e trava de segurança
--
-- api só para authenticated (papel e AAL conferidos por dentro); as de servidor
-- (public.pesquisa_*, public.nota_*) só para service_role; privado e assistencial
-- sem grant nenhum.
-- =============================================================================

-- Escrita direta fechada. Os grants por coluna que o app herdou da 0007 deixavam a
-- enfermeira responsável apagar o histórico de uma ocorrência, a coordenação pular
-- as regras de andamento e de SLA, escrever NPS e classificação e forjar a resposta
-- e as autorizações de depoimento e de imagem, e o financeiro dar uma nota por
-- emitida sem o provedor ou o registro manual conferido. Tudo isso agora só se faz
-- pelas funções de api (security definer, papel e AAL conferidos por dentro), que já
-- são o único caminho do app. A leitura continua pelas políticas da 0007.
revoke insert, update on public.ocorrencia  from authenticated;
revoke insert, update on public.pos_venda   from authenticated;
revoke insert, update on public.nota_fiscal from authenticated;

revoke execute on function privado.recusar(text, text, text)                       from public, anon, authenticated, service_role;
revoke execute on function privado.incrementar_edicao()                            from public, anon, authenticated, service_role;
revoke execute on function privado.hoje_sp()                                       from public, anon, authenticated, service_role;
revoke execute on function privado.dias_uteis_apos(date, integer)                  from public, anon, authenticated, service_role;
revoke execute on function privado.evolucao_acesso(uuid, boolean)                  from public, anon, authenticated, service_role;
revoke execute on function privado.evolucao_profissional(uuid)                     from public, anon, authenticated, service_role;
revoke execute on function privado.evolucoes_faltando(uuid)                        from public, anon, authenticated, service_role;
revoke execute on function privado.data_conclusao_atendimento(uuid)                from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_prazo_relatorio()                     from public, anon, authenticated, service_role;
revoke execute on function privado.iniciar_pos_conclusao(uuid)                     from public, anon, authenticated, service_role;
revoke execute on function privado.registro_concluiu_atendimento()                 from public, anon, authenticated, service_role;
revoke execute on function privado.avisar_ocorrencias_vencidas()                   from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_origem(text)                           from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_limite(text)                           from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_textos(text)                           from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_classificar(integer)                   from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_bloqueio(uuid)                         from public, anon, authenticated, service_role;
revoke execute on function privado.pesquisa_agir(uuid)                             from public, anon, authenticated, service_role;
revoke execute on function privado.nota_montar(uuid)                               from public, anon, authenticated, service_role;
revoke execute on function privado.nota_iniciar(uuid)                              from public, anon, authenticated, service_role;
revoke execute on function privado.nota_registrar(uuid, text, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.nota_registrar_manual(uuid, text, text, date, text, text) from public, anon, authenticated, service_role;

revoke execute on function assistencial.ler_base_evolucao(uuid)                    from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_evolucoes(text)                        from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_relatorio_medico(uuid)                 from public, anon, authenticated, service_role;
revoke execute on function assistencial.salvar_relatorio_medico(uuid, text, uuid, jsonb, jsonb, integer, uuid) from public, anon, authenticated, service_role;

revoke execute on function api.base_evolucao(uuid)                                 from public, anon, service_role;
revoke execute on function api.evolucoes(text)                                     from public, anon, service_role;
revoke execute on function api.evolucao(uuid)                                      from public, anon, service_role;
revoke execute on function api.salvar_evolucao(uuid, text, uuid, jsonb, jsonb, integer) from public, anon, service_role;
revoke execute on function api.enviar_evolucao_para_revisao(uuid, integer)         from public, anon, service_role;
revoke execute on function api.devolver_evolucao(uuid, text)                       from public, anon, service_role;
revoke execute on function api.aprovar_evolucao(uuid, integer)                     from public, anon, service_role;
revoke execute on function api.dados_envio_evolucao(uuid)                          from public, anon, service_role;
revoke execute on function api.registrar_envio_evolucao(uuid, text, jsonb, text)   from public, anon, service_role;
revoke execute on function api.pdf_evolucao(uuid)                                  from public, anon, service_role;
revoke execute on function api.ocorrencias(text, uuid)                             from public, anon, service_role;
revoke execute on function api.ocorrencia(uuid)                                    from public, anon, service_role;
revoke execute on function api.responsaveis_ocorrencia()                           from public, anon, service_role;
revoke execute on function api.registrar_ocorrencia(uuid, uuid, text, text, boolean, text, text, uuid) from public, anon, service_role;
revoke execute on function api.atualizar_ocorrencia(uuid, text, uuid, text, boolean, text, integer) from public, anon, service_role;
revoke execute on function api.pos_vendas(text)                                    from public, anon, service_role;
revoke execute on function api.gerar_link_pesquisa(uuid)                           from public, anon, service_role;
revoke execute on function api.marcar_pesquisa_enviada(uuid)                       from public, anon, service_role;
revoke execute on function api.avancar_pos_venda(uuid)                             from public, anon, service_role;
revoke execute on function api.notas_fiscais(text)                                 from public, anon, service_role;
revoke execute on function api.nota_fiscal(uuid)                                   from public, anon, service_role;
revoke execute on function api.dados_emissao_nota(uuid)                            from public, anon, service_role;
revoke execute on function api.iniciar_emissao_nota(uuid)                          from public, anon, service_role;
revoke execute on function api.registrar_resultado_nota(uuid, text, text, text, text, text, text) from public, anon, service_role;
revoke execute on function api.registrar_nota_manual(uuid, text, date, text, text, text) from public, anon, service_role;
revoke execute on function api.arquivo_da_nota(uuid, text)                         from public, anon, service_role;

grant execute on function api.base_evolucao(uuid)                                  to authenticated;
grant execute on function api.evolucoes(text)                                      to authenticated;
grant execute on function api.evolucao(uuid)                                       to authenticated;
grant execute on function api.salvar_evolucao(uuid, text, uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function api.enviar_evolucao_para_revisao(uuid, integer)          to authenticated;
grant execute on function api.devolver_evolucao(uuid, text)                        to authenticated;
grant execute on function api.aprovar_evolucao(uuid, integer)                      to authenticated;
grant execute on function api.dados_envio_evolucao(uuid)                           to authenticated;
grant execute on function api.registrar_envio_evolucao(uuid, text, jsonb, text)    to authenticated;
grant execute on function api.pdf_evolucao(uuid)                                   to authenticated;
grant execute on function api.ocorrencias(text, uuid)                              to authenticated;
grant execute on function api.ocorrencia(uuid)                                     to authenticated;
grant execute on function api.responsaveis_ocorrencia()                            to authenticated;
grant execute on function api.registrar_ocorrencia(uuid, uuid, text, text, boolean, text, text, uuid) to authenticated;
grant execute on function api.atualizar_ocorrencia(uuid, text, uuid, text, boolean, text, integer) to authenticated;
grant execute on function api.pos_vendas(text)                                     to authenticated;
grant execute on function api.gerar_link_pesquisa(uuid)                            to authenticated;
grant execute on function api.marcar_pesquisa_enviada(uuid)                        to authenticated;
grant execute on function api.avancar_pos_venda(uuid)                              to authenticated;
grant execute on function api.notas_fiscais(text)                                  to authenticated;
grant execute on function api.nota_fiscal(uuid)                                    to authenticated;
grant execute on function api.dados_emissao_nota(uuid)                             to authenticated;
grant execute on function api.iniciar_emissao_nota(uuid)                           to authenticated;
grant execute on function api.registrar_resultado_nota(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function api.registrar_nota_manual(uuid, text, date, text, text, text) to authenticated;
grant execute on function api.arquivo_da_nota(uuid, text)                          to authenticated;

revoke execute on function public.pesquisa_abrir(text, text)                       from public, anon, authenticated;
revoke execute on function public.pesquisa_enviar(text, jsonb, text)               from public, anon, authenticated;
revoke execute on function public.nota_para_emissao_automatica(uuid)               from public, anon, authenticated;
revoke execute on function public.nota_registrar_resultado(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.pesquisa_abrir(text, text)                        to service_role;
grant execute on function public.pesquisa_enviar(text, jsonb, text)                to service_role;
grant execute on function public.nota_para_emissao_automatica(uuid)                to service_role;
grant execute on function public.nota_registrar_resultado(uuid, text, text, text, text, text, text) to service_role;

do $$
declare
  v_lista text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api'
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or p.proacl is null
         or exists (select 1 from pg_catalog.aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE')
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de api fora da regra (security definer, search_path vazio, só authenticated): %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'assistencial'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de assistencial executável por papel da aplicação: %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'privado'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('tem_papel', 'familias_atribuidas', 'aal2', 'sem_acento');
  if v_lista is not null then
    raise exception 'função de privado executável por authenticated fora da lista do PRD 11.10: %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('pesquisa_abrir', 'pesquisa_enviar', 'nota_para_emissao_automatica', 'nota_registrar_resultado')
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or not has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de servidor fora da regra (só service_role): %', v_lista;
  end if;
end $$;
