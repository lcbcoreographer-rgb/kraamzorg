import type { Tarefa } from "@/lib/dados/tipos";
import { formatarDataHora } from "@/lib/formatacao";
import {
  ORDEM_PRIORIDADE,
  paraTarefaTela,
  type BaldeVencimento,
  type GrupoTarefas,
  type TarefaTela,
} from "./tipos";

const TITULO_BALDE: Record<BaldeVencimento, string> = {
  vencida: "Vencidas",
  vence_hoje: "Vencem hoje",
  a_vencer: "A vencer",
  sem_prazo: "Sem prazo",
};

const ORDEM_BALDE: BaldeVencimento[] = ["vencida", "vence_hoje", "a_vencer", "sem_prazo"];

function balde(venceEm: string | null, agora: Date): BaldeVencimento {
  if (!venceEm) return "sem_prazo";
  const data = new Date(venceEm);
  if (Number.isNaN(data.getTime())) return "sem_prazo";
  if (data.getTime() < agora.getTime()) return "vencida";

  const fimDoDia = new Date(agora);
  fimDoDia.setHours(23, 59, 59, 999);
  return data.getTime() <= fimDoDia.getTime() ? "vence_hoje" : "a_vencer";
}

function compararTarefas(a: TarefaTela, b: TarefaTela): number {
  const prioridade = ORDEM_PRIORIDADE[b.prioridade] - ORDEM_PRIORIDADE[a.prioridade];
  if (prioridade !== 0) return prioridade;
  const venceA = a.venceEm ?? "9999";
  const venceB = b.venceEm ?? "9999";
  return venceA.localeCompare(venceB);
}

/**
 * Tarefas por prioridade e vencimento (P18 item 2, protótipo
 * `comercial-inicio.html`): primeiro por prioridade (máxima, alta,
 * normal), depois por quem vence mais cedo, agrupadas em vencidas / vencem
 * hoje / a vencer / sem prazo.
 */
export function agruparTarefas(tarefas: Tarefa[], agora: Date = new Date()): GrupoTarefas[] {
  const telas = tarefas.map(paraTarefaTela);
  const grupos = new Map<BaldeVencimento, TarefaTela[]>();

  for (const tarefa of telas) {
    const chave = balde(tarefa.venceEm, agora);
    const lista = grupos.get(chave) ?? [];
    lista.push(tarefa);
    grupos.set(chave, lista);
  }

  return ORDEM_BALDE.filter((chave) => grupos.has(chave)).map((chave) => ({
    balde: chave,
    titulo: TITULO_BALDE[chave],
    tarefas: [...(grupos.get(chave) ?? [])].sort(compararTarefas),
  }));
}

/** "venceu há 8 min" / "vence em 22 min" / "até 17:00" (protótipo C1, `.prazo`). */
export function textoPrazo(venceEm: string | null, agora: Date = new Date()): string | null {
  if (!venceEm) return null;
  const data = new Date(venceEm);
  if (Number.isNaN(data.getTime())) return null;

  const diferencaMin = Math.round((data.getTime() - agora.getTime()) / 60_000);
  if (Math.abs(diferencaMin) < 60) {
    return diferencaMin >= 0
      ? `vence em ${Math.max(diferencaMin, 1)} min`
      : `venceu há ${Math.abs(diferencaMin)} min`;
  }
  if (Math.abs(diferencaMin) < 24 * 60) {
    const horas = Math.round(Math.abs(diferencaMin) / 60);
    return diferencaMin >= 0 ? `vence em ${horas} h` : `venceu há ${horas} h`;
  }
  const dataHora = formatarDataHora(data);
  return dataHora ? `até ${dataHora}` : null;
}
