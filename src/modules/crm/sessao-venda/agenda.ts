import type { SessaoVenda, StatusSessao } from "@/lib/dados/tipos-venda";
import { formatarDiaSemanaEData } from "@/lib/formatacao";
import { hojeBrasilia } from "../pipeline/idade-gestacional";

/**
 * Regras puras da agenda de sessões de venda (P29 item 4): rótulo de cada
 * estado, dia e hora no fuso de Brasília, separação entre o que vem pela
 * frente e o que já passou, e a frase de estado do topo da tela.
 */

export const ROTULO_STATUS: Record<StatusSessao, string> = {
  agendada: "Marcada",
  realizada: "Aconteceu",
  nao_compareceu: "A família não veio",
  remarcada: "Remarcada",
  cancelada: "Cancelada",
};

export type VarianteStatus = "contorno" | "sucesso" | "aviso" | "neutro";

export const VARIANTE_STATUS: Record<StatusSessao, VarianteStatus> = {
  agendada: "contorno",
  realizada: "sucesso",
  nao_compareceu: "aviso",
  remarcada: "neutro",
  cancelada: "neutro",
};

/** "19:00" no fuso de Brasília. */
export function horaBrasilia(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("hour")}:${valor("minute")}`;
}

/** "aaaa-mm-dd" em Brasília. */
export function diaBrasilia(iso: string): string {
  return hojeBrasilia(new Date(iso));
}

function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** "Hoje", "Amanhã" ou "Quinta, 01/10". */
export function rotuloDia(iso: string, agora: Date = new Date()): string {
  const hoje = hojeBrasilia(agora);
  const dia = diaBrasilia(iso);
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, 1)) return "Amanhã";
  if (dia === somarDias(hoje, -1)) return "Ontem";
  return formatarDiaSemanaEData(iso) ?? dia;
}

/**
 * O mesmo, para o meio da frase: "hoje, às 19:00", "na quinta, 01/10, às
 * 19:00", "no sábado, 03/10, às 10:00".
 */
export function quandoEmFrase(iso: string, agora: Date = new Date()): string {
  const dia = rotuloDia(iso, agora);
  const hora = horaBrasilia(iso);
  if (dia === "Hoje" || dia === "Amanhã" || dia === "Ontem") {
    return `${dia.toLowerCase()}, às ${hora}`;
  }
  const minusculo = dia.charAt(0).toLowerCase() + dia.slice(1);
  const artigo = /^(sábado|domingo)/.test(minusculo) ? "no" : "na";
  return `${artigo} ${minusculo}, às ${hora}`;
}

/** "Hoje, às 19:00" / "Quinta, 01/10, às 19:00". */
export function quandoSessao(iso: string, agora: Date = new Date()): string {
  return `${rotuloDia(iso, agora)}, às ${horaBrasilia(iso)}`;
}

export interface GrupoDia {
  dia: string;
  titulo: string;
  sessoes: SessaoVenda[];
}

/**
 * Próximas: marcadas, do horário mais perto para o mais longe, agrupadas
 * por dia. Passadas: o resto (inclusive marcada cujo horário já passou e
 * ainda espera o registro de como foi, que sobe para "pedem registro").
 */
export function separarAgenda(
  sessoes: SessaoVenda[],
  agora: Date = new Date(),
): {
  pedemRegistro: SessaoVenda[];
  proximas: GrupoDia[];
  anteriores: SessaoVenda[];
} {
  const instante = agora.getTime();
  const marcadas = sessoes.filter(
    (s) => s.status === "agendada" && s.agendadaPara,
  );
  const pedemRegistro = marcadas
    .filter((s) => Date.parse(s.agendadaPara!) <= instante)
    .sort((a, b) => a.agendadaPara!.localeCompare(b.agendadaPara!));
  const futuras = marcadas
    .filter((s) => Date.parse(s.agendadaPara!) > instante)
    .sort((a, b) => a.agendadaPara!.localeCompare(b.agendadaPara!));

  const proximas: GrupoDia[] = [];
  for (const sessao of futuras) {
    const dia = diaBrasilia(sessao.agendadaPara!);
    const grupo = proximas.find((g) => g.dia === dia);
    if (grupo) grupo.sessoes.push(sessao);
    else {
      proximas.push({
        dia,
        titulo: rotuloDia(sessao.agendadaPara!, agora),
        sessoes: [sessao],
      });
    }
  }

  const anteriores = sessoes
    .filter((s) => s.status !== "agendada")
    .sort((a, b) =>
      (b.agendadaPara ?? b.criadoEm).localeCompare(
        a.agendadaPara ?? a.criadoEm,
      ),
    );

  return { pedemRegistro, proximas, anteriores };
}

/**
 * Frase de estado da agenda (DESIGN.md 11.4: a frase vem logo abaixo do
 * título, em marinho). Diz o que vem pela frente e o que espera registro.
 */
export function fraseAgenda(
  separada: ReturnType<typeof separarAgenda>,
  agora: Date = new Date(),
): string {
  const partes: string[] = [];
  const hoje = hojeBrasilia(agora);
  const deHoje =
    separada.proximas.find((g) => g.dia === hoje)?.sessoes.length ?? 0;
  const proxima = separada.proximas[0]?.sessoes[0];

  if (deHoje > 0) {
    partes.push(
      deHoje === 1
        ? "Uma conversa marcada para hoje."
        : `${deHoje} conversas marcadas para hoje.`,
    );
  } else if (proxima?.agendadaPara) {
    partes.push(
      `Nenhuma conversa hoje. A próxima é ${quandoEmFrase(proxima.agendadaPara, agora)}, com a ${proxima.nomeFamilia}.`,
    );
  } else {
    partes.push("Nenhuma conversa marcada pela frente.");
  }

  if (separada.pedemRegistro.length > 0) {
    const n = separada.pedemRegistro.length;
    partes.push(
      `${n === 1 ? "Uma conversa" : `${n} conversas`} já ${n === 1 ? "passou" : "passaram"} do horário e ${n === 1 ? "espera" : "esperam"} o registro de como foi.`,
    );
  }
  return partes.join(" ");
}
