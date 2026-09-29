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
      where t.familia_id = c.familia_id and t.origem_automacao_id like 'followup%')
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
