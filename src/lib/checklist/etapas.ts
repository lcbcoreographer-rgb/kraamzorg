import {
  blocoVisivel,
  estaRespondido,
  lerValor,
  type BebeFormulario,
  type ContextoFormulario,
  type Pendencia,
  type RespostasFormulario,
} from "@/lib/instrumentos/respostas";
import type { Bloco, DefinicaoInstrumento } from "@/lib/instrumentos/schema";

/**
 * As oito etapas do checklist no celular (docs/design/fluxos.md, fluxo A):
 * a planilha tem nove blocos e dezenas de linhas; no celular vira uma tela
 * por etapa, na ordem da visita real (chegada, mãe, bebê, orientações,
 * fechamento). Só agrupa blocos que já existem na definição aprovada: campo
 * nenhum nasce aqui. Bloco novo de uma versão futura do instrumento que
 * ainda não esteja neste mapa ganha etapa própria antes do resumo, para
 * nunca ficar escondido.
 */
export interface EtapaChecklist {
  id: string;
  /** Nome curto da etapa na trilha e na lista de etapas. */
  rotulo: string;
  /** Ids dos blocos da definição que esta etapa reúne. */
  blocos: string[];
  /** Etapa dos blocos por bebê: uma aba por bebê em gêmeos. */
  porBebe?: boolean;
}

const ETAPAS_BASE: readonly EtapaChecklist[] = [
  { id: "chegada", rotulo: "Chegada", blocos: ["1"] },
  {
    id: "puerpera",
    rotulo: "Puérpera",
    blocos: ["2", "2.2", "2.3", "2.4"],
  },
  { id: "sinais_vitais", rotulo: "Sinais vitais", blocos: ["2.1"] },
  {
    id: "mamas",
    rotulo: "Mamas e amamentação",
    blocos: ["2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"],
  },
  {
    id: "bebe",
    rotulo: "Bebê",
    blocos: ["3", "3.1", "3.2"],
    porBebe: true,
  },
  { id: "orientacoes", rotulo: "Orientações do dia", blocos: ["4", "5", "6"] },
  {
    id: "emocional",
    rotulo: "Emocional e encerramento",
    blocos: ["7", "8", "9"],
  },
];

/** Etapa final: resumo, assinatura e, no último dia, os contatos dos médicos. */
export const ETAPA_RESUMO: EtapaChecklist = {
  id: "resumo",
  rotulo: "Resumo e assinatura",
  blocos: ["ultimo_dia", "resumo", "assinatura"],
};

export interface EtapaMontada extends EtapaChecklist {
  /** Blocos da definição, já sem os que não se aplicam a esta visita. */
  blocosDaDefinicao: Bloco[];
}

/**
 * As etapas desta visita: as do mapa que têm ao menos um bloco visível,
 * mais uma etapa por bloco desconhecido, e por último o resumo.
 */
export function montarEtapas(
  definicao: DefinicaoInstrumento,
  respostas: RespostasFormulario,
  contexto: ContextoFormulario,
): EtapaMontada[] {
  const ambiente = { definicao, respostas, contexto };
  const visiveis = definicao.blocos.filter((b) => blocoVisivel(b, ambiente));
  const porId = new Map(visiveis.map((b) => [b.id, b]));
  const conhecidos = new Set([
    ...ETAPAS_BASE.flatMap((e) => e.blocos),
    ...ETAPA_RESUMO.blocos,
  ]);

  const etapas: EtapaMontada[] = [];
  for (const etapa of ETAPAS_BASE) {
    const blocos = etapa.blocos
      .map((id) => porId.get(id))
      .filter((b): b is Bloco => b !== undefined);
    if (blocos.length > 0) etapas.push({ ...etapa, blocosDaDefinicao: blocos });
  }
  for (const bloco of visiveis) {
    if (conhecidos.has(bloco.id)) continue;
    etapas.push({
      id: `bloco_${bloco.id}`,
      rotulo: bloco.titulo,
      blocos: [bloco.id],
      porBebe: bloco.repete_por_bebe,
      blocosDaDefinicao: [bloco],
    });
  }
  etapas.push({
    ...ETAPA_RESUMO,
    blocosDaDefinicao: ETAPA_RESUMO.blocos
      .map((id) => porId.get(id))
      .filter((b): b is Bloco => b !== undefined),
  });
  return etapas;
}

export type EstadoEtapa =
  "completa" | "com_pendencia" | "com_alerta" | "nao_iniciada";

/**
 * Estado de uma etapa para a lista de etapas (fluxo A, passo 2): completa
 * (todos os obrigatórios respondidos e algo respondido), com pendência,
 * com alerta (algum alerta aberto ligado aos seus blocos) ou não iniciada.
 */
export function estadoDaEtapa(entrada: {
  etapa: EtapaMontada;
  respostas: RespostasFormulario;
  bebes: BebeFormulario[];
  pendencias: Pendencia[];
  blocosComAlerta: Set<string>;
}): EstadoEtapa {
  const { etapa, respostas, bebes, pendencias, blocosComAlerta } = entrada;
  if (etapa.blocosDaDefinicao.some((b) => blocosComAlerta.has(b.id))) {
    return "com_alerta";
  }
  const respondeuAlgo = etapa.blocosDaDefinicao.some((bloco) => {
    const alvos = bloco.repete_por_bebe ? bebes.map((b) => b.id) : [undefined];
    return alvos.some((bebe) =>
      bloco.campos.some((campo) =>
        estaRespondido(
          campo,
          lerValor(respostas, { bloco: bloco.id, campo: campo.id, bebe }),
        ),
      ),
    );
  });
  const temPendencia = pendencias.some((p) => etapa.blocos.includes(p.bloco));
  if (temPendencia) return respondeuAlgo ? "com_pendencia" : "nao_iniciada";
  return respondeuAlgo ? "completa" : "nao_iniciada";
}
