import type {
  AlertaCapacidade,
  CapacidadeVisao,
  CoberturaBackup,
  NivelCapacidade,
  OrigemDistribuicao,
  RegiaoCapacidade,
  SemanaCapacidade,
} from "@/lib/dados/tipos-gestao";
import { dataCurta, formatarDecimal, formatarPct } from "@/lib/gestao/formato";
import { formatarData } from "@/lib/formatacao";
import type { DadoColuna, EstadoColuna } from "@/components/graficos/colunas";

/**
 * Textos da tela de capacidade (P45). Frases completas, sem jargão de
 * sistema (voz.md): quem lê é a diretoria e a coordenação, que decidem se
 * fecham mais contratos numa praça. Nenhum limite ou prazo mora aqui; tudo
 * chega da função do banco.
 */

export const ROTULO_NIVEL: Record<NivelCapacidade, string> = {
  folga: "Tranquila",
  atencao: "Atenção",
  sobrevenda: "Sobrevenda provável",
};

export const ROTULO_COBERTURA: Record<CoberturaBackup, string> = {
  ok: "Backup coberto",
  sem_reserva: "Sem reserva de backup",
  insuficiente: "Equipe abaixo do necessário",
};

export const ESTADO_DA_COLUNA: Record<NivelCapacidade, EstadoColuna> = {
  folga: "neutro",
  atencao: "atencao",
  sobrevenda: "alerta",
};

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Semana de 05/10 a 11/10. */
export function faixaDaSemana(segunda: string): string {
  const d = new Date(`${segunda}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  const domingo = d.toISOString().slice(0, 10);
  return `${dataCurta(segunda)} a ${dataCurta(domingo)}`;
}

export function detalheDaSemana(s: SemanaCapacidade): string[] {
  return [
    `Semana de ${faixaDaSemana(s.semana)}`,
    `Ocupação de ${formatarPct(s.ocupacaoPct)}`,
    `Chance de passar o limite: ${formatarPct(s.probExcessoPct)}`,
    `Famílias esperadas: ${formatarDecimal(s.familiasEsperadas)}. No pior caso razoável: ${s.familiasP90}.`,
    `Equipe livre: ${plural(s.profissionaisAtivas, "profissional", "profissionais")}, atende ${plural(s.capacidadeEquipe, "família", "famílias")}.`,
    ROTULO_COBERTURA[s.cobertura],
    ROTULO_NIVEL[s.nivel],
  ];
}

export function colunasDaRegiao(r: RegiaoCapacidade): DadoColuna[] {
  return r.semanas.map((s) => ({
    id: s.semana,
    rotulo: dataCurta(s.semana),
    valor: s.ocupacaoPct,
    estado: ESTADO_DA_COLUNA[s.nivel],
    valorTexto:
      s.nivel === "folga" ? undefined : `${Math.round(s.ocupacaoPct)}%`,
    detalhe: detalheDaSemana(s),
  }));
}

/** Frase de abertura da tela. */
export function fraseResumo(v: CapacidadeVisao): string {
  const sobre = v.alertas.filter((a) => a.nivel === "sobrevenda");
  const atencao = v.alertas.filter((a) => a.nivel === "atencao");
  if (v.regioes.length === 0) {
    return "Nenhuma região com limite de famílias por semana está cadastrada. Cadastre o limite em Configurações para acompanhar a capacidade.";
  }
  if (sobre.length === 0 && atencao.length === 0) {
    return `Nas próximas ${v.semanas} semanas nenhuma região passa do limite, e a equipe cobre o pior caso razoável e a reserva de backup.`;
  }
  const partes: string[] = [];
  if (sobre.length > 0) {
    partes.push(
      `${regioesDe(sobre)} ${sobre.length === 1 ? "tem" : "têm"} ${plural(sobre.length, "semana", "semanas")} com chance de sobrevenda`,
    );
  }
  if (atencao.length > 0) {
    partes.push(
      `${plural(atencao.length, "semana pede", "semanas pedem")} atenção por ocupação alta ou por falta de reserva de backup`,
    );
  }
  return `${capitalizar(partes.join(" e "))}. ${sobre.length > 0 ? "Vale conversar antes de fechar novos contratos nessa região." : "Nenhuma passa do limite de famílias."}`;
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function regioesDe(alertas: AlertaCapacidade[]): string {
  const nomes = [...new Set(alertas.map((a) => a.regiao))];
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function tituloDoAlerta(a: AlertaCapacidade): string {
  return `${a.regiao}, semana de ${faixaDaSemana(a.semana)}`;
}

export function textoDoAlerta(a: AlertaCapacidade): string {
  if (a.nivel === "sobrevenda") {
    return `A chance de passar do limite de famílias é de ${formatarPct(a.probExcessoPct)}, com ocupação de ${formatarPct(a.ocupacaoPct)}. ${ROTULO_COBERTURA[a.cobertura]}.`;
  }
  return `Ocupação de ${formatarPct(a.ocupacaoPct)}. ${ROTULO_COBERTURA[a.cobertura]}.`;
}

/** "32s0d" a partir dos dias de diferença em relação à DPP (40s0d). */
function igDaDiferenca(dias: number): string {
  const total = 280 + dias;
  return `${Math.floor(total / 7)}s${total % 7}d`;
}

export function faixasDaDistribuicao(o: OrigemDistribuicao) {
  return o.faixas.map((f) => ({
    id: `${f.de}`,
    rotulo: `${igDaDiferenca(f.de)} a ${igDaDiferenca(f.ate)}`,
    valor: f.peso,
    valorTexto: formatarPct(f.peso),
  }));
}

export function notaDaDistribuicao(o: OrigemDistribuicao): string {
  if (o.modelo === "uniforme") {
    return "A previsão está no modelo simples da Fase 1: o início do atendimento é espalhado por igual na janela ao redor da data provável do parto.";
  }
  if (o.fonte === "historico") {
    return `A previsão usa o histórico da própria Kraamzorg: ${o.historicoN} partos registrados com data provável e data de nascimento.`;
  }
  return `A previsão usa uma distribuição de referência para o nascimento em relação à data provável do parto, porque a Kraamzorg ainda tem ${plural(o.historicoN, "parto registrado", "partos registrados")} e precisa de ${o.historicoMinimo ?? "mais"} para usar o próprio histórico. Os pesos da referência ainda vão ser validados pela Edilaine e pelo Leonardo.`;
}

export function geradoEmTexto(iso: string): string {
  return formatarData(iso) ?? "";
}
