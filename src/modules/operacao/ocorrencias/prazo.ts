import type { OcorrenciaResumo } from "@/lib/dados/tipos-ocorrencia";
import { formatarDataHora } from "@/lib/formatacao";

/**
 * O prazo de resposta de uma ocorrência escrito para a lista (pedido do
 * dono em 30/09: "prazo bem legível, o vencido em alerta sem gritar").
 * A frase grande diz a distância ("Venceu há 3 h", "Responder em 5 h") e a
 * data exata fica embaixo, em mono. Intercorrência não ganha relógio nem
 * vermelho (DESIGN.md, 11.8): o atraso aparece como "ainda sem resposta da
 * equipe", com a hora em que a ocorrência foi aberta.
 */

export type SituacaoGrupo = "vencidas" | "no_prazo" | "fechadas";

export interface PrazoTela {
  tom: "alerta" | "aviso" | "neutro" | "sensivel";
  frase: string;
  /** "29/09/2026, 14:02". */
  data: string | null;
  rotuloData: string;
}

export function ocorrenciaFechada(
  o: Pick<OcorrenciaResumo, "status">,
): boolean {
  return o.status === "resolvida" || o.status === "encerrada";
}

export function grupoDaOcorrencia(
  o: Pick<OcorrenciaResumo, "status" | "vencida">,
): SituacaoGrupo {
  if (ocorrenciaFechada(o)) return "fechadas";
  return o.vencida ? "vencidas" : "no_prazo";
}

function distancia(ms: number): string {
  const minutos = Math.max(1, Math.round(ms / 60_000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function prazoDaOcorrencia(
  o: Pick<
    OcorrenciaResumo,
    "status" | "vencida" | "slaVenceEm" | "tipo" | "criadoEm"
  >,
  agora: Date = new Date(),
): PrazoTela {
  const data = o.slaVenceEm ? formatarDataHora(o.slaVenceEm) : null;

  if (o.tipo === "intercorrencia") {
    return {
      tom: "sensivel",
      frase:
        !ocorrenciaFechada(o) && o.vencida
          ? "Ainda sem resposta da equipe"
          : ocorrenciaFechada(o)
            ? "Respondida"
            : "Aberta",
      data: formatarDataHora(o.criadoEm),
      rotuloData: "Aberta em",
    };
  }
  if (ocorrenciaFechada(o)) {
    return {
      tom: "neutro",
      frase: "Fechada",
      data,
      rotuloData: "Prazo era",
    };
  }
  if (!o.slaVenceEm || !data) {
    return {
      tom: "neutro",
      frase: "Sem prazo de resposta",
      data: null,
      rotuloData: "",
    };
  }
  const falta = new Date(o.slaVenceEm).getTime() - agora.getTime();
  if (o.vencida || falta < 0) {
    return {
      tom: "alerta",
      frase: `Venceu há ${distancia(-falta)}`,
      data,
      rotuloData: "Prazo era",
    };
  }
  return {
    tom: falta < 24 * 60 * 60_000 ? "aviso" : "neutro",
    frase: `Responder em ${distancia(falta)}`,
    data,
    rotuloData: "Até",
  };
}
