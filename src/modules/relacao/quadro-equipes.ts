import type {
  EquipeTarefas,
  TarefaEquipe,
  VisaoTarefasEquipe,
} from "@/lib/dados/tipos-relacao";
import { ROTULO_EQUIPE } from "./rotulos";

/**
 * Tarefas por equipe organizadas para o quadro (pedido do dono em 30/09:
 * "melhor organizada visualmente"): uma coluna por equipe e, dentro dela,
 * um bloco por pessoa, com quem está sem responsável primeiro. A ordem das
 * pessoas é pelo nome, nunca por quantidade (DESIGN.md, 11.10: ninguém vira
 * ranking). Nada aqui muda o que a visão traz; só arruma.
 */

export interface PessoaNoQuadro {
  /** null: as tarefas da equipe que ainda não têm responsável. */
  nome: string | null;
  tarefas: TarefaEquipe[];
  vencidas: number;
}

export interface EquipeNoQuadro {
  equipe: string;
  rotulo: string;
  resumo: EquipeTarefas | null;
  abertas: number;
  vencidas: number;
  semResponsavel: number;
  pessoas: PessoaNoQuadro[];
}

const ORDEM_PRIORIDADE: Record<TarefaEquipe["prioridade"], number> = {
  maxima: 0,
  alta: 1,
  normal: 2,
};

/** Vencida primeiro, depois a prioridade e o prazo mais curto. */
function compararTarefas(a: TarefaEquipe, b: TarefaEquipe): number {
  if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
  const prioridade =
    ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
  if (prioridade !== 0) return prioridade;
  return (a.venceEm ?? "9999").localeCompare(b.venceEm ?? "9999");
}

export function montarQuadroEquipes(
  visao: VisaoTarefasEquipe,
): EquipeNoQuadro[] {
  const equipes = new Set<string>([
    ...visao.equipes.map((e) => e.equipe),
    ...visao.tarefas.map((t) => t.equipe),
  ]);
  return [...equipes]
    .map((equipe) => {
      const tarefas = visao.tarefas.filter((t) => t.equipe === equipe);
      const porPessoa = new Map<string | null, TarefaEquipe[]>();
      for (const tarefa of tarefas) {
        const chave = tarefa.responsavel ?? null;
        porPessoa.set(chave, [...(porPessoa.get(chave) ?? []), tarefa]);
      }
      const pessoas: PessoaNoQuadro[] = [...porPessoa.entries()]
        .map(([nome, lista]) => ({
          nome,
          tarefas: [...lista].sort(compararTarefas),
          vencidas: lista.filter((t) => t.vencida).length,
        }))
        .sort((a, b) => {
          if (a.nome === null) return -1;
          if (b.nome === null) return 1;
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
      const resumo = visao.equipes.find((e) => e.equipe === equipe) ?? null;
      return {
        equipe,
        rotulo: ROTULO_EQUIPE[equipe] ?? equipe,
        resumo,
        abertas: resumo?.abertas ?? tarefas.length,
        vencidas: resumo?.vencidas ?? tarefas.filter((t) => t.vencida).length,
        semResponsavel:
          resumo?.semResponsavel ??
          tarefas.filter((t) => !t.responsavel).length,
        pessoas,
      };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Frase do topo: o total, o que venceu e o que está sem dono. */
export function fraseQuadroEquipes(quadro: EquipeNoQuadro[]): string {
  const abertas = quadro.reduce((soma, e) => soma + e.abertas, 0);
  if (abertas === 0) return "Nenhuma tarefa aberta nas equipes agora.";
  const vencidas = quadro.reduce((soma, e) => soma + e.vencidas, 0);
  const sem = quadro.reduce((soma, e) => soma + e.semResponsavel, 0);
  const equipesComTarefa = quadro.filter((e) => e.abertas > 0).length;
  return [
    `${plural(abertas, "tarefa aberta", "tarefas abertas")} em ${plural(equipesComTarefa, "equipe", "equipes")}.`,
    vencidas === 0
      ? "Nenhuma venceu."
      : `${plural(vencidas, "venceu", "venceram")}.`,
    sem === 0
      ? "Todas têm responsável."
      : `${plural(sem, "está sem responsável", "estão sem responsável")}.`,
  ].join(" ");
}

/** Frase de cada coluna, embaixo do número de abertas. */
export function fraseEquipe(e: EquipeNoQuadro): string {
  const partes = [
    e.vencidas === 0
      ? "nenhuma vencida"
      : plural(e.vencidas, "vencida", "vencidas"),
    e.semResponsavel === 0
      ? "todas com responsável"
      : `${e.semResponsavel} sem responsável`,
  ];
  if (e.resumo && e.resumo.emAndamento > 0) {
    partes.push(`${e.resumo.emAndamento} em andamento`);
  }
  const frase = partes.join(", ");
  const concluidas =
    e.resumo === null
      ? ""
      : e.resumo.concluidas7d === 0
        ? " Nenhuma concluída nos últimos 7 dias."
        : ` ${plural(e.resumo.concluidas7d, "concluída", "concluídas")} nos últimos 7 dias.`;
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.${concluidas}`;
}
