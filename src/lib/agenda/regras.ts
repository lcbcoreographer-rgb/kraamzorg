import type {
  CodigoConflito,
  ConflitoAgenda,
  EstadoProfissional,
  EstadoVisita,
  SituacaoDocumento,
  TurnoVisita,
} from "@/lib/dados/tipos-equipe";
import {
  diferencaEmDias,
  inicioDaSemana,
  minutosDaHora,
  somarDias,
} from "./datas";

/**
 * As regras da agenda e do estado da profissional, em TypeScript, para o
 * modo demonstração e para a tela. São a mesma conta de
 * `privado.turno_da_visita`, `privado.conflitos_visita` e
 * `privado.status_profissional` (0007 e 0022): o banco é quem decide na
 * produção (pgTAP 022), e os testes daqui usam os mesmos casos. Nenhum
 * limite mora no código: tudo vem de `ParametrosAgenda`, que nasce de
 * `parametro` (e, na demonstração, do mesmo valor do seed).
 */

export interface ParametrosAgenda {
  /** PRD 3.4: no máximo duas por dia. */
  visitasPorDia: number;
  periodos: Record<TurnoVisita, { inicio: string; fim: string }>;
  /** PRD 10.2: DPP menos 21 a mais 14 dias. */
  janelaDpp: { antes: number; depois: number };
  documentoAvisoDias: number;
  registro: { toleranciaFuturoMinutos: number; maxAtrasoHoras: number };
}

export type PeriodoAcompanhamento = "manha" | "tarde" | "noite_avaliar" | null;

export interface AcompanhamentoRegra {
  id: string;
  periodo: PeriodoAcompanhamento;
  horasPorVisita: number;
  estado: string;
  familiaDpp: string | null;
  familiaDataNascimento: string | null;
}

export interface VisitaRegra {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  diaNumero: number;
  data: string;
  horaPrevista: string | null;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
}

export interface BloqueioRegra {
  profissionalId: string;
  inicio: string;
  fim: string;
}

export type StatusDesignacao =
  "oferecida" | "aceita" | "recusada" | "expirada" | "cancelada";

export interface DesignacaoRegra {
  profissionalId: string;
  acompanhamentoId: string;
  papel: "titular" | "backup";
  status: StatusDesignacao;
}

const ESTADOS_FIM = [
  "encerrado",
  "interrompido_familia",
  "interrompido_clinico",
] as const;

export function acompanhamentoTerminou(estado: string): boolean {
  return (ESTADOS_FIM as readonly string[]).includes(estado);
}

/** Estados da visita em que o horário ainda pode mudar. */
export function visitaMovivel(estado: EstadoVisita): boolean {
  return (
    estado === "agendada" ||
    estado === "confirmada" ||
    estado === "a_caminho" ||
    estado === "reagendada" ||
    estado === "nao_realizada_familia" ||
    estado === "nao_realizada_profissional"
  );
}

/** Visita que conta na carga e nos conflitos da profissional. */
export function visitaOcupaAgenda(estado: EstadoVisita): boolean {
  return (
    estado !== "reagendada" &&
    estado !== "cancelada" &&
    estado !== "nao_realizada_familia" &&
    estado !== "nao_realizada_profissional"
  );
}

/** Turno pela hora prevista contra as faixas; sem hora, pelo período. */
export function turnoDaVisita(
  hora: string | null,
  periodo: PeriodoAcompanhamento,
  p: ParametrosAgenda,
): TurnoVisita | null {
  const minutos = minutosDaHora(hora);
  if (minutos === null) {
    return periodo === "manha" || periodo === "tarde" ? periodo : null;
  }
  for (const turno of ["manha", "tarde"] as const) {
    const inicio = minutosDaHora(p.periodos[turno].inicio);
    const fim = minutosDaHora(p.periodos[turno].fim);
    if (inicio !== null && fim !== null && minutos >= inicio && minutos < fim) {
      return turno;
    }
  }
  return null;
}

