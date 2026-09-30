/**
 * P28 · O SQL do roteiro: leitura do estado, da referência (planos, listas e
 * textos fixos, sempre lidos do banco) e o preparo e as ações entre turnos.
 *
 * Os dois executores usam os mesmos textos SQL. Aqui não há valor, plano nem
 * texto fixo: só nomes de tabela e função do próprio projeto.
 *
 * Tudo isto roda só contra o banco local ou o banco de homologação, com dados
 * sintéticos. Nunca contra produção (o executor de homologação recusa sem a
 * confirmação explícita, ver `ambiente.ts`).
 */
import type { EstadoBanco, Objeto, Plano, Referencia } from "./tipos";

/** Conexão mínima: devolve as linhas da última consulta. */
export interface Consulta {
  linhas(sql: string): Promise<Objeto[]>;
}

/** Faz qualquer comando (select, update ... returning) devolver as linhas como um JSON só. */
export function envelopar(sql: string): string {
  return `with q as (${sql.trim().replace(/;\s*$/, "")}) select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from q`;
}

export function lit(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "number")
    return Number.isFinite(valor) ? String(valor) : "null";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return `'${texto.replace(/'/g, "''")}'`;
}

export function jsonLit(valor: unknown): string {
  return `${lit(JSON.stringify(valor))}::jsonb`;
}

// ---------------------------------------------------------------------------
// Estado da conversa depois de um turno
// ---------------------------------------------------------------------------

export function sqlEstado(telefoneE164: string): string {
  return `
with c as (
  select * from public.conversa
   where telefone_e164 = ${lit(telefoneE164)}
   order by criado_em desc limit 1
), o as (
  select o.* from public.oportunidade o, c
   where o.familia_id = c.familia_id and o.pipeline = 1
   order by o.criado_em desc limit 1
)
select jsonb_build_object(
  'conversa', (select jsonb_build_object(
      'id', c.id, 'classificacao', c.classificacao,
      'agente_pausado_ate', c.agente_pausado_ate, 'agente_pausa_motivo', c.agente_pausa_motivo,
      'agente_encerrado_em', c.agente_encerrado_em, 'agente_encerrado_motivo', c.agente_encerrado_motivo,
      'familia_id', c.familia_id) from c),
  'transferencias', coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'motivo', h.motivo, 'destino', h.destino, 'prioridade', h.prioridade,
      'status', h.status, 'dados', h.dados, 'resumo', h.resumo, 'criado_em', h.criado_em)
      order by h.criado_em, h.id) from public.handoff h where h.conversa_id = (select id from c)), '[]'::jsonb),
  'mensagens', coalesce((select jsonb_agg(jsonb_build_object(
      'direcao', m.direcao, 'enviado_por', m.enviado_por, 'tipo', m.tipo,
      'conteudo', m.conteudo, 'transcricao', m.transcricao)
      order by m.enviada_em, m.criado_em, m.id) from public.mensagem m where m.conversa_id = (select id from c)), '[]'::jsonb),
  'oportunidade', (select jsonb_build_object(
      'estagio_p1', o.estagio_p1, 'pdf_enviado_em', o.pdf_enviado_em,
      'sessao_interesse_em', o.sessao_interesse_em, 'proximo_contato_em', o.proximo_contato_em,
      'qualificacao', o.qualificacao) from o),
  'familia', (select jsonb_build_object('estado_sensivel', f.estado_sensivel, 'nao_contatar', f.nao_contatar)
      from public.familia f, c where f.id = c.familia_id),
  'tarefas_followup', (select count(*) from public.tarefa t, c
      where t.familia_id = c.familia_id and t.origem_automacao_id like 'followup%'),
  'sessoes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'status', s.status, 'agendada_por', s.agendada_por, 'agendada_para', s.agendada_para,
      'link_reuniao', s.link_reuniao, 'tem_evento', s.evento_calendar_id is not null,
      'lembrete_enviado_em', s.lembrete_enviado_em, 'resultado', s.resultado, 'criado_em', s.criado_em)
      order by s.criado_em, s.id) from public.sessao_venda s, c where s.familia_id = c.familia_id), '[]'::jsonb),
  'opcoes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', op.id, 'inicio', op.inicio, 'fim', op.fim, 'consultada_em', op.consultada_em, 'valida_ate', op.valida_ate,
      'conferida_em', op.conferida_em, 'escolhida_em', op.escolhida_em, 'descartada_em', op.descartada_em)
      order by op.criado_em, op.id) from public.sessao_venda_opcao op where op.conversa_id = (select id from c)), '[]'::jsonb),
  'consultas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'tipo', q.tipo, 'status', q.status, 'pergunta', q.pergunta, 'preferencia', q.preferencia,
      'resposta', q.resposta, 'devolvida_em', q.devolvida_em,
      'prioridade', (select t.prioridade::text from public.tarefa t
                      where t.tipo = 'responder_consulta_isadora' and t.payload ->> 'consulta_id' = q.id::text
                      order by t.criado_em desc limit 1))
      order by q.criado_em, q.id) from public.consulta_equipe q where q.conversa_id = (select id from c)), '[]'::jsonb),
  'execucoes', coalesce((select jsonb_agg(jsonb_build_object(
      'automacao_id', e.automacao_id, 'status', e.status, 'motivo_aborto', e.motivo_aborto,
      'etapa', (e.payload ->> 'etapa')::integer, 'executada_em', e.executada_em)
      order by e.criado_em, e.id) from public.automacao_execucao e, c
      where e.familia_id = c.familia_id
        and e.automacao_id in ('followup_d1', 'followup_d3_d14', 'lembrete_sessao', 'reuniao_falta_remarcar',
                               'consulta_horario_retomada', 'desfecho_sessao_pendente')), '[]'::jsonb)
) as estado`;
}

