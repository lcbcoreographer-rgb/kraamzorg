import type {
  SituacaoEvolucao,
  StatusEvolucao,
  TipoEvolucao,
} from "@/lib/dados/tipos-evolucao";

/**
 * Como um documento da evolução aparece na URL e na tela. A URL leva só o id
 * do acompanhamento e um apelido do documento (`puerperal`, `bebe-1`,
 * `bebe-2`), nunca nome de ninguém (CLAUDE.md).
 */

export interface DocumentoRef {
  tipo: TipoEvolucao;
  bebeId: string | null;
}

export function slugDoDocumento(doc: {
  tipo: TipoEvolucao;
  bebeOrdem: number;
}): string {
  return doc.tipo === "puerperal" ? "puerperal" : `bebe-${doc.bebeOrdem}`;
}

export function resolverDocumento(
  slug: string,
  bebes: readonly { id: string; ordem: number }[],
): DocumentoRef | null {
  if (slug === "puerperal") return { tipo: "puerperal", bebeId: null };
  const achado = /^bebe-([1-9])$/.exec(slug);
  if (!achado) return null;
  const bebe = bebes.find((b) => b.ordem === Number(achado[1]));
  return bebe ? { tipo: "neonatal", bebeId: bebe.id } : null;
}

export function rotuloDocumento(
  tipo: TipoEvolucao,
  bebeOrdem: number,
  bebeNome: string | null,
  totalBebes: number,
): string {
  if (tipo === "puerperal") return "Evolução puerperal";
  if (bebeNome) return `Evolução neonatal de ${bebeNome}`;
  return totalBebes > 1
    ? `Evolução neonatal do bebê ${bebeOrdem}`
    : "Evolução neonatal";
}

export type VarianteSelo =
  "neutro" | "sucesso" | "aviso" | "alerta" | "sensivel" | "destaque";

export const ROTULO_STATUS: Record<StatusEvolucao, string> = {
  rascunho: "Rascunho",
  em_revisao: "Aguardando revisão",
  aprovado: "Aprovada",
  enviado: "Enviada ao médico",
  erro_envio: "Envio com erro",
};

export const VARIANTE_STATUS: Record<StatusEvolucao, VarianteSelo> = {
  rascunho: "neutro",
  em_revisao: "aviso",
  aprovado: "sucesso",
  enviado: "sucesso",
  erro_envio: "alerta",
};

export const ROTULO_SITUACAO: Record<SituacaoEvolucao, string> = {
  no_prazo: "No prazo",
  aviso: "Prazo de hoje",
  escalada: "Prazo vencido",
  em_andamento: "Em revisão ou envio",
  concluida: "Enviada",
};

export const VARIANTE_SITUACAO: Record<SituacaoEvolucao, VarianteSelo> = {
  no_prazo: "neutro",
  aviso: "aviso",
  escalada: "alerta",
  em_andamento: "neutro",
  concluida: "sucesso",
};

/** Frase que diz onde o acompanhamento está e quem faz o próximo passo. */
export function frasePrazo(
  situacao: SituacaoEvolucao,
  prazoAviso: string,
  prazoEscala: string,
  formatar: (data: string) => string | null,
  /** Quem lê: na tela da própria enfermeira a frase fala com ela. */
  leitor: "equipe" | "enfermeira" = "equipe",
): string {
  const aviso = formatar(prazoAviso) ?? prazoAviso;
  const escala = formatar(prazoEscala) ?? prazoEscala;
  const paraEla = leitor === "enfermeira";
  switch (situacao) {
    case "no_prazo":
      return paraEla
        ? `Você tem até ${aviso} para preencher e mandar para a revisão.`
        : `A enfermeira tem até ${aviso} para preencher e mandar para a revisão.`;
    case "aviso":
      return paraEla
        ? `O seu prazo é hoje (${aviso}). Se passar de ${escala}, a coordenação assume.`
        : `O prazo da enfermeira é hoje (${aviso}). Se passar de ${escala}, a coordenação assume.`;
    case "escalada":
      return `Passou de ${escala}. A coordenação assume o preenchimento e a revisão.`;
    case "em_andamento":
      return "Todos os documentos já saíram do rascunho. Falta a coordenação aprovar e enviar.";
    case "concluida":
      return "Todos os documentos foram enviados aos médicos.";
  }
}
