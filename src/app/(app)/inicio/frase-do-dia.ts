/**
 * Frase de estado do Início (DESIGN.md, 11.4; voz.md, seção 5): o que
 * espera por alguém da equipe e o que vence hoje, em frase completa, com
 * o número por extenso até dez ("Três transferências esperam alguém da
 * equipe e quatro tarefas vencem hoje.").
 */
const POR_EXTENSO = [
  "nenhuma",
  "uma",
  "duas",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
];

function numero(n: number): string {
  return n <= 10 ? (POR_EXTENSO[n] ?? String(n)) : String(n);
}

function maiuscula(frase: string): string {
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

function plural(n: number, singular: string, varios: string): string {
  return n === 1 ? singular : varios;
}

export interface ContagemDoDia {
  /** Transferências abertas ainda sem ninguém da equipe. */
  transferenciasEsperando: number;
  /** Transferências já assumidas, ainda não resolvidas. */
  transferenciasComEquipe: number;
  tarefasAtrasadas: number;
  tarefasHoje: number;
}

export function fraseDoDia({
  transferenciasEsperando,
  transferenciasComEquipe,
  tarefasAtrasadas,
  tarefasHoje,
}: ContagemDoDia): string {
  let transferencias: string;
  if (transferenciasEsperando > 0) {
    transferencias = `${numero(transferenciasEsperando)} ${plural(
      transferenciasEsperando,
      "transferência espera",
      "transferências esperam",
    )} alguém da equipe`;
  } else if (transferenciasComEquipe > 0) {
    transferencias = `${numero(transferenciasComEquipe)} ${plural(
      transferenciasComEquipe,
      "transferência já está",
      "transferências já estão",
    )} com alguém da equipe`;
  } else {
    transferencias = "nenhuma transferência espera por você";
  }

  let tarefas: string;
  if (tarefasAtrasadas > 0 && tarefasHoje > 0) {
    tarefas = `${numero(tarefasAtrasadas)} ${plural(
      tarefasAtrasadas,
      "tarefa está atrasada",
      "tarefas estão atrasadas",
    )} e ${numero(tarefasHoje)} ${plural(tarefasHoje, "vence", "vencem")} hoje`;
  } else if (tarefasAtrasadas > 0) {
    tarefas = `${numero(tarefasAtrasadas)} ${plural(
      tarefasAtrasadas,
      "tarefa está atrasada",
      "tarefas estão atrasadas",
    )}`;
  } else if (tarefasHoje > 0) {
    tarefas = `${numero(tarefasHoje)} ${plural(
      tarefasHoje,
      "tarefa vence",
      "tarefas vencem",
    )} hoje`;
  } else {
    tarefas = "nenhuma tarefa vence hoje";
  }

  const separador = tarefasAtrasadas > 0 && tarefasHoje > 0 ? ". " : " e ";
  const segunda = separador === ". " ? maiuscula(tarefas) : tarefas;
  return `${maiuscula(transferencias)}${separador}${segunda}.`;
}

/**
 * Rótulo e contexto do trio de números do Início do comercial (DESIGN.md,
 * 2.2): nenhum número sozinho, cada um com a frase do que fazer com ele.
 */
export function resumoDoInicio(
  contagem: ContagemDoDia,
  extra: { maxima: number; comVoce: number },
): Record<
  "esperando" | "comEquipe" | "tarefas",
  { rotulo: string; contexto: string }
> {
  const tarefas = contagem.tarefasHoje + contagem.tarefasAtrasadas;
  return {
    esperando: {
      rotulo: plural(
        contagem.transferenciasEsperando,
        "transferência esperando",
        "transferências esperando",
      ),
      contexto:
        extra.maxima > 0
          ? `${extra.maxima} com prioridade máxima`
          : contagem.transferenciasEsperando > 0
            ? "por ordem de prazo"
            : "fila em dia",
    },
    comEquipe: {
      rotulo: "com a equipe",
      contexto:
        extra.comVoce > 0 ? `${extra.comVoce} com você` : "nenhuma com você",
    },
    tarefas: {
      rotulo: plural(tarefas, "tarefa para hoje", "tarefas para hoje"),
      contexto:
        contagem.tarefasAtrasadas > 0
          ? plural(
              contagem.tarefasAtrasadas,
              "1 atrasada",
              `${contagem.tarefasAtrasadas} atrasadas`,
            )
          : "nenhuma atrasada",
    },
  };
}
