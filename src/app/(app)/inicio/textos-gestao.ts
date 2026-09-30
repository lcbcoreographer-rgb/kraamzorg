import type {
  AlertaClinicoResumo,
  SeveridadeAlerta,
} from "@/lib/dados/tipos-assistencial";
import type { VisitaAgenda } from "@/lib/dados/tipos-equipe";
import type { RadarFamilia, RadarNasceu } from "@/lib/dados/tipos-operacao";
import { formatarData } from "@/lib/formatacao";

/**
 * Textos e contas do Início da coordenação e da diretoria [polimento]
 * (DESIGN.md, 2.13 e 11.4; voz.md, seção 5). Tudo sai de leituras que já
 * existem (agenda, equipe, alertas clínicos, radar, sessões de venda,
 * painel e capacidade); nenhuma função de banco nova. Nenhum número vem
 * sozinho: cada um traz com o que comparar.
 */

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Visitas que contam para o dia: canceladas e remarcadas saem. */
const FORA_DO_DIA = new Set([
  "cancelada",
  "reagendada",
  "nao_realizada_familia",
  "nao_realizada_profissional",
]);

export function visitasQueContam(visitas: VisitaAgenda[]): VisitaAgenda[] {
  return visitas.filter((v) => !FORA_DO_DIA.has(v.estado));
}

export interface VisitasDaEnfermeira {
  profissionalId: string;
  nome: string;
  visitas: VisitaAgenda[];
}

/** As visitas de um dia, uma linha por enfermeira, em ordem de hora. */
export function visitasPorEnfermeira(
  visitas: VisitaAgenda[],
  dia: string,
): VisitasDaEnfermeira[] {
  const grupos = new Map<string, VisitasDaEnfermeira>();
  for (const v of visitasQueContam(visitas)) {
    if (v.data !== dia) continue;
    const grupo = grupos.get(v.profissionalId) ?? {
      profissionalId: v.profissionalId,
      nome: v.profissionalNome,
      visitas: [],
    };
    grupo.visitas.push(v);
    grupos.set(v.profissionalId, grupo);
  }
  for (const g of grupos.values()) {
    g.visitas.sort((a, b) =>
      (a.horaPrevista ?? "99").localeCompare(b.horaPrevista ?? "99"),
    );
  }
  return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/** "3 visitas, limite de 4" para a linha da enfermeira. */
export function linhaDaEnfermeira(n: number, limite: number): string {
  return `${plural(n, "visita", "visitas")}, limite de ${limite}`;
}

export function contextoVisitasHoje(
  porEnfermeira: VisitasDaEnfermeira[],
): string {
  if (porEnfermeira.length === 0) return "nenhuma enfermeira em campo";
  return `com ${plural(porEnfermeira.length, "enfermeira", "enfermeiras")}`;
}

/** Fichas da semana que ainda esperam o registro assinado. */
export function fichasSemAssinatura(visitas: VisitaAgenda[]): VisitaAgenda[] {
  return visitas.filter((v) => v.estado === "ficha_pendente");
}

export function contextoFichas(n: number): string {
  return n === 0 ? "nenhuma nesta semana" : "nesta semana";
}

export function contextoOfertas(n: number, horas: number | null): string {
  if (n === 0) return "todas respondidas";
  if (horas === null) return "esperando a enfermeira";
  const espera = horas >= 48 ? `${Math.floor(horas / 24)} dias` : `${horas} h`;
  return `a mais antiga há ${espera}`;
}

// --- Alertas clínicos ------------------------------------------------------------

const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = {
  imediato: 0,
  prioritario: 1,
  atencao: 2,
  informativo: 3,
};

export const ROTULO_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  imediato: "Conduta imediata",
  prioritario: "Prioritário",
  atencao: "Atenção",
  informativo: "Informativo",
};

export function alertasEmOrdem(
  alertas: AlertaClinicoResumo[],
): AlertaClinicoResumo[] {
  return [...alertas].sort(
    (a, b) =>
      ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
      a.criadoEm.localeCompare(b.criadoEm),
  );
}

/** Frase calma do bloco de alertas (voz.md, seção 6): o que há e o que fazer. */
export function fraseAlertas(alertas: AlertaClinicoResumo[]): string {
  if (alertas.length === 0) {
    return "Nenhum alerta clínico aberto agora. Quando a enfermeira registrar um sinal de alerta, ele aparece aqui primeiro.";
  }
  const imediatos = alertas.filter((a) => a.severidade === "imediato").length;
  const semAcionamento = alertas.filter((a) => !a.acionadoEm).length;
  const partes = [plural(alertas.length, "alerta aberto", "alertas abertos")];
  if (imediatos > 0) {
    partes.push(
      `${imediatos} ${imediatos === 1 ? "pede" : "pedem"} conduta imediata`,
    );
  }
  const primeira = `${partes.join(", ")}.`;
  if (semAcionamento === 0) return primeira;
  return `${primeira} ${semAcionamento === 1 ? "Um ainda espera" : `${semAcionamento} ainda esperam`} o registro do acionamento.`;
}

// --- Radar da semana -------------------------------------------------------------

/**
 * Famílias com data provável de hoje até domingo (a DPP é estimativa: só
 * informa, não move nada). Datas "aaaa-mm-dd" comparam como texto.
 */
export function radarDaSemana(
  familias: RadarFamilia[],
  hoje: string,
  domingo: string,
): RadarFamilia[] {
  return familias
    .filter((f) => f.dpp >= hoje && f.dpp <= domingo)
    .sort((a, b) => a.dpp.localeCompare(b.dpp));
}

export function linhaRadar(f: RadarFamilia): string {
  const data = formatarData(f.dpp) ?? f.dpp;
  return `${f.ig}, data provável ${data} (estimativa)`;
}

export function linhaNasceu(n: RadarNasceu): string {
  const data = formatarData(n.dataNascimento) ?? n.dataNascimento;
  return n.previsaoAlta
    ? `Nasceu em ${data}, alta prevista para ${formatarData(n.previsaoAlta) ?? n.previsaoAlta}`
    : `Nasceu em ${data}, espera a alta`;
}

export function fraseRadar(semana: number, nasceram: number): string {
  const partes: string[] = [];
  partes.push(
    semana === 0
      ? "Nenhuma data provável nesta semana"
      : `${plural(semana, "família com data provável", "famílias com data provável")} nesta semana`,
  );
  if (nasceram > 0) {
    partes.push(
      `${plural(nasceram, "bebê já nasceu", "bebês já nasceram")} e ${nasceram === 1 ? "espera" : "esperam"} a alta`,
    );
  }
  return `${partes.join("; ")}. A data provável é estimativa e não move nada sozinha.`;
}

// --- Sessões de venda ------------------------------------------------------------

export function fraseSessoes(pedemRegistro: number, proximas: number): string {
  if (pedemRegistro === 0 && proximas === 0) {
    return "Nenhuma conversa de orientação espera registro nem está marcada.";
  }
  if (pedemRegistro === 0) {
    return `Nenhuma conversa espera registro. ${plural(proximas, "conversa marcada", "conversas marcadas")} pela frente.`;
  }
  return `${pedemRegistro === 1 ? "Uma conversa já passou do horário e espera" : `${pedemRegistro} conversas já passaram do horário e esperam`} o registro de como foi.`;
}