export interface EntradaConflito {
  profissionalId: string;
  profissionalAtiva: boolean;
  data: string;
  horaPrevista: string | null;
  acompanhamentoId: string;
  /** A própria visita, quando ela já existe (não conta contra si). */
  visitaId?: string | null;
}

/**
 * Conflitos de uma visita, existente ou proposta, na agenda da
 * profissional. As visitas da mesma família não contam entre si.
 */
export function conflitosVisita(
  entrada: EntradaConflito,
  visitas: readonly VisitaRegra[],
  bloqueios: readonly BloqueioRegra[],
  acompanhamentos: readonly AcompanhamentoRegra[],
  p: ParametrosAgenda,
): ConflitoAgenda[] {
  const conflitos: ConflitoAgenda[] = [];
  const add = (c: ConflitoAgenda) => conflitos.push(c);

  if (!entrada.profissionalAtiva) add({ codigo: "profissional_inativa" });

  if (
    bloqueios.some(
      (b) =>
        b.profissionalId === entrada.profissionalId &&
        entrada.data >= b.inicio &&
        entrada.data <= b.fim,
    )
  ) {
    add({ codigo: "bloqueio" });
  }

  const outrasDoDia = visitas.filter(
    (v) =>
      v.profissionalId === entrada.profissionalId &&
      v.data === entrada.data &&
      visitaOcupaAgenda(v.estado) &&
      v.id !== (entrada.visitaId ?? null) &&
      v.acompanhamentoId !== entrada.acompanhamentoId,
  );
  if (outrasDoDia.length + 1 > p.visitasPorDia) {
    add({
      codigo: "limite_visitas_dia",
      limite: p.visitasPorDia,
      quantas: outrasDoDia.length + 1,
    });
  }

  const acomp = acompanhamentos.find((a) => a.id === entrada.acompanhamentoId);
  const turno = turnoDaVisita(entrada.horaPrevista, null, p);
  let referencia: TurnoVisita | null = turnoDaVisita(
    null,
    acomp?.periodo ?? null,
    p,
  );
  if (referencia === null) {
    const d1 = visitas.find(
      (v) =>
        v.acompanhamentoId === entrada.acompanhamentoId &&
        v.diaNumero === 1 &&
        v.id !== (entrada.visitaId ?? null) &&
        visitaOcupaAgenda(v.estado),
    );
    referencia = d1 ? turnoDaVisita(d1.horaPrevista, null, p) : null;
  }
  if (turno !== null && referencia !== null && turno !== referencia) {
    add({ codigo: "periodo_diferente_do_d1", turno, referencia });
  }

  const inicio = minutosDaHora(entrada.horaPrevista);
  const duracao = Math.round((acomp?.horasPorVisita ?? 0) * 60);
  for (const outra of outrasDoDia) {
    const outraAcomp = acompanhamentos.find(
      (a) => a.id === outra.acompanhamentoId,
    );
    const outraInicio = minutosDaHora(outra.horaPrevista);
    if (inicio !== null && outraInicio !== null) {
      const outraDuracao = Math.round((outraAcomp?.horasPorVisita ?? 0) * 60);
      if (
        inicio < outraInicio + outraDuracao &&
        outraInicio < inicio + duracao
      ) {
        add({ codigo: "sobreposicao", visitaId: outra.id });
      }
    } else if (
      turno !== null &&
      turno ===
        turnoDaVisita(outra.horaPrevista, outraAcomp?.periodo ?? null, p)
    ) {
      add({ codigo: "sobreposicao", visitaId: outra.id });
    }
  }

  return conflitos;
}

export function temConflito(
  conflitos: readonly ConflitoAgenda[],
  codigo: CodigoConflito,
): boolean {
  return conflitos.some((c) => c.codigo === codigo);
}

export interface EntradaStatus {
  profissionalId: string;
  dia: string;
  hoje: string;
}

/**
 * Estado calculado da profissional num dia, na ordem de precedência do
 * banco: em visita, em atendimento, reservada, backup, oferta pendente,
 * folga e livre. Nunca digitado.
 */
