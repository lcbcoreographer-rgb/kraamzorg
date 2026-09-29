import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import type { Json } from "@/lib/db/types";
import { lerDefinicao } from "@/lib/instrumentos/schema";
import type { RespostasBloco } from "@/lib/instrumentos/respostas";
import doc1 from "../../../../supabase/dados/instrumentos/doc1.json";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type { OperacaoRepositorio } from "../repositorios";
import type { EstadoSensivel, EstagioP2 } from "../tipos";
import type {
  AlocacaoFamilia,
  DesfechoRecusa,
  DesignacaoLinha,
  EstadoAcompanhamento,
  Oferta,
  OcupacaoSemana,
  PapelDesignacao,
  PeriodoVisita,
  PendenciaOperacao,
  ProgressoEntrevista,
  Radar,
  RadarFamilia,
  StatusConsulta,
  StatusDesignacao,
  VisitaDoAcompanhamento,
} from "../tipos-operacao";
import {
  FAMILIAS_OPERACAO,
  PARAMETROS_OPERACAO as P,
  PROFISSIONAIS,
  REGIAO_LONDRINA,
  REGIAO_SP,
} from "./operacao-fixtures";

/**
 * Operação no modo demonstração (P35 e P36): as mesmas regras de
 * 0021_prenatal_nascimento.sql sobre uma loja em memória própria (famílias
 * "Família Teste ...", enfermeiras, consultas, designações, visitas). O
 * recorte por papel é o mesmo, simplificado; a prova de permissão continua
 * sendo o pgTAP (021_prenatal_nascimento.sql).
 *
 * Diferença assumida: no banco, a passagem do P2 para aguardando_nascimento
 * depois que a enfermeira aceita espera o cron de 5 minutos (a enfermeira não
 * tem papel para andar o P2); aqui acontece na hora, para a tela mostrar o
 * efeito.
 */

const DEFINICAO_DOC1 = lerDefinicao(doc1);
const VERSAO_DOC1 = DEFINICAO_DOC1.versao;

// --- Datas de calendário -----------------------------------------------------------------

const DIA_MS = 86_400_000;
const paraEpoch = (iso: string): number => {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(a!, m! - 1, d!) / DIA_MS);
};
const deEpoch = (dias: number): string =>
  new Date(dias * DIA_MS).toISOString().slice(0, 10);
const somarDias = (iso: string, n: number): string =>
  deEpoch(paraEpoch(iso) + n);
const diasEntre = (de: string, ate: string): number =>
  paraEpoch(ate) - paraEpoch(de);

function hojeBrasilia(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

/** Idade gestacional calculada da DPP (nunca gravada): "34s2d". */
function ig(
  dpp: string,
  ate: string,
): { semanas: number; dias: number; texto: string } {
  const total = diasEntre(somarDias(dpp, -280), ate);
  const semanas = Math.floor(total / 7);
  const dias = ((total % 7) + 7) % 7;
  return { semanas, dias, texto: `${semanas}s${dias}d` };
}

const segundaDaSemana = (iso: string): string => {
  const dow = new Date(paraEpoch(iso) * DIA_MS).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((dow + 6) % 7));
};

// --- Loja -------------------------------------------------------------------------------------

interface FamiliaOp {
  id: string;
  chave: string;
  nome: string;
  bairro: string;
  cidade: string;
  uf: string;
  regiaoId: string;
  regiao: string;
  limiteRegiao: number;
  dpp: string;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  gemelar: boolean;
  estadoSensivel: EstadoSensivel;
  estagioP2: EstagioP2;
  ultimoContato: string | null;
  telefone: string;
  dias: number;
  horas: number;
}

interface ConsultaOp {
  id: string;
  familiaId: string;
  status: StatusConsulta;
  urgente: boolean;
  agendadaPara: string | null;
  realizadaEm: string | null;
  iniciadaEm: string | null;
  instrumentoVersao: string;
  versao: number;
  ficha: Record<string, Record<string, Json>>;
  progresso: ProgressoEntrevista | null;
  periodo: PeriodoVisita[];
}

interface AcompOp {
  id: string;
  familiaId: string;
  dias: number;
  horas: number;
  periodo: PeriodoVisita | null;
  inicioEfetivo: string | null;
  previsaoAlta: string | null;
  estado: EstadoAcompanhamento;
}

interface DesigOp {
  id: string;
  familiaId: string;
  profissionalId: string;
  papel: PapelDesignacao;
  status: StatusDesignacao;
  oferecidaEm: string;
  respondidaEm: string | null;
  prazoRespostaEm: string | null;
  direta: boolean;
  motivoRecusa: string | null;
}

interface VisitaOp {
  familiaId: string;
  diaNumero: number;
  data: string;
  horaPrevista: string | null;
  profissionalId: string;
}

interface TarefaOp {
  id: string;
  familiaId: string;
  tipo: string;
  titulo: string;
  prioridade: string;
  status: "aberta" | "concluida";
  payload?: Record<string, Json>;
}

interface BebeOp {
  familiaId: string;
  ordem: number;
  nome: string | null;
  sexo: string | null;
  pesoNascimentoG: number | null;
  tipoParto: string | null;
  dataNascimento: string;
}

export interface AvisoOperacao {
  papel: "coordenacao" | "enfermeira";
  usuarioId: string | null;
  titulo: string;
  corpo: string;
  prioridade: "normal" | "alta" | "maxima";
}

export interface LojaOperacao {
  familias: FamiliaOp[];
  consultas: ConsultaOp[];
  acompanhamentos: AcompOp[];
  designacoes: DesigOp[];
  visitas: VisitaOp[];
  tarefas: TarefaOp[];
  bebes: BebeOp[];
  avisos: AvisoOperacao[];
  /** Itens da fila offline já aplicados (idempotência pelo id do item). */
  itensAplicados: Map<string, { ok: boolean; versao: number }>;
  eventos: { familiaId: string; titulo: string }[];
}

const CHAVE_GLOBAL = "__kraamzorgLojaOperacao";

const uuid = () => crypto.randomUUID();

