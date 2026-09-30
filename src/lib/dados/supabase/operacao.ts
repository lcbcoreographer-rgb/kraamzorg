import "server-only";
import type { Json } from "@/lib/db/types";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import type {
  RespostasBloco,
  RespostasFormulario,
} from "@/lib/instrumentos/respostas";
import type { OperacaoRepositorio } from "../repositorios";
import type { EstadoSensivel, EstagioP2 } from "../tipos";
import type {
  AlocacaoFamilia,
  Candidata,
  ConsultaPrenatalResumo,
  DesfechoRecusa,
  DesignacaoLinha,
  DesignadaNoRadar,
  EntrevistaPrenatal,
  EstadoAcompanhamento,
  EstadoPrenatal,
  Oferta,
  OcupacaoSemana,
  PendenciaOperacao,
  PeriodoVisita,
  ProgressoEntrevista,
  Radar,
  RadarFamilia,
  RadarNasceu,
  ResultadoAlta,
  ResultadoNascimento,
  ResultadoResposta,
  ResultadoSalvarCampo,
  StatusConsulta,
  VisitaDoAcompanhamento,
} from "../tipos-operacao";
import { rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Operação na real (P35 e P36): tudo pelas funções do schema api da
 * 0021_prenatal_nascimento.sql, com a sessão do usuário (papel e AAL2
 * conferidos por dentro de cada função). Nenhuma tabela assistencial é lida
 * direto: a entrevista vem de api.prenatal_abrir, que grava a leitura no log.
 *
 * As chamadas passam por `rpcPendente` porque `pnpm db:types` ainda não foi
 * regenerado com a 0021 (a migration espera a revisão humana); quando for,
 * trocar por `cliente.schema("api").rpc(...)` tipada.
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const lista = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const numero = (v: Json | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;
const numeroOuNulo = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : v === null || v === undefined ? null : Number(v);

// --- Mapeamentos (exportados: os testes conferem o que o banco devolve) -----------

export function progressoDoBanco(valor: Json | undefined): ProgressoEntrevista | null {
  const p = objeto(valor);
  if (typeof p.etapa !== "number") return null;
  return { etapa: p.etapa, campo: texto(p.campo), em: texto(p.em) };
}

export function consultaResumoDoBanco(valor: Json): ConsultaPrenatalResumo {
  const r = objeto(valor);
  return {
    consultaId: String(r.consulta_id),
    familiaId: String(r.familia_id),
    nome: String(r.nome ?? ""),
    status: String(r.status) as StatusConsulta,
    urgente: r.urgente === true,
    agendadaPara: texto(r.agendada_para),
    realizadaEm: texto(r.realizada_em),
    iniciadaEm: texto(r.iniciada_em),
    etapa: numeroOuNulo(r.etapa),
    parouEm: texto(r.parou_em),
    respondidos: numero(r.respondidos),
    dpp: texto(r.dpp),
    ig: texto(r.ig),
    igSemanas: numeroOuNulo(r.ig_semanas),
    chegouAlerta: r.chegou_alerta === true,
    cidade: texto(r.cidade),
    uf: texto(r.uf),
    estagioP2: texto(r.estagio_p2) as EstagioP2 | null,
  };
}

export function estadoPrenatalDoBanco(valor: Json): EstadoPrenatal {
  const r = objeto(valor);
  if (r.existe !== true) {
    return {
      existe: false,
      status: null,
      agendadaPara: null,
      realizadaEm: null,
      emAndamento: false,
    };
  }
  return {
    existe: true,
    status: String(r.status) as StatusConsulta,
    agendadaPara: texto(r.agendada_para),
    realizadaEm: texto(r.realizada_em),
    emAndamento: r.em_andamento === true,
  };
}

/** A ficha do banco ({bloco: {campo: valor}}) nas respostas do gerador de formulário. */
export function respostasDaFicha(ficha: Json | undefined): RespostasFormulario {
  const blocos: Record<string, RespostasBloco> = {};
  for (const [bloco, campos] of Object.entries(objeto(ficha))) {
    const doBloco = objeto(campos);
    if (Object.keys(doBloco).length > 0) {
      blocos[bloco] = doBloco as unknown as RespostasBloco;
    }
  }
  return { blocos, por_bebe: {} };
}

export function entrevistaDoBanco(valor: Json): EntrevistaPrenatal {
  const r = objeto(valor);
  const c = objeto(r.consulta);
  const f = objeto(r.familia);
  const sugestoes: Record<string, string> = {};
  for (const [k, v] of Object.entries(objeto(r.sugestoes))) {
    if (typeof v === "string") sugestoes[k] = v;
  }
  return {
    consulta: {
      id: String(c.id),
      status: String(c.status) as StatusConsulta,
      urgente: c.urgente === true,
      agendadaPara: texto(c.agendada_para),
      realizadaEm: texto(c.realizada_em),
      iniciadaEm: texto(c.iniciada_em),
      instrumentoVersao: String(c.instrumento_versao),
      versao: numero(c.versao),
      progresso: progressoDoBanco(c.progresso),
    },
    definicao: lerDefinicao(r.definicao),
    respostas: respostasDaFicha(r.respostas),
    familia: {
      id: String(f.id),
      nome: String(f.nome ?? ""),
      dpp: texto(f.dpp),
      gemelar: f.gemelar === true,
      cidade: texto(f.cidade),
      uf: texto(f.uf),
      ig: texto(f.ig),
      igSemanas: numeroOuNulo(f.ig_semanas),
    },
    sugestoes,
    coletador: texto(r.coletador),
  };
}

export function resultadoSalvarDoBanco(valor: Json): ResultadoSalvarCampo {
  const r = objeto(valor);
  return {
    ok: r.ok === true,
    versao: numero(r.versao),
    conflito: r.conflito === true,
    original: (r.original ?? null) as Json | null,
    repetido: r.repetido === true,
  };
}

function periodos(valor: unknown): PeriodoVisita[] {
  return lista(valor).filter(
    (p): p is PeriodoVisita => p === "manha" || p === "tarde" || p === "noite_avaliar",
  );
}

export function alocacaoDoBanco(valor: Json): AlocacaoFamilia {
  const r = objeto(valor);
  const f = objeto(r.familia);
  const a = r.acompanhamento ? objeto(r.acompanhamento) : null;
  return {
    familia: {
      id: String(f.id),
      nome: String(f.nome ?? ""),
      dpp: texto(f.dpp),
      dataNascimento: texto(f.data_nascimento),
      dataAlta: texto(f.data_alta),
      dataInicioEfetivo: texto(f.data_inicio_efetivo),
      gemelar: f.gemelar === true,
      estadoSensivel: (texto(f.estado_sensivel) ?? "normal") as EstadoSensivel,
      ig: texto(f.ig),
      estagioP2: texto(f.estagio_p2) as EstagioP2 | null,
      cidade: texto(f.cidade),
      uf: texto(f.uf),
      regiaoId: texto(f.regiao_id),
      janelaInicio: texto(f.janela_inicio),
      janelaFim: texto(f.janela_fim),
      periodoPreferido: periodos(f.periodo_preferido),
      consultaStatus: texto(f.consulta_status) as StatusConsulta | null,
    },
    acompanhamento: a
      ? {
          id: String(a.id),
          estado: String(a.estado) as EstadoAcompanhamento,
          dias: numero(a.dias),
          horasPorVisita: numero(a.horas_por_visita),
          periodo: texto(a.periodo) as PeriodoVisita | null,
          inicioEfetivo: texto(a.inicio_efetivo),
          previsaoAlta: texto(a.previsao_alta),
          visitas: numero(a.visitas),
          listaVisitas: lista(a.lista_visitas).map(visitaDoBanco),
        }
      : null,
    designacoes: lista(r.designacoes).map(designacaoDoBanco),
    candidatas: lista(r.candidatas).map(candidataDoBanco),
    tarefas: lista(r.tarefas).map((item) => {
      const t = objeto(item);
      return {
        tipo: String(t.tipo) as PendenciaOperacao["tipo"],
        titulo: String(t.titulo ?? ""),
        prioridade: String(t.prioridade) as PendenciaOperacao["prioridade"],
        venceEm: texto(t.vence_em),
      };
    }),
  };
}

function visitaDoBanco(valor: Json): VisitaDoAcompanhamento {
  const v = objeto(valor);
  return {
    diaNumero: numero(v.dia_numero),
    data: String(v.data),
    horaPrevista: texto(v.hora_prevista),
    estado: String(v.estado) as VisitaDoAcompanhamento["estado"],
    profissionalId: String(v.profissional_id),
    profissional: texto(v.profissional),
  };
}

function designacaoDoBanco(valor: Json): DesignacaoLinha {
  const d = objeto(valor);
  return {
    id: String(d.id),
    papel: String(d.papel) as DesignacaoLinha["papel"],
    status: String(d.status) as DesignacaoLinha["status"],
    profissionalId: String(d.profissional_id),
    profissional: String(d.profissional ?? ""),
    oferecidaEm: String(d.oferecida_em),
    respondidaEm: texto(d.respondida_em),
    prazoRespostaEm: texto(d.prazo_resposta_em),
    direta: d.direta === true,
    motivoRecusa: texto(d.motivo_recusa),
  };
}

function candidataDoBanco(valor: Json): Candidata {
  const c = objeto(valor);
  return {
    profissionalId: String(c.profissional_id),
    nome: String(c.nome ?? ""),
    funcao: String(c.funcao ?? ""),
    estadoHoje: texto(c.estado_hoje) as Candidata["estadoHoje"],
    naRegiao: c.na_regiao !== false,
    titularesNaJanela: numero(c.titulares_na_janela),
    bloqueioNaJanela: c.bloqueio_na_janela === true,
    ofertaPendente: c.oferta_pendente === true,
    jaNestaFamilia: c.ja_nesta_familia === true,
  };
}

export function ofertaDoBanco(valor: Json): Oferta {
  const o = objeto(valor);
  return {
    designacaoId: String(o.designacao_id),
    papel: String(o.papel) as Oferta["papel"],
    oferecidaEm: String(o.oferecida_em),
    prazoRespostaEm: texto(o.prazo_resposta_em),
    vencida: o.vencida === true,
    familia: String(o.familia ?? ""),
    bairro: texto(o.bairro),
    cidade: texto(o.cidade),
    uf: texto(o.uf),
    dpp: texto(o.dpp),
    gemelar: o.gemelar === true,
    dias: numero(o.dias),
    horasPorVisita: numero(o.horas_por_visita),
    periodo: texto(o.periodo) as PeriodoVisita | null,
  };
}

export function respostaDoBanco(valor: Json): ResultadoResposta {
  const r = objeto(valor);
  return {
    ok: r.ok === true,
    aceita: r.aceita === true,
    expirada: r.expirada === true,
    desfecho: texto(r.desfecho) as DesfechoRecusa | null,
  };
}

function designadaNoRadar(valor: Json | undefined): DesignadaNoRadar | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const d = valor as Registro;
  return {
    designacaoId: String(d.designacao_id),
    profissionalId: String(d.profissional_id),
    nome: String(d.nome ?? ""),
    status: String(d.status) as DesignadaNoRadar["status"],
    prazoRespostaEm: texto(d.prazo_resposta_em),
  };
}

export function radarDoBanco(valor: Json): Radar {
  const r = objeto(valor);
  const j = objeto(r.janela);
  return {
    hoje: String(r.hoje),
    janela: { antes: numero(j.antes), depois: numero(j.depois) },
    limiteAlertaPct: numeroOuNulo(r.limite_alerta_pct),
    familias: lista(r.familias).map((item): RadarFamilia => {
      const f = objeto(item);
      return {
        familiaId: String(f.familia_id),
        nome: String(f.nome ?? ""),
        cidade: texto(f.cidade),
        uf: texto(f.uf),
        regiaoId: texto(f.regiao_id),
        regiao: texto(f.regiao),
        gemelar: f.gemelar === true,
        dpp: String(f.dpp),
        ig: String(f.ig ?? ""),
        igSemanas: numero(f.ig_semanas),
        diasParaDpp: numero(f.dias_para_dpp),
        naJanela: f.na_janela === true,
        passouDaJanela: f.passou_da_janela === true,
        estagioP2: String(f.estagio_p2) as EstagioP2,
        consultaStatus: texto(f.consulta_status) as StatusConsulta | null,
        titular: designadaNoRadar(f.titular),
        backup: designadaNoRadar(f.backup),
        ultimoContato: texto(f.ultimo_contato),
        diasSemContato: numeroOuNulo(f.dias_sem_contato),
        semContato: f.sem_contato === true,
        checkinPendente: f.checkin_pendente === true,
        dppSemConfirmacao: f.dpp_sem_confirmacao === true,
        dppSemContato: f.dpp_sem_contato === true,
        estadoSensivel: (texto(f.estado_sensivel) ?? "normal") as EstadoSensivel,
      };
    }),
    nasceram: lista(r.nasceram).map((item): RadarNasceu => {
      const n = objeto(item);
      return {
        familiaId: String(n.familia_id),
        nome: String(n.nome ?? ""),
        regiaoId: texto(n.regiao_id),
        dataNascimento: String(n.data_nascimento),
        estagioP2: String(n.estagio_p2) as EstagioP2,
        previsaoAlta: texto(n.previsao_alta),
        titular: texto(n.titular),
      };
    }),
    ocupacao: lista(r.ocupacao).map((item): OcupacaoSemana => {
      const o = objeto(item);
      return {
        regiaoId: String(o.regiao_id),
        regiao: String(o.regiao ?? ""),
        semana: String(o.semana),
        ocupacaoPct: numero(o.ocupacao_pct),
        familias: numero(o.familias),
        acimaDoLimite: o.acima_do_limite === true,
      };
    }),
  };
}

function estagioDoResultado(valor: Json): EstagioP2 | null {
  return texto(objeto(valor).estagio_p2) as EstagioP2 | null;
}

export function resultadoAltaDoBanco(valor: Json): ResultadoAlta {
  const r = objeto(valor);
  return {
    visitas: numero(r.visitas),
    acompanhamentoEstado: texto(r.acompanhamento_estado) as ResultadoAlta["acompanhamentoEstado"],
    inicioEfetivo: texto(r.inicio_efetivo),
    periodo: texto(r.periodo) as PeriodoVisita | null,
    estagioP2: texto(r.estagio_p2) as EstagioP2 | null,
  };
}

/** Bebês da tela nas chaves do banco (snake_case), sem campo vazio. */
export function bebesParaBanco(
  bebes: {
    nome?: string | null;
    sexo?: string | null;
    pesoNascimentoG?: number | null;
    tipoParto?: string | null;
  }[],
): Json[] {
  return bebes.map((b) => {
    const saida: Record<string, Json> = {};
    if (b.nome) saida.nome = b.nome;
    if (b.sexo) saida.sexo = b.sexo;
    if (typeof b.pesoNascimentoG === "number") {
      saida.peso_nascimento_g = b.pesoNascimentoG;
    }
    if (b.tipoParto) saida.tipo_parto = b.tipoParto;
    return saida;
  });
}

export function criarOperacaoSupabase({
  cliente,
}: ContextoSupabase): OperacaoRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown>) =>
    rpcPendente(cliente, funcao, args);

  return {
    async listarConsultas() {
      return lista(await chamar("prenatal_consultas", {})).map(
        consultaResumoDoBanco,
      );
    },

    async estadoPrenatal(familiaId) {
      return estadoPrenatalDoBanco(
        await chamar("prenatal_estado", { familia_id: familiaId }),
      );
    },

    async agendarConsulta(pedido) {
      await chamar("agendar_consulta_prenatal", {
        familia_id: pedido.familiaId,
        agendada_para: pedido.agendadaPara,
        conduzida_por: pedido.conduzidaPor ?? null,
      });
    },

    async abrirEntrevista(familiaId) {
      return entrevistaDoBanco(
        await chamar("prenatal_abrir", { familia_id: familiaId }),
      );
    },

    async salvarCampo(pedido) {
      return resultadoSalvarDoBanco(
        await chamar("prenatal_salvar_campo", {
          consulta_id: pedido.consultaId,
          bloco: pedido.bloco,
          campo: pedido.campo,
          valor: pedido.valor,
          versao_base: pedido.versaoBase,
          progresso: pedido.progresso ?? null,
          motivo: pedido.motivo ?? null,
          item_id: pedido.itemId ?? null,
        }),
      );
    },

    async concluirEntrevista(consultaId) {
      const r = await chamar("prenatal_concluir", { consulta_id: consultaId });
      return { estagioP2: estagioDoResultado(r) };
    },

    async alocacao(familiaId) {
      return alocacaoDoBanco(
        await chamar("alocacao_familia", { familia_id: familiaId }),
      );
    },

    async oferecer(pedido) {
      await chamar("oferecer_designacao", {
        familia_id: pedido.familiaId,
        profissional_id: pedido.profissionalId,
        papel: pedido.papel,
      });
    },

    async atribuir(pedido) {
      await chamar("atribuir_designacao", {
        familia_id: pedido.familiaId,
        profissional_id: pedido.profissionalId,
        papel: pedido.papel,
        motivo: pedido.motivo,
      });
    },

    async minhasOfertas() {
      return lista(await chamar("minhas_ofertas", {})).map(ofertaDoBanco);
    },

    async responder(designacaoId, aceita, motivo) {
      return respostaDoBanco(
        await chamar("responder_designacao", {
          designacao_id: designacaoId,
          aceita,
          motivo,
        }),
      );
    },

    async radar(regiaoId) {
      return radarDoBanco(
        await chamar("radar_nascimentos", { regiao_id: regiaoId ?? null }),
      );
    },

    async registrarNascimento(pedido): Promise<ResultadoNascimento> {
      const r = await chamar("registrar_nascimento", {
        familia_id: pedido.familiaId,
        data_nascimento: pedido.dataNascimento,
        bebes: bebesParaBanco(pedido.bebes),
        previsao_alta: pedido.previsaoAlta ?? null,
      });
      return { estagioP2: estagioDoResultado(r) };
    },

    async registrarPrevisaoAlta(familiaId, previsao) {
      await chamar("registrar_previsao_alta", {
        familia_id: familiaId,
        previsao_alta: previsao,
      });
    },

    async registrarAlta(pedido) {
      return resultadoAltaDoBanco(
        await chamar("registrar_alta", {
          familia_id: pedido.familiaId,
          data_alta: pedido.dataAlta,
          primeira_visita: pedido.primeiraVisita ?? null,
          periodo: pedido.periodo ?? null,
        }),
      );
    },
  };
}