export function sqlModo(conversaId: string): string {
  return `select agente.pode_responder(${lit(conversaId)}::uuid) as resultado`;
}

const ESTADO_VAZIO: EstadoBanco = {
  conversa: null,
  modo: null,
  transferencias: [],
  mensagens: [],
  oportunidade: null,
  familia: null,
  tarefas_followup: 0,
  sessoes: [],
  opcoes: [],
  consultas: [],
  execucoes: [],
};

export async function lerEstado(
  consulta: Consulta,
  telefoneE164: string,
): Promise<EstadoBanco> {
  const [linha] = await consulta.linhas(sqlEstado(telefoneE164));
  const bruto = (linha?.["estado"] ?? null) as Partial<EstadoBanco> | null;
  const estado: EstadoBanco = { ...ESTADO_VAZIO, ...(bruto ?? {}) };
  if (estado.conversa) {
    try {
      const [modo] = await consulta.linhas(sqlModo(estado.conversa.id));
      const resultado = (modo?.["resultado"] ?? null) as {
        modo?: string;
      } | null;
      estado.modo = resultado?.modo ?? null;
    } catch {
      estado.modo = null;
    }
  }
  return estado;
}

// ---------------------------------------------------------------------------
// Referência (planos, listas, textos fixos)
// ---------------------------------------------------------------------------

export async function lerReferencia(
  consulta: Consulta,
  base: {
    conversaId: string | null;
    telefone: string;
    cpfEnviado: string | null;
  },
): Promise<Referencia> {
  const [planosLinha] = await consulta.linhas(
    `select agente.planos_vigentes() as resultado`,
  );
  const planosBrutos = ((
    planosLinha?.["resultado"] as { planos?: Objeto[] } | undefined
  )?.planos ?? []) as Objeto[];
  const planos: Plano[] = planosBrutos.map((p) => ({
    nome: String(p["nome"]),
    gemelar: p["gemelar"] === true,
    dias: Number(p["dias"]),
    valor: String(p["valor"]),
    valor_centavos: Number(p["valor_centavos"]),
    parcelas: Number(p["parcelas"]),
    parcela_texto: String(p["parcela_texto"]),
    valor_parcela_centavos: Number(p["valor_parcela_centavos"]),
  }));

  const [modelosLinha] = await consulta.linhas(
    `select coalesce(jsonb_object_agg(chave, texto), '{}'::jsonb) as modelos,
            coalesce(jsonb_object_agg(chave, status::text), '{}'::jsonb) as status
       from public.mensagem_modelo`,
  );
  const modelos = (modelosLinha?.["modelos"] ?? {}) as Record<string, string>;
  const statusDosModelos = (modelosLinha?.["status"] ?? {}) as Record<
    string,
    string
  >;

  const [listasLinha] = await consulta.linhas(
    `select valor as listas from public.parametro where chave = 'validador_listas'`,
  );
  const listas = (listasLinha?.["listas"] ?? {}) as Partial<
    Referencia["listas"]
  >;

  let taxas: number[] = [];
  let nomeDoPdf = "";
  if (base.conversaId) {
    const [ficha] = await consulta.linhas(
      `select agente.ficha_para_agente(${lit(base.conversaId)}::uuid) as resultado`,
    );
    const dados = (ficha?.["resultado"] ?? {}) as {
      validador?: { taxas_centavos?: number[] };
      pdf?: { nome_arquivo?: string };
    };
    taxas = dados.validador?.taxas_centavos ?? [];
    nomeDoPdf = dados.pdf?.nome_arquivo ?? "";
  }

  const [horarios] = await consulta.linhas(
    `select valor as horarios from public.parametro where chave = 'horarios_edilaine'`,
  );
  const horariosBrutos = horarios?.["horarios"];

  return {
    planos,
    taxasVisiveisCentavos: taxas,
    listas: {
      escassez: listas.escassez ?? [],
      promessas: listas.promessas ?? [],
      pedido_dado: listas.pedido_dado ?? [],
      pedido_verbos: listas.pedido_verbos ?? [],
      negar_assistente: listas.negar_assistente ?? [],
      palavras_condicao: listas.palavras_condicao ?? [],
      palavras_evitadas: listas.palavras_evitadas ?? [],
    },
    modelos,
    statusDosModelos,
    nomeDoPdf,
    telefone: base.telefone,
    cpfEnviado: base.cpfEnviado,
    horariosDaEdilaine: Array.isArray(horariosBrutos)
      ? horariosBrutos.map(String)
      : typeof horariosBrutos === "string"
        ? [horariosBrutos]
        : [],
  };
}