export function statusProfissional(
  entrada: EntradaStatus,
  visitas: readonly VisitaRegra[],
  designacoes: readonly DesignacaoRegra[],
  acompanhamentos: readonly AcompanhamentoRegra[],
  bloqueios: readonly BloqueioRegra[],
  p: ParametrosAgenda,
): EstadoProfissional {
  const semanaInicio = inicioDaSemana(entrada.dia);
  const semanaFim = somarDias(semanaInicio, 6);
  const minhas = designacoes.filter(
    (d) => d.profissionalId === entrada.profissionalId,
  );
  const acomp = (id: string) => acompanhamentos.find((a) => a.id === id);

  if (
    entrada.dia === entrada.hoje &&
    visitas.some(
      (v) =>
        v.profissionalId === entrada.profissionalId &&
        v.checkinEm !== null &&
        v.checkoutEm === null,
    )
  ) {
    return "em_visita";
  }

  if (
    minhas.some((d) => {
      const a = acomp(d.acompanhamentoId);
      return (
        d.papel === "titular" &&
        d.status === "aceita" &&
        a !== undefined &&
        (a.estado === "ativo" || a.estado === "em_execucao") &&
        visitas.some(
          (v) =>
            v.acompanhamentoId === a.id &&
            v.data >= semanaInicio &&
            v.data <= semanaFim,
        )
      );
    })
  ) {
    return "em_atendimento";
  }

  const janelaCruzaSemana = (dpp: string | null): boolean =>
    dpp !== null &&
    somarDias(dpp, -p.janelaDpp.antes) <= semanaFim &&
    somarDias(dpp, p.janelaDpp.depois) >= semanaInicio;

  if (
    minhas.some((d) => {
      const a = acomp(d.acompanhamentoId);
      return (
        d.papel === "titular" &&
        d.status === "aceita" &&
        a !== undefined &&
        a.estado === "aguardando" &&
        a.familiaDataNascimento === null &&
        janelaCruzaSemana(a.familiaDpp)
      );
    })
  ) {
    return "reservada";
  }

  if (
    minhas.some((d) => {
      const a = acomp(d.acompanhamentoId);
      return (
        d.papel === "backup" &&
        d.status === "aceita" &&
        a !== undefined &&
        !acompanhamentoTerminou(a.estado) &&
        janelaCruzaSemana(a.familiaDpp)
      );
    })
  ) {
    return "backup";
  }

  if (minhas.some((d) => d.status === "oferecida")) return "oferta_pendente";

  if (
    bloqueios.some(
      (b) =>
        b.profissionalId === entrada.profissionalId &&
        entrada.dia >= b.inicio &&
        entrada.dia <= b.fim,
    )
  ) {
    return "folga";
  }

  return "livre";
}

export function situacaoDocumento(
  validade: string | null,
  hoje: string,
  avisoDias: number,
): SituacaoDocumento {
  if (!validade) return "sem_validade";
  if (validade < hoje) return "vencido";
  if (diferencaEmDias(hoje, validade) <= avisoDias) return "vencendo";
  return "em_dia";
}

export interface ErroHorario {
  codigo: "hora_no_futuro" | "hora_muito_antiga" | "fora_do_dia_da_visita";
}

/**
 * Confere a hora de chegada ou saída vinda do aparelho: não no futuro (mais
 * a tolerância), não mais velha que o máximo e no dia da visita, no fuso da
 * operação. Mesma regra de `privado.horario_do_registro`.
 */
export function conferirHorarioDoRegistro(
  quando: Date,
  agora: Date,
  dataVisita: string,
  dataDoQuando: string,
  p: ParametrosAgenda,
): ErroHorario | null {
  if (
    quando.getTime() >
    agora.getTime() + p.registro.toleranciaFuturoMinutos * 60_000
  ) {
    return { codigo: "hora_no_futuro" };
  }
  if (
    quando.getTime() <
    agora.getTime() - p.registro.maxAtrasoHoras * 3_600_000
  ) {
    return { codigo: "hora_muito_antiga" };
  }
  if (dataDoQuando !== dataVisita) return { codigo: "fora_do_dia_da_visita" };
  return null;
}
