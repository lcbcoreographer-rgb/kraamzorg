import type {
  SituacaoEvolucao,
  StatusEvolucao,
} from "@/lib/dados/tipos-evolucao";

/**
 * Prazo da evolução (PRD 9.5): a enfermeira tem um dia útil depois do fim do
 * atendimento; o aviso sai em D+1 e a escalada para a coordenação em D+2,
 * contados em dias úteis (segunda a sexta, menos os feriados de
 * `parametro.feriados`). É a mesma conta de `privado.dias_uteis_apos` no
 * banco; o modo demonstração e os testes usam esta.
 */
const MS_DIA = 86_400_000;

function somarDias(data: string, dias: number): string {
  const tempo = Date.parse(`${data}T00:00:00Z`) + dias * MS_DIA;
  return new Date(tempo).toISOString().slice(0, 10);
}

function diaDaSemana(data: string): number {
  // 1 = segunda ... 7 = domingo
  const dia = new Date(`${data}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function diasUteisApos(
  data: string,
  dias: number,
  feriados: readonly string[] = [],
): string {
  let atual = data;
  let contados = 0;
  while (contados < dias) {
    atual = somarDias(atual, 1);
    if (diaDaSemana(atual) < 6 && !feriados.includes(atual)) contados += 1;
  }
  return atual;
}

export interface ConfigPrazo {
  alertaDias: number;
  escalaCoordenacaoDias: number;
  feriados: readonly string[];
}

export function prazosDoAtendimento(
  concluidoEm: string,
  config: ConfigPrazo,
): { aviso: string; escala: string } {
  return {
    aviso: diasUteisApos(concluidoEm, config.alertaDias, config.feriados),
    escala: diasUteisApos(
      concluidoEm,
      config.escalaCoordenacaoDias,
      config.feriados,
    ),
  };
}

/** Situação do acompanhamento na lista, pelos status dos documentos e pelo prazo. */
export function situacaoDoPrazo(
  hoje: string,
  prazos: { aviso: string; escala: string },
  statusDosDocumentos: readonly (StatusEvolucao | null)[],
): SituacaoEvolucao {
  if (statusDosDocumentos.every((status) => status === "enviado")) {
    return "concluida";
  }
  if (
    statusDosDocumentos.every(
      (status) => status !== null && status !== "rascunho",
    )
  ) {
    return "em_andamento";
  }
  if (hoje >= prazos.escala) return "escalada";
  if (hoje >= prazos.aviso) return "aviso";
  return "no_prazo";
}