// ---------------------------------------------------------------------------
// Parâmetros que o roteiro muda e devolve
// ---------------------------------------------------------------------------

export async function lerParametro(
  consulta: Consulta,
  chave: string,
): Promise<unknown | undefined> {
  const [linha] = await consulta.linhas(
    `select valor from public.parametro where chave = ${lit(chave)}`,
  );
  return linha ? linha["valor"] : undefined;
}

export async function gravarParametro(
  consulta: Consulta,
  chave: string,
  valor: unknown | undefined,
): Promise<void> {
  if (valor === undefined) {
    await consulta.linhas(
      `delete from public.parametro where chave = ${lit(chave)} returning chave`,
    );
    return;
  }
  await consulta.linhas(
    `insert into public.parametro (chave, valor) values (${lit(chave)}, ${jsonLit(valor)})
     on conflict (chave) do update set valor = excluded.valor returning chave`,
  );
}

// ---------------------------------------------------------------------------
// Ações entre turnos
// ---------------------------------------------------------------------------

export function sqlPausarIA(conversaId: string): string {
  return `select agente.pausar(${lit(conversaId)}::uuid, 48, 'roteiro_homologacao') as resultado`;
}

/**
 * Envelhece a conversa para o follow-up: puxa para trás os carimbos que o
 * agendador lê (`ultima_entrada_em`, `ultima_saida_em`, `primeira_msg_em`).
 * A tabela `mensagem` é append-only e não é tocada.
 */
export function sqlEnvelhecerConversa(
  conversaId: string,
  horas: number,
): string {
  return `update public.conversa
             set ultima_entrada_em = ultima_entrada_em - make_interval(hours => ${lit(horas)}),
                 ultima_saida_em = ultima_saida_em - make_interval(hours => ${lit(horas)}),
                 primeira_msg_em = primeira_msg_em - make_interval(hours => ${lit(horas)})
           where id = ${lit(conversaId)}::uuid
       returning id`;
}

export function sqlAgendarFollowup(): string {
  return `select privado.agendar_followup_d1() as agendados`;
}

/**
 * Chama uma função `api.*` como o app chama: papel authenticated, com o JWT
 * de um usuário comercial do seed sintético e AAL2.
 */
export function sqlComoComercial(chamada: string): string {
  return `
with u as (select usuario_id from public.usuario_papel where papel = 'comercial' order by usuario_id limit 1)
select set_config('request.jwt.claims',
         jsonb_build_object('sub', u.usuario_id, 'role', 'authenticated', 'aal', 'aal2')::text, true) as claims,
       set_config('role', 'authenticated', true) as papel,
       (${chamada}) as resultado
  from u`;
}

export function sqlResolverTransferencia(handoffId: string): string {
  return sqlComoComercial(
    `api.resolver_transferencia(${lit(handoffId)}::uuid, 'sem_retorno')`,
  );
}

export function sqlDevolverAIsadora(conversaId: string): string {
  return sqlComoComercial(`api.retomar_agente(${lit(conversaId)}::uuid)`);
}

// ---------------------------------------------------------------------------
// [v4.3] Agenda: preparo, passagem do tempo e o que a equipe faz no CRM
// ---------------------------------------------------------------------------

/**
 * Passa o relógio da conversa e da agenda. Só o que o roteiro precisa: os
 * carimbos que a cadência e as opções de horário leem. `mensagem` continua
 * intocada (é quase append-only); o horário da reunião marcada não muda.
 * As execuções do motor recuam junto (senão o "familia_respondeu" cancelaria
 * a etapa seguinte da cadência).
 */