export function criarLojaOperacao(agora = new Date()): LojaOperacao {
  const hoje = hojeBrasilia(agora);
  const loja: LojaOperacao = {
    familias: [],
    consultas: [],
    acompanhamentos: [],
    designacoes: [],
    visitas: [],
    tarefas: [],
    bebes: [],
    avisos: [],
    itensAplicados: new Map(),
    eventos: [],
  };

  FAMILIAS_OPERACAO.forEach((s, i) => {
    const familia: FamiliaOp = {
      id: `00000000-0000-4000-8009-${(i + 1).toString().padStart(12, "0")}`,
      chave: s.chave,
      nome: s.nome,
      bairro: s.bairro,
      cidade: s.cidade,
      uf: s.uf,
      regiaoId: s.regiao.id,
      regiao: s.regiao.nome,
      limiteRegiao: s.regiao.limite,
      dpp: somarDias(hoje, s.dppEmDias),
      dataNascimento:
        s.nascimentoHaDias !== undefined
          ? somarDias(hoje, -s.nascimentoHaDias)
          : null,
      dataAlta: null,
      dataInicioEfetivo: null,
      gemelar: s.gemelar === true,
      estadoSensivel: s.estadoSensivel ?? "normal",
      estagioP2: s.estagioP2,
      ultimoContato:
        s.contatoHaDias === undefined || s.contatoHaDias === null
          ? null
          : new Date(agora.getTime() - s.contatoHaDias * DIA_MS).toISOString(),
      telefone: `+55119000${(2000 + i).toString()}`,
      dias: s.dias,
      horas: s.horas,
    };
    loja.familias.push(familia);

    const acomp: AcompOp = {
      id: uuid(),
      familiaId: familia.id,
      dias: s.dias,
      horas: s.horas,
      periodo: null,
      inicioEfetivo: null,
      previsaoAlta:
        s.previsaoAltaEmDias !== undefined
          ? somarDias(hoje, s.previsaoAltaEmDias)
          : null,
      estado: "aguardando",
    };
    loja.acompanhamentos.push(acomp);

    if (s.consulta) {
      loja.consultas.push({
        id: uuid(),
        familiaId: familia.id,
        status: s.consulta.status,
        urgente: s.consulta.urgente === true,
        agendadaPara:
          s.consulta.agendadaEmDias !== undefined
            ? new Date(
                agora.getTime() + s.consulta.agendadaEmDias * DIA_MS,
              ).toISOString()
            : null,
        realizadaEm:
          s.consulta.status === "realizada" ? agora.toISOString() : null,
        iniciadaEm: s.consulta.ficha ? agora.toISOString() : null,
        instrumentoVersao: VERSAO_DOC1,
        versao: 1,
        ficha: structuredClone(s.consulta.ficha ?? {}),
        progresso: s.consulta.etapa
          ? {
              etapa: s.consulta.etapa,
              campo: "D.gestacoes_anteriores",
              em: agora.toISOString(),
            }
          : null,
        periodo: s.consulta.periodo ?? [],
      });
    }
    for (const [papel, d] of [
      ["titular", s.titular],
      ["backup", s.backup],
    ] as const) {
      if (!d) continue;
      loja.designacoes.push({
        id: uuid(),
        familiaId: familia.id,
        profissionalId: d.profissionalId,
        papel,
        status: d.status,
        oferecidaEm: new Date(agora.getTime() - 3_600_000).toISOString(),
        respondidaEm: d.status === "aceita" ? agora.toISOString() : null,
        prazoRespostaEm:
          d.status === "oferecida"
            ? new Date(agora.getTime() + 20 * 3_600_000).toISOString()
            : null,
        direta: false,
        motivoRecusa: null,
      });
    }
    for (const t of s.tarefas ?? []) {
      loja.tarefas.push({
        id: uuid(),
        familiaId: familia.id,
        tipo: t.tipo,
        titulo: t.titulo,
        prioridade: t.prioridade,
        status: "aberta",
      });
    }
    if (familia.dataNascimento) {
      loja.bebes.push({
        familiaId: familia.id,
        ordem: 1,
        nome: null,
        sexo: null,
        pesoNascimentoG: null,
        tipoParto: null,
        dataNascimento: familia.dataNascimento,
      });
    }
  });
  return loja;
}