export function sqlPassarTempo(conversaId: string, horas: number): string[] {
  const intervalo = `make_interval(hours => ${lit(horas)})`;
  return [
    `update public.conversa
        set ultima_entrada_em = ultima_entrada_em - ${intervalo},
            ultima_saida_em = ultima_saida_em - ${intervalo},
            primeira_msg_em = primeira_msg_em - ${intervalo}
      where id = ${lit(conversaId)}::uuid
  returning id`,
    `update public.sessao_venda_opcao o
        set consultada_em = o.consultada_em - ${intervalo},
            valida_ate = o.valida_ate - ${intervalo}
      where o.conversa_id = ${lit(conversaId)}::uuid
  returning o.id`,
    `update public.automacao_execucao e
        set executada_em = e.executada_em - ${intervalo},
            agendada_para = e.agendada_para - ${intervalo},
            payload = case when e.payload ? 'ultima_entrada_em'
              then e.payload || jsonb_build_object('ultima_entrada_em',
                     to_jsonb(((e.payload ->> 'ultima_entrada_em')::timestamptz - ${intervalo})))
              else e.payload end
       from public.conversa c
      where c.id = ${lit(conversaId)}::uuid and e.familia_id = c.familia_id
  returning e.id`,
  ];
}

/** O lembrete da véspera fica devido agora. */
export function sqlChegarAVespera(conversaId: string): string {
  return `
update public.automacao_execucao e
   set agendada_para = clock_timestamp() - interval '1 minute'
  from public.conversa c
 where c.id = ${lit(conversaId)}::uuid and e.familia_id = c.familia_id
   and e.automacao_id = 'lembrete_sessao' and e.status = 'agendada'
returning e.id`;
}

/** Puxa o horário da reunião marcada para 1 hora atrás (para a Edilaine poder registrar como foi). */
export function sqlReuniaoJaAconteceu(conversaId: string): string {
  return `
update public.sessao_venda s
   set agendada_para = now() - interval '1 hour'
  from public.conversa c
 where c.id = ${lit(conversaId)}::uuid and s.familia_id = c.familia_id and s.status = 'agendada'
returning s.id`;
}

/** A Edilaine (coordenação, AAL2) registra como foi a reunião, como o CRM faz. */
export function sqlRegistrarDesfecho(
  sessaoId: string,
  desfecho: "realizada" | "nao_compareceu",
  resultado: string | null,
): string {
  return `
with u as (select usuario_id from public.usuario_papel where papel = 'coordenacao' order by usuario_id limit 1)
select set_config('request.jwt.claims',
         jsonb_build_object('sub', u.usuario_id, 'role', 'authenticated', 'aal', 'aal2')::text, true) as claims,
       set_config('role', 'authenticated', true) as papel,
       (api.registrar_desfecho_sessao_venda(${lit(sessaoId)}::uuid, ${lit(desfecho)}::public.status_sessao, null, ${lit(resultado)})) as resultado
  from u`;
}

/** A equipe (comercial, AAL2) responde uma consulta da Isadora em "Perguntas da Isadora". */
export function sqlResponderConsulta(
  consultaId: string,
  resposta: string | null,
): string {
  return sqlComoComercial(
    `api.responder_consulta_equipe(${lit(consultaId)}::uuid, ${lit(resposta)})`,
  );
}

/** O id do evento da reunião marcada pela Isadora: só o teste (superusuário local ou de homologação) lê. */
export function sqlEventoDaConversa(conversaId: string): string {
  return `
select s.evento_calendar_id as evento_id, s.id as sessao_id
  from public.sessao_venda s
  join public.conversa c on c.familia_id = s.familia_id
 where c.id = ${lit(conversaId)}::uuid and s.status = 'agendada' and s.evento_calendar_id is not null
 order by s.criado_em desc limit 1`;
}

/**
 * Ao fim de cada caso, as pendências da conversa de teste deixam de valer: uma
 * consulta aberta ou um lembrete agendado de um caso não podem ser processados
 * pelo agendador no caso seguinte (o gatilho de 30 minutos olha todas as famílias).
 */
export function sqlEncerrarPendencias(conversaId: string): string[] {
  return [
    `update public.consulta_equipe set status = 'cancelada'
      where conversa_id = ${lit(conversaId)}::uuid and status = 'aberta'
  returning id`,
    `update public.automacao_execucao e
        set status = 'cancelada', motivo_aborto = 'fim_do_teste'
       from public.conversa c
      where c.id = ${lit(conversaId)}::uuid and e.familia_id = c.familia_id and e.status = 'agendada'
  returning e.id`,
  ];
}