export function obterLojaOperacao(): LojaOperacao {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<
    string,
    LojaOperacao | undefined
  >;
  global[CHAVE_GLOBAL] ??= criarLojaOperacao();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta a loja ao estado inicial. */
export function reiniciarLojaOperacao(agora?: Date): LojaOperacao {
  const global = globalThis as unknown as Record<
    string,
    LojaOperacao | undefined
  >;
  global[CHAVE_GLOBAL] = criarLojaOperacao(agora);
  return global[CHAVE_GLOBAL];
}

// --- Repositório --------------------------------------------------------------------------------

export interface ContextoOperacaoDemo {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

function recusar(codigo: string, detalhe = ""): never {
  throw new ErroRepositorio("recusado", `operacao:${codigo} ${detalhe}`);
}

const ESTAGIOS_ANTES_DO_PARTO: EstagioP2[] = [
  "pagamento_confirmado",
  "nota_fiscal_emitida",
  "consulta_prenatal_agendada",
  "consulta_realizada",
  "enfermeira_designada",
  "aguardando_nascimento",
];

const POSICAO: Partial<Record<EstagioP2, number>> = {
  pagamento_confirmado: 1,
  nota_fiscal_emitida: 1,
  consulta_prenatal_agendada: 2,
  consulta_realizada: 3,
  enfermeira_designada: 4,
  aguardando_nascimento: 5,
  bebe_nasceu: 6,
  aguardando_alta: 7,
  atendimento_liberado: 8,
};

const LINHA: EstagioP2[] = [
  "pagamento_confirmado",
  "consulta_prenatal_agendada",
  "consulta_realizada",
  "enfermeira_designada",
  "aguardando_nascimento",
  "bebe_nasceu",
  "aguardando_alta",
  "atendimento_liberado",
];

export function criarOperacaoDemonstracao(
  contexto: ContextoOperacaoDemo,
): OperacaoRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const loja = () => obterLojaOperacao();

  function exigirSessao(): string {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige AAL2");
    }
    return contexto.usuarioId;
  }
  /** Coordenação e diretoria, AAL2 (dado assistencial). */
  function exigirCoordenacao(): string {
    const usuario = exigirSessao();
    if (!tem("coordenacao", "diretoria") || contexto.aal !== "aal2") {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem permissão",
      );
    }
    return usuario;
  }

  const hoje = () => hojeBrasilia();
  const familia = (l: LojaOperacao, id: string): FamiliaOp => {
    const f = l.familias.find((x) => x.id === id);
    if (!f) recusar("familia_inexistente");
    return f;
  };
  const consultaViva = (l: LojaOperacao, familiaId: string) =>
    l.consultas.find(
      (c) =>
        c.familiaId === familiaId &&
        (c.status === "pendente" ||
          c.status === "agendada" ||
          c.status === "realizada"),
    );
  const acompanhamento = (l: LojaOperacao, familiaId: string) =>
    l.acompanhamentos.find(
      (a) => a.familiaId === familiaId && a.estado !== "encerrado",
    );
  const ativas = (l: LojaOperacao, familiaId: string) =>
    l.designacoes.filter(
      (d) =>
        d.familiaId === familiaId &&
        (d.status === "aceita" || d.status === "oferecida"),
    );
  const designada = (
    l: LojaOperacao,
    familiaId: string,
    papel: PapelDesignacao,
  ) =>
    ativas(l, familiaId)
      .filter((d) => d.papel === papel)
      .sort(
        (a, b) =>
          (a.status === "aceita" ? -1 : 1) - (b.status === "aceita" ? -1 : 1),
      )[0];
  const nomeProf = (id: string) =>
    PROFISSIONAIS.find((p) => p.id === id)?.nome ?? "";
  const aviso = (l: LojaOperacao, a: AvisoOperacao) => l.avisos.push(a);

  function tarefa(
    l: LojaOperacao,
    familiaId: string,
    tipo: string,
    titulo: string,
    prioridade: string,
  ) {
    const aberta = l.tarefas.find(
      (t) =>
        t.familiaId === familiaId && t.tipo === tipo && t.status === "aberta",
    );
    if (aberta) {
      if (prioridade === "maxima") aberta.prioridade = "maxima";
      return aberta;
    }
    const nova: TarefaOp = {
      id: uuid(),
      familiaId,
      tipo,
      titulo,
      prioridade,
      status: "aberta",
    };
    l.tarefas.push(nova);
    return nova;
  }
  const fecharTarefas = (l: LojaOperacao, familiaId: string, tipo: string) => {
    for (const t of l.tarefas) {
      if (
        t.familiaId === familiaId &&
        t.tipo === tipo &&
        t.status === "aberta"
      ) {
        t.status = "concluida";
      }
    }
  };

  /** Anda o P2 pela linha principal até o alvo (bebe_nasceu vai direto). */
  function avancarP2(f: FamiliaOp, alvo: EstagioP2) {
    const posAlvo = POSICAO[alvo]!;
    for (;;) {
      const pos = POSICAO[f.estagioP2];
      if (pos === undefined || pos >= posAlvo) return;
      f.estagioP2 = alvo === "bebe_nasceu" ? "bebe_nasceu" : LINHA[pos]!;
    }
  }

  /** Depois que a titular aceita: P2 e visitas. */
  function avancarDesignacao(l: LojaOperacao, f: FamiliaOp) {
    if (!designada(l, f.id, "titular")) return;
    const consulta = consultaViva(l, f.id);
    if (
      POSICAO[f.estagioP2] === 3 &&
      f.dataNascimento === null &&
      consulta?.status === "realizada"
    ) {
      avancarP2(f, "aguardando_nascimento");
    }
    if (f.dataAlta) gerarVisitas(l, f);
  }

  function gerarVisitas(l: LojaOperacao, f: FamiliaOp): number | null {
    const a = acompanhamento(l, f.id);
    if (!a || !f.dataAlta || !f.dataNascimento) return null;
    if (l.visitas.some((v) => v.familiaId === f.id)) return 0;
    const t = designada(l, f.id, "titular");
    if (!t || !a.inicioEfetivo || !a.periodo || a.periodo === "noite_avaliar")
      return null;
    // o freio barra a automação alta (operacional) em bloqueio total e encerramento sensível
    if (
      f.estadoSensivel === "bloqueio_total" ||
      f.estadoSensivel === "encerrado_sensivel"
    ) {
      return null;
    }
    const hora = P.visita_hora_por_periodo[a.periodo] ?? null;
    for (let n = 1; n <= a.dias; n += 1) {
      l.visitas.push({
        familiaId: f.id,
        diaNumero: n,
        data: somarDias(a.inicioEfetivo, n - 1),
        horaPrevista: hora ? `${hora}:00` : null,
        profissionalId: t.profissionalId,
      });
    }
    a.estado = "ativo";
    tarefa(
      l,
      f.id,
      "enviar_guia",
      "Enviar o guia de início do acompanhamento",
      "alta",
    );
    aviso(l, {
      papel: "enfermeira",
      usuarioId:
        PROFISSIONAIS.find((p) => p.id === t.profissionalId)?.usuarioId ?? null,
      titulo: "Um acompanhamento seu foi liberado",
      corpo: `As visitas de ${a.dias} dias foram marcadas.`,
      prioridade: "alta",
    });
    return a.dias;
  }

  function tratarRecusa(
    l: LojaOperacao,
    d: DesigOp,
    expirada: boolean,
  ): DesfechoRecusa {
    const f = familia(l, d.familiaId);
    let desfecho: DesfechoRecusa;
    if (d.papel === "titular") {
      const b = ativas(l, f.id).find((x) => x.papel === "backup");
      if (b && b.status === "aceita") {
        b.papel = "titular";
        desfecho = "backup_assumiu";
      } else if (b) {
        b.papel = "titular";
        b.oferecidaEm = new Date().toISOString();
        b.prazoRespostaEm = new Date(
          Date.now() + P.designacao_prazo_resposta_horas * 3_600_000,
        ).toISOString();
        desfecho = "oferta_passou_ao_backup";
      } else {
        desfecho = "sem_backup";
      }
    } else {
      desfecho = "backup_recusou";
    }
    if (desfecho !== "oferta_passou_ao_backup") {
      tarefa(
        l,
        f.id,
        "designar_profissional",
        desfecho === "backup_assumiu"
          ? "Designar um novo backup"
          : desfecho === "backup_recusou"
            ? "Designar outro backup"
            : "Oferecer a outra enfermeira",
        desfecho === "sem_backup" ? "alta" : "normal",
      );
    }
    aviso(l, {
      papel: "coordenacao",
      usuarioId: null,
      titulo: expirada
        ? "O prazo de uma oferta venceu sem resposta"
        : d.papel === "titular"
          ? "A titular recusou a oferta"
          : "O backup recusou a oferta",
      corpo: f.nome,
      prioridade: "alta",
    });
    l.eventos.push({ familiaId: f.id, titulo: `Designação: ${desfecho}` });
    return desfecho;
  }

  function vencerOfertas(l: LojaOperacao) {
    const agora = Date.now();
    for (const d of l.designacoes) {
      if (
        d.status === "oferecida" &&
        d.prazoRespostaEm &&
        Date.parse(d.prazoRespostaEm) <= agora
      ) {
        d.status = "expirada";
        tratarRecusa(l, d, true);
      }
    }
  }

  function profissionalDoUsuario(usuarioId: string) {
    return PROFISSIONAIS.find((p) => p.usuarioId === usuarioId && p.ativa);
  }

  function resumoDaConsulta(l: LojaOperacao, c: ConsultaOp) {
    const f = familia(l, c.familiaId);
    const i = ig(f.dpp, hoje());
    return {
      consultaId: c.id,
      familiaId: f.id,
      nome: f.nome,
      status: c.status,
      urgente: c.urgente,
      agendadaPara: c.agendadaPara,
      realizadaEm: c.realizadaEm,
      iniciadaEm: c.iniciadaEm,
      etapa: c.progresso?.etapa ?? null,
      parouEm: c.progresso?.em ?? null,
      respondidos: Object.values(c.ficha).reduce(
        (soma, campos) => soma + Object.keys(campos).length,
        0,
      ),
      dpp: f.dpp,
      ig: i.texto,
      igSemanas: i.semanas,
      chegouAlerta:
        f.dataNascimento === null &&
        i.semanas * 7 + i.dias >= P.prenatal_semanas_alerta * 7,
      cidade: f.cidade,
      uf: f.uf,
      estagioP2: f.estagioP2,
    };
  }

  function campoDaDefinicao(bloco: string, campo: string) {
    const b = DEFINICAO_DOC1.blocos.find((x) => x.id === bloco);
    return b?.campos.find((c) => c.id === campo);
  }

  function ocupacao(
    l: LojaOperacao,
    regiaoId: string | null,
    de: string,
    ate: string,
  ): OcupacaoSemana[] {
    const { antes, depois } = P.janela_dpp_dias;
    const porSemana = new Map<
      string,
      { peso: Map<string, number>; familias: Set<string>; f: FamiliaOp }
    >();
    const somar = (f: FamiliaOp, dia: string, peso: number) => {
      const semana = segundaDaSemana(dia);
      const chave = `${f.regiaoId}|${semana}`;
      const item = porSemana.get(chave) ?? {
        peso: new Map(),
        familias: new Set(),
        f,
      };
      item.peso.set("total", (item.peso.get("total") ?? 0) + peso);
      item.familias.add(f.id);
      porSemana.set(chave, item);
    };
    for (const f of l.familias) {
      if (regiaoId && f.regiaoId !== regiaoId) continue;
      const a = acompanhamento(l, f.id);
      if (!a || a.estado === "encerrado") continue;
      const inicioFato = a.inicioEfetivo ?? f.dataInicioEfetivo ?? f.dataAlta;
      const inicios: { dia: string; peso: number }[] = [];
      if (inicioFato) inicios.push({ dia: inicioFato, peso: 1 });
      else {
        const ini =
          f.dataNascimento && f.dataNascimento > somarDias(f.dpp, -antes)
            ? f.dataNascimento
            : somarDias(f.dpp, -antes);
        const fimBruto = somarDias(f.dpp, depois);
        const fim =
          f.dataNascimento && f.dataNascimento > fimBruto
            ? f.dataNascimento
            : fimBruto;
        const n = diasEntre(ini, fim) + 1;
        for (let i = 0; i < n; i += 1)
          inicios.push({ dia: somarDias(ini, i), peso: 1 / n });
      }
      for (const i of inicios) {
        for (let d = 0; d < a.dias; d += 1)
          somar(f, somarDias(i.dia, d), i.peso);
      }
    }
    const linhas: OcupacaoSemana[] = [];
    for (const [chave, item] of porSemana) {
      const semana = chave.split("|")[1]!;
      if (semana < segundaDaSemana(de) || semana > ate) continue;
      const total = item.peso.get("total") ?? 0;
      const ocupacaoPct =
        Math.round((1000 * total) / (item.f.limiteRegiao * 7)) / 10;
      linhas.push({
        regiaoId: item.f.regiaoId,
        regiao: item.f.regiao,
        semana,
        ocupacaoPct,
        familias: item.familias.size,
        acimaDoLimite: ocupacaoPct >= P.capacidade_alerta_pct,
      });
    }
    return linhas.sort((a, b) =>
      (a.regiao + a.semana).localeCompare(b.regiao + b.semana),
    );
  }

  return {
    // --- Consulta pré-natal ------------------------------------------------------------------

    async listarConsultas() {
      exigirCoordenacao();
      const l = loja();
      return l.consultas
        .filter((c) => c.status !== "cancelada" && c.status !== "nao_realizada")
        .map((c) => resumoDaConsulta(l, c))
        .sort(
          (a, b) =>
            Number(b.urgente) - Number(a.urgente) ||
            Number(a.status === "realizada") -
              Number(b.status === "realizada") ||
            (a.agendadaPara ?? "9").localeCompare(b.agendadaPara ?? "9") ||
            a.nome.localeCompare(b.nome),
        );
    },

    async estadoPrenatal(familiaId) {
      exigirSessao();
      if (!tem("comercial", "coordenacao", "diretoria")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: papel sem permissão",
        );
      }
      const c = consultaViva(loja(), familiaId);
      if (!c) {
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
        status: c.status,
        agendadaPara: c.agendadaPara,
        realizadaEm: c.realizadaEm,
        emAndamento: c.iniciadaEm !== null && c.status !== "realizada",
      };
    },

    async agendarConsulta(pedido) {
      const usuario = exigirCoordenacao();
      const l = loja();
      const f = familia(l, pedido.familiaId);
      if (Date.parse(pedido.agendadaPara) <= Date.now())
        recusar("data_no_passado");
      if (
        f.estadoSensivel === "bloqueio_total" ||
        f.estadoSensivel === "encerrado_sensivel"
      ) {
        recusar("familia_em_estado_sensivel");
      }
      const c = consultaViva(l, f.id);
      if (!c) recusar("sem_consulta");
      if (c.status === "realizada") recusar("consulta_ja_realizada");
      c.agendadaPara = pedido.agendadaPara;
      c.status = "agendada";
      c.versao += 1;
      void usuario;
      if (POSICAO[f.estagioP2] === 1)
        avancarP2(f, "consulta_prenatal_agendada");
      fecharTarefas(l, f.id, "agendar_prenatal");
    },

    async abrirEntrevista(familiaId) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, familiaId);
      const c = consultaViva(l, f.id);
      if (!c) recusar("sem_consulta");
      const i = ig(f.dpp, hoje());
      const gestante = f.telefone;
      return {
        consulta: {
          id: c.id,
          status: c.status,
          urgente: c.urgente,
          agendadaPara: c.agendadaPara,
          realizadaEm: c.realizadaEm,
          iniciadaEm: c.iniciadaEm,
          instrumentoVersao: c.instrumentoVersao,
          versao: c.versao,
          progresso: c.progresso,
        },
        definicao: DEFINICAO_DOC1,
        respostas: {
          blocos: structuredClone(c.ficha) as unknown as Record<
            string,
            RespostasBloco
          >,
          por_bebe: {},
        },
        familia: {
          id: f.id,
          nome: f.nome,
          dpp: f.dpp,
          gemelar: f.gemelar,
          cidade: f.cidade,
          uf: f.uf,
          ig: i.texto,
          igSemanas: i.semanas,
        },
        // a origem do lead não vai para a coordenação (PRD 13)
        sugestoes: {
          "B.data_provavel_do_parto": f.dpp,
          "C.telefone_da_gestante": gestante,
        },
        coletador: "Perfil Teste Coordenacao",
      };
    },

    async salvarCampo(pedido) {
      exigirCoordenacao();
      const l = loja();
      const c = l.consultas.find((x) => x.id === pedido.consultaId);
      if (!c) recusar("sem_consulta");
      if (pedido.itemId) {
        const anterior = l.itensAplicados.get(pedido.itemId);
        if (anterior) {
          return {
            ok: anterior.ok,
            versao: anterior.versao,
            conflito: false,
            original: null,
            repetido: true,
          };
        }
      }
      if (pedido.versaoBase !== null && pedido.versaoBase !== c.versao) {
        const original =
          pedido.bloco && pedido.campo
            ? ((c.ficha[pedido.bloco]?.[pedido.campo] ?? null) as Json | null)
            : null;
        return {
          ok: false,
          versao: c.versao,
          conflito: true,
          original,
          repetido: false,
        };
      }
      if (pedido.progresso) {
        c.progresso = {
          etapa: pedido.progresso.etapa,
          campo: pedido.progresso.campo ?? null,
          em: new Date().toISOString(),
        };
      }
      if (pedido.bloco === null || pedido.campo === null) {
        if (!pedido.progresso)
          recusar("dados_obrigatorios", "bloco ou progresso");
      } else {
        const def = campoDaDefinicao(pedido.bloco, pedido.campo);
        if (!def) recusar("campo_inexistente");
        if (def.tipo === "automatico") recusar("campo_automatico");
        if (JSON.stringify(pedido.valor).length > 20_000)
          recusar("valor_grande_demais");
        if (c.status === "realizada" && !pedido.motivo?.trim())
          recusar("motivo_obrigatorio");
        if (
          def.destino === "consulta_prenatal.periodo_preferido" &&
          Array.isArray(pedido.valor) &&
          pedido.valor.some(
            (p) => !["manha", "tarde", "noite_avaliar"].includes(String(p)),
          )
        ) {
          recusar("periodo_invalido");
        }
        const bloco = { ...(c.ficha[pedido.bloco] ?? {}) };
        if (pedido.valor === null) delete bloco[pedido.campo];
        else bloco[pedido.campo] = pedido.valor;
        if (Object.keys(bloco).length === 0) delete c.ficha[pedido.bloco];
        else c.ficha[pedido.bloco] = bloco;
        if (def.destino === "consulta_prenatal.periodo_preferido") {
          c.periodo = Array.isArray(pedido.valor)
            ? (pedido.valor as PeriodoVisita[])
            : [];
        }
        c.iniciadaEm ??= new Date().toISOString();
      }
      c.versao += 1;
      if (pedido.itemId)
        l.itensAplicados.set(pedido.itemId, { ok: true, versao: c.versao });
      return {
        ok: true,
        versao: c.versao,
        conflito: false,
        original: null,
        repetido: false,
      };
    },

    async concluirEntrevista(consultaId) {
      exigirCoordenacao();
      const l = loja();
      const c = l.consultas.find((x) => x.id === consultaId);
      if (!c || c.status === "cancelada" || c.status === "nao_realizada")
        recusar("sem_consulta");
      if (c.status === "realizada") recusar("consulta_ja_realizada");
      const f = familia(l, c.familiaId);
      c.status = "realizada";
      c.realizadaEm = new Date().toISOString();
      c.agendadaPara ??= c.realizadaEm;
      c.versao += 1;
      fecharTarefas(l, f.id, "agendar_prenatal");
      if (f.dataNascimento === null) {
        avancarP2(f, "consulta_realizada");
        if (designada(l, f.id, "titular"))
          avancarP2(f, "aguardando_nascimento");
        else
          tarefa(
            l,
            f.id,
            "designar_profissional",
            "Designar a titular e o backup",
            c.urgente ? "alta" : "normal",
          );
      }
      return { estagioP2: f.estagioP2 };
    },

    // --- Designação ------------------------------------------------------------------------------

    async alocacao(familiaId): Promise<AlocacaoFamilia> {
      exigirCoordenacao();
      const l = loja();
      vencerOfertas(l);
      const f = familia(l, familiaId);
      const a = acompanhamento(l, f.id);
      const c = consultaViva(l, f.id);
      const { antes, depois } = P.janela_dpp_dias;
      const janelaInicio = somarDias(f.dpp, -antes);
      const janelaFim = somarDias(f.dpp, depois);
      const designacoes: DesignacaoLinha[] = l.designacoes
        .filter((d) => d.familiaId === f.id)
        .map((d) => ({
          id: d.id,
          papel: d.papel,
          status: d.status,
          profissionalId: d.profissionalId,
          profissional: nomeProf(d.profissionalId),
          oferecidaEm: d.oferecidaEm,
          respondidaEm: d.respondidaEm,
          prazoRespostaEm: d.prazoRespostaEm,
          direta: d.direta,
          motivoRecusa: d.motivoRecusa,
        }))
        .reverse();
      const visitas: VisitaDoAcompanhamento[] = l.visitas
        .filter((v) => v.familiaId === f.id)
        .sort((x, y) => x.diaNumero - y.diaNumero)
        .map((v) => ({
          diaNumero: v.diaNumero,
          data: v.data,
          horaPrevista: v.horaPrevista,
          estado: "agendada",
          profissionalId: v.profissionalId,
          profissional: nomeProf(v.profissionalId),
        }));
      const pendencias: PendenciaOperacao[] = l.tarefas
        .filter((t) => t.familiaId === f.id && t.status === "aberta")
        .map((t) => ({
          tipo: t.tipo as PendenciaOperacao["tipo"],
          titulo: t.titulo,
          prioridade: t.prioridade as PendenciaOperacao["prioridade"],
          venceEm: null,
        }));
      return {
        familia: {
          id: f.id,
          nome: f.nome,
          dpp: f.dpp,
          dataNascimento: f.dataNascimento,
          dataAlta: f.dataAlta,
          dataInicioEfetivo: f.dataInicioEfetivo,
          gemelar: f.gemelar,
          estadoSensivel: f.estadoSensivel,
          ig: ig(f.dpp, hoje()).texto,
          estagioP2: f.estagioP2,
          cidade: f.cidade,
          uf: f.uf,
          regiaoId: f.regiaoId,
          janelaInicio,
          janelaFim,
          periodoPreferido: c?.periodo ?? [],
          consultaStatus: c?.status ?? null,
        },
        acompanhamento: a
          ? {
              id: a.id,
              estado: a.estado,
              dias: a.dias,
              horasPorVisita: a.horas,
              periodo: a.periodo,
              inicioEfetivo: a.inicioEfetivo,
              previsaoAlta: a.previsaoAlta,
              visitas: visitas.length,
              listaVisitas: visitas,
            }
          : null,
        designacoes,
        candidatas: PROFISSIONAIS.filter(
          (p) => p.ativa && p.funcao !== "coordenacao",
        ).map((p) => ({
          profissionalId: p.id,
          nome: p.nome,
          funcao: p.funcao,
          estadoHoje: l.designacoes.some(
            (d) => d.profissionalId === p.id && d.status === "oferecida",
          )
            ? "oferta_pendente"
            : "livre",
          naRegiao: p.regioes.includes(f.regiaoId),
          titularesNaJanela: l.designacoes.filter((d) => {
            if (
              d.profissionalId !== p.id ||
              d.papel !== "titular" ||
              d.status !== "aceita" ||
              d.familiaId === f.id
            )
              return false;
            const outra = familia(l, d.familiaId);
            return (
              outra.dataNascimento === null &&
              outra.dpp >= somarDias(janelaInicio, -depois) &&
              outra.dpp <= somarDias(janelaFim, antes)
            );
          }).length,
          bloqueioNaJanela: false,
          ofertaPendente: l.designacoes.some(
            (d) => d.profissionalId === p.id && d.status === "oferecida",
          ),
          jaNestaFamilia: ativas(l, f.id).some(
            (d) => d.profissionalId === p.id,
          ),
        })),
        tarefas: pendencias,
      };
    },

    async oferecer(pedido) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, pedido.familiaId);
      if (
        f.estadoSensivel === "bloqueio_total" ||
        f.estadoSensivel === "encerrado_sensivel"
      ) {
        recusar("familia_em_estado_sensivel");
      }
      if (POSICAO[f.estagioP2] === undefined)
        recusar("sem_contrato", "só se designa depois do pagamento");
      const p = PROFISSIONAIS.find((x) => x.id === pedido.profissionalId);
      if (!p || !p.ativa || p.funcao === "coordenacao")
        recusar("profissional_invalida");
      const ocupado = designada(l, f.id, pedido.papel);
      if (ocupado) recusar("papel_ocupado", ocupado.status);
      if (ativas(l, f.id).some((d) => d.profissionalId === p.id))
        recusar("mesma_profissional");
      const agora = new Date();
      l.designacoes.push({
        id: uuid(),
        familiaId: f.id,
        profissionalId: p.id,
        papel: pedido.papel,
        status: "oferecida",
        oferecidaEm: agora.toISOString(),
        respondidaEm: null,
        prazoRespostaEm: new Date(
          agora.getTime() + P.designacao_prazo_resposta_horas * 3_600_000,
        ).toISOString(),
        direta: false,
        motivoRecusa: null,
      });
      aviso(l, {
        papel: "enfermeira",
        usuarioId: p.usuarioId,
        titulo: "Você recebeu uma oferta de acompanhamento",
        corpo: "Responda no prazo.",
        prioridade: "alta",
      });
    },

    async atribuir(pedido) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, pedido.familiaId);
      const motivo = pedido.motivo.trim().slice(0, 300);
      if (!motivo) recusar("motivo_obrigatorio");
      if (
        f.estadoSensivel === "bloqueio_total" ||
        f.estadoSensivel === "encerrado_sensivel"
      ) {
        recusar("familia_em_estado_sensivel");
      }
      if (POSICAO[f.estagioP2] === undefined)
        recusar("sem_contrato", "só se designa depois do pagamento");
      const p = PROFISSIONAIS.find((x) => x.id === pedido.profissionalId);
      if (!p || !p.ativa || p.funcao === "coordenacao")
        recusar("profissional_invalida");
      for (const d of ativas(l, f.id)) {
        if (d.papel === pedido.papel || d.profissionalId === p.id) {
          d.status = "cancelada";
          d.respondidaEm ??= new Date().toISOString();
        }
      }
      const agora = new Date().toISOString();
      l.designacoes.push({
        id: uuid(),
        familiaId: f.id,
        profissionalId: p.id,
        papel: pedido.papel,
        status: "aceita",
        oferecidaEm: agora,
        respondidaEm: agora,
        prazoRespostaEm: null,
        direta: true,
        motivoRecusa: null,
      });
      aviso(l, {
        papel: "enfermeira",
        usuarioId: p.usuarioId,
        titulo: "Você foi designada em um acompanhamento",
        corpo: "Atribuição direta da coordenação.",
        prioridade: "alta",
      });
      if (pedido.papel === "titular")
        fecharTarefas(l, f.id, "designar_profissional");
      avancarDesignacao(l, f);
    },

    async minhasOfertas(): Promise<Oferta[]> {
      exigirSessao();
      if (!tem("enfermeira")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: só a enfermeira",
        );
      }
      const l = loja();
      const prof = profissionalDoUsuario(contexto.usuarioId!);
      if (!prof) return [];
      return l.designacoes
        .filter((d) => d.profissionalId === prof.id && d.status === "oferecida")
        .map((d) => {
          const f = familia(l, d.familiaId);
          const a = acompanhamento(l, f.id);
          return {
            designacaoId: d.id,
            papel: d.papel,
            oferecidaEm: d.oferecidaEm,
            prazoRespostaEm: d.prazoRespostaEm,
            vencida:
              d.prazoRespostaEm !== null &&
              Date.parse(d.prazoRespostaEm) <= Date.now(),
            familia: f.nome,
            bairro: f.bairro,
            cidade: f.cidade,
            uf: f.uf,
            dpp: f.dpp,
            gemelar: f.gemelar,
            dias: a?.dias ?? f.dias,
            horasPorVisita: a?.horas ?? f.horas,
            periodo:
              a?.periodo ??
              consultaViva(l, f.id)?.periodo.find(
                (p) => p === "manha" || p === "tarde",
              ) ??
              null,
          };
        });
    },

    async responder(designacaoId, aceita, motivo) {
      exigirSessao();
      if (!tem("enfermeira")) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: só a enfermeira",
        );
      }
      const l = loja();
      const prof = profissionalDoUsuario(contexto.usuarioId!);
      const d = l.designacoes.find(
        (x) => x.id === designacaoId && x.profissionalId === prof?.id,
      );
      if (!d) recusar("oferta_inexistente");
      if (d.status !== "oferecida") recusar("oferta_ja_respondida", d.status);
      const f = familia(l, d.familiaId);
      if (d.prazoRespostaEm && Date.parse(d.prazoRespostaEm) <= Date.now()) {
        d.status = "expirada";
        const desfecho = tratarRecusa(l, d, true);
        return { ok: false, aceita: false, expirada: true, desfecho };
      }
      if (aceita) {
        d.status = "aceita";
        d.respondidaEm = new Date().toISOString();
        aviso(l, {
          papel: "coordenacao",
          usuarioId: null,
          titulo:
            d.papel === "titular"
              ? "Uma titular aceitou a oferta"
              : "Uma backup aceitou a oferta",
          corpo: f.nome,
          prioridade: "normal",
        });
        if (d.papel === "titular")
          fecharTarefas(l, f.id, "designar_profissional");
        avancarDesignacao(l, f);
        return { ok: true, aceita: true, expirada: false, desfecho: null };
      }
      const texto = motivo
        ?.replace(/[[\]{}]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      if (!texto) recusar("motivo_obrigatorio");
      d.status = "recusada";
      d.respondidaEm = new Date().toISOString();
      d.motivoRecusa = texto;
      const desfecho = tratarRecusa(l, d, false);
      return { ok: true, aceita: false, expirada: false, desfecho };
    },

    // --- Radar, nascimento e alta ------------------------------------------------------------

    async radar(regiaoId): Promise<Radar> {
      exigirCoordenacao();
      const l = loja();
      vencerOfertas(l);
      const h = hoje();
      const { antes, depois } = P.janela_dpp_dias;
      const familias: RadarFamilia[] = l.familias
        .filter(
          (f) =>
            f.dataNascimento === null &&
            ESTAGIOS_ANTES_DO_PARTO.includes(f.estagioP2) &&
            diasEntre(h, f.dpp) <= P.radar_horizonte_dias + depois &&
            (!regiaoId || f.regiaoId === regiaoId),
        )
        .map((f) => {
          const t =
            designada(l, f.id, "titular") ??
            ativas(l, f.id).find((d) => d.papel === "titular");
          const b =
            designada(l, f.id, "backup") ??
            ativas(l, f.id).find((d) => d.papel === "backup");
          const i = ig(f.dpp, h);
          const diasSem = f.ultimoContato
            ? diasEntre(f.ultimoContato.slice(0, 10), h)
            : null;
          const naRadar = (d: DesigOp | undefined) =>
            d
              ? {
                  designacaoId: d.id,
                  profissionalId: d.profissionalId,
                  nome: nomeProf(d.profissionalId),
                  status: d.status,
                  prazoRespostaEm: d.prazoRespostaEm,
                }
              : null;
          return {
            familiaId: f.id,
            nome: f.nome,
            cidade: f.cidade,
            uf: f.uf,
            regiaoId: f.regiaoId,
            regiao: f.regiao,
            gemelar: f.gemelar,
            dpp: f.dpp,
            ig: i.texto,
            igSemanas: i.semanas,
            diasParaDpp: diasEntre(h, f.dpp),
            naJanela:
              h >= somarDias(f.dpp, -antes) && h <= somarDias(f.dpp, depois),
            passouDaJanela: h > somarDias(f.dpp, depois),
            estagioP2: f.estagioP2,
            consultaStatus: consultaViva(l, f.id)?.status ?? null,
            titular: naRadar(t),
            backup: naRadar(b),
            ultimoContato: f.ultimoContato,
            diasSemContato: diasSem,
            semContato:
              diasSem === null ? true : diasSem >= P.radar_sem_contato_dias,
            checkinPendente: l.tarefas.some(
              (x) =>
                x.familiaId === f.id &&
                x.tipo === "checkin_dpp" &&
                x.status === "aberta",
            ),
            dppSemConfirmacao:
              h >= somarDias(f.dpp, P.dpp_sem_confirmacao_dias),
            dppSemContato:
              h >= somarDias(f.dpp, P.dpp_sem_contato_dias) &&
              (f.ultimoContato === null ||
                f.ultimoContato.slice(0, 10) < f.dpp),
            estadoSensivel: f.estadoSensivel,
          };
        })
        .sort(
          (x, y) => x.dpp.localeCompare(y.dpp) || x.nome.localeCompare(y.nome),
        );
      const nasceram = l.familias
        .filter(
          (f) =>
            f.dataNascimento !== null &&
            (f.estagioP2 === "bebe_nasceu" ||
              f.estagioP2 === "aguardando_alta") &&
            (!regiaoId || f.regiaoId === regiaoId),
        )
        .map((f) => ({
          familiaId: f.id,
          nome: f.nome,
          regiaoId: f.regiaoId,
          dataNascimento: f.dataNascimento!,
          estagioP2: f.estagioP2,
          previsaoAlta: acompanhamento(l, f.id)?.previsaoAlta ?? null,
          titular: (() => {
            const t = designada(l, f.id, "titular");
            return t ? nomeProf(t.profissionalId) : null;
          })(),
        }))
        .sort((x, y) => x.dataNascimento.localeCompare(y.dataNascimento));
      return {
        hoje: h,
        janela: { antes, depois },
        limiteAlertaPct: P.capacidade_alerta_pct,
        familias,
        nasceram,
        ocupacao: ocupacao(
          l,
          regiaoId ?? null,
          h,
          somarDias(h, P.radar_horizonte_dias + depois),
        ),
      };
    },

    async registrarNascimento(pedido) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, pedido.familiaId);
      if (pedido.bebes.length < 1 || pedido.bebes.length > 2) {
        recusar("bebes_invalidos", "um bebê ou gêmeos");
      }
      if (pedido.dataNascimento > hoje()) {
        recusar("data_no_futuro", "nascimento é fato: não fica no futuro");
      }
      if (pedido.previsaoAlta && pedido.previsaoAlta < pedido.dataNascimento) {
        recusar("previsao_antes_do_nascimento");
      }
      if (POSICAO[f.estagioP2] === undefined) {
        recusar(
          "sem_contrato",
          "o nascimento de operação é registrado depois do pagamento",
        );
      }
      if (f.dataNascimento && f.dataNascimento !== pedido.dataNascimento) {
        recusar("nascimento_ja_registrado");
      }
      pedido.bebes.forEach((b, indice) => {
        if (
          b.sexo &&
          !["feminino", "masculino", "nao_informado"].includes(b.sexo)
        ) {
          recusar("bebes_invalidos", "sexo");
        }
        if (
          b.tipoParto &&
          !["vaginal", "cesarea", "nao_informado"].includes(b.tipoParto)
        ) {
          recusar("bebes_invalidos", "tipo_parto");
        }
        if (
          b.pesoNascimentoG !== null &&
          b.pesoNascimentoG !== undefined &&
          (!Number.isInteger(b.pesoNascimentoG) || b.pesoNascimentoG <= 0)
        ) {
          recusar("bebes_invalidos", "peso");
        }
        const ordem = indice + 1;
        const existente = l.bebes.find(
          (x) => x.familiaId === f.id && x.ordem === ordem,
        );
        const dados = {
          nome: b.nome?.trim() || existente?.nome || null,
          sexo: b.sexo ?? "nao_informado",
          pesoNascimentoG: b.pesoNascimentoG ?? null,
          tipoParto: b.tipoParto ?? "nao_informado",
          dataNascimento: pedido.dataNascimento,
        };
        if (existente) Object.assign(existente, dados);
        else l.bebes.push({ familiaId: f.id, ordem, ...dados });
      });
      const primeiraVez = f.dataNascimento === null;
      f.dataNascimento = pedido.dataNascimento;
      if (pedido.bebes.length === 2) f.gemelar = true;
      const a = acompanhamento(l, f.id);
      if (a && pedido.previsaoAlta) a.previsaoAlta = pedido.previsaoAlta;

      if (primeiraVez) {
        if (POSICAO[f.estagioP2]! < POSICAO.bebe_nasceu!)
          avancarP2(f, "bebe_nasceu");
        if (a?.previsaoAlta) avancarP2(f, "aguardando_alta");
        // o que ficou para trás (PRD 7.2)
        const c = consultaViva(l, f.id);
        if (c && c.status !== "realizada") {
          c.urgente = true;
          tarefa(
            l,
            f.id,
            "agendar_prenatal",
            "O bebê nasceu e o pré-natal não foi feito: decidir o que fazer",
            "maxima",
          );
        }
        const t = designada(l, f.id, "titular");
        if (!t)
          tarefa(
            l,
            f.id,
            "designar_profissional",
            "O bebê nasceu: designar a titular com urgência",
            "maxima",
          );
        aviso(l, {
          papel: "coordenacao",
          usuarioId: null,
          titulo: "Um bebê nasceu",
          corpo: f.nome,
          prioridade: "alta",
        });
        if (t) {
          aviso(l, {
            papel: "enfermeira",
            usuarioId:
              PROFISSIONAIS.find((p) => p.id === t.profissionalId)?.usuarioId ??
              null,
            titulo: "O bebê de uma das suas famílias nasceu",
            corpo: "Confira em Minhas famílias.",
            prioridade: "alta",
          });
        }
        if (!a?.previsaoAlta) {
          tarefa(
            l,
            f.id,
            "outro",
            "Dar os parabéns e pedir a previsão de alta",
            "alta",
          );
        }
        l.eventos.push({ familiaId: f.id, titulo: "Nascimento registrado" });
      }
      return { estagioP2: f.estagioP2 };
    },

    async registrarPrevisaoAlta(familiaId, previsao) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, familiaId);
      if (!f.dataNascimento) recusar("sem_nascimento");
      if (f.dataAlta) recusar("alta_ja_registrada");
      if (previsao < f.dataNascimento) recusar("previsao_antes_do_nascimento");
      const a = acompanhamento(l, f.id);
      if (!a) recusar("sem_contrato");
      a.previsaoAlta = previsao;
      avancarP2(f, "aguardando_alta");
      fecharTarefas(l, f.id, "outro");
    },

    async registrarAlta(pedido) {
      exigirCoordenacao();
      const l = loja();
      const f = familia(l, pedido.familiaId);
      if (pedido.dataAlta > hoje())
        recusar("data_no_futuro", "alta é fato: não fica no futuro");
      if (
        pedido.periodo &&
        pedido.periodo !== "manha" &&
        pedido.periodo !== "tarde"
      ) {
        recusar("periodo_invalido", "visita só de manhã ou à tarde");
      }
      if (pedido.primeiraVisita && pedido.primeiraVisita < pedido.dataAlta) {
        recusar("primeira_visita_antes_da_alta");
      }
      if (!f.dataNascimento)
        recusar("sem_nascimento", "registre o nascimento antes da alta");
      if (pedido.dataAlta < f.dataNascimento)
        recusar("alta_antes_do_nascimento");
      if (POSICAO[f.estagioP2] === undefined) recusar("sem_contrato");
      if (f.dataAlta && f.dataAlta !== pedido.dataAlta)
        recusar("alta_ja_registrada");
      const a = acompanhamento(l, f.id);
      if (!a) recusar("sem_acompanhamento");
      if (pedido.periodo) a.periodo = pedido.periodo;
      const primeiraVez = f.dataAlta === null;
      f.dataAlta = pedido.dataAlta;
      if (pedido.primeiraVisita) f.dataInicioEfetivo = pedido.primeiraVisita;
      if (primeiraVez) {
        if (POSICAO[f.estagioP2]! < POSICAO.bebe_nasceu!)
          avancarP2(f, "bebe_nasceu");
        avancarP2(f, "atendimento_liberado");
        f.dataInicioEfetivo ??= somarDias(
          pedido.dataAlta,
          P.alta_primeira_visita_dias,
        );
        a.inicioEfetivo ??= f.dataInicioEfetivo;
        a.periodo ??=
          consultaViva(l, f.id)?.periodo.find(
            (p) => p === "manha" || p === "tarde",
          ) ?? null;
        const visitas = gerarVisitas(l, f);
        if (visitas === null) {
          if (!designada(l, f.id, "titular")) {
            tarefa(
              l,
              f.id,
              "designar_profissional",
              "A alta foi registrada e não há titular: designar agora",
              "maxima",
            );
          } else if (!a.periodo) {
            tarefa(
              l,
              f.id,
              "outro",
              "A alta foi registrada: definir o período e o primeiro dia das visitas",
              "alta",
            );
          }
        }
        l.eventos.push({ familiaId: f.id, titulo: "Alta registrada" });
      } else {
        avancarDesignacao(l, f);
      }
      const total = l.visitas.filter((v) => v.familiaId === f.id).length;
      return {
        visitas: total,
        acompanhamentoEstado: a.estado,
        inicioEfetivo: a.inicioEfetivo,
        periodo: a.periodo,
        estagioP2: f.estagioP2,
      };
    },
  };
}

/** Só para testes: os avisos internos que a loja guardou. */
export function avisosDaOperacaoDemo(): AvisoOperacao[] {
  return obterLojaOperacao().avisos;
}

export { REGIAO_LONDRINA, REGIAO_SP };
